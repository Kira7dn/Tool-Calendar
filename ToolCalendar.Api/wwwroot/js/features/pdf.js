export function createPdfFeature(context) {
    let pdfDoc = null;
    let pdfPage = 1;
    const renderTasks = new Map();

    function init() {
        document.getElementById('pdf-preview-modal')?.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;

            if (button.dataset.action === 'pdf-modal-prev') {
                await prevPage();
            }

            if (button.dataset.action === 'pdf-modal-next') {
                await nextPage();
            }

            if (button.dataset.action === 'close-pdf-modal') {
                closePreview();
            }
        });
    }

    function ensurePdfLib() {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js is not available');
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    async function getDocument(url) {
        ensurePdfLib();
        return pdfjsLib.getDocument({
            url,
            httpHeaders: {
                Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`
            }
        }).promise;
    }

    async function renderPage(doc, pageNumber, canvasId, infoId) {
        if (!doc) return;

        let renderTask = null;

        try {
            await cancelRender(canvasId);

            const page = await doc.getPage(pageNumber);
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const canvasContext = canvas.getContext('2d');
            if (!canvasContext) return;

            const originalViewport = page.getViewport({ scale: 1 });
            const containerWidth = canvas.parentElement.clientWidth - 100;
            const scale = containerWidth / originalViewport.width;
            const viewport = page.getViewport({ scale: Math.min(scale, 1.2) });

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvasContext.clearRect(0, 0, canvas.width, canvas.height);

            renderTask = page.render({
                canvasContext,
                viewport
            });
            renderTasks.set(canvasId, renderTask);

            await renderTask.promise;

            const info = document.getElementById(infoId);
            if (info) {
                info.innerText = `${pageNumber} / ${doc.numPages}`;
            }
        } catch (error) {
            if (error?.name !== 'RenderingCancelledException') {
                console.error('Render PDF Error:', error);
            }
        } finally {
            if (renderTasks.get(canvasId) === renderTask) {
                renderTasks.delete(canvasId);
            }
        }
    }

    async function cancelRender(canvasId) {
        const existingTask = renderTasks.get(canvasId);
        if (!existingTask) return;

        try {
            existingTask.cancel();
            await existingTask.promise.catch(() => {});
        } finally {
            renderTasks.delete(canvasId);
        }
    }

    async function openPreview(docId, title) {
        const modal = document.getElementById('pdf-preview-modal');
        if (!modal) return;

        modal.style.display = 'flex';
        document.getElementById('pdf-modal-title').innerText = title || 'Xem tai lieu PDF';
        document.getElementById('pdf-modal-page-info').innerText = 'Dang tai...';

        try {
            pdfDoc = await getDocument(`/api/documents/${docId}/file`);
            pdfPage = 1;
            await renderPage(pdfDoc, pdfPage, 'pdf-modal-canvas', 'pdf-modal-page-info');
        } catch (error) {
            context.ui.showAlert(`Khong the tai file PDF: ${error.message}`, '❌');
            closePreview();
        }
    }

    async function prevPage() {
        if (pdfDoc && pdfPage > 1) {
            pdfPage -= 1;
            await renderPage(pdfDoc, pdfPage, 'pdf-modal-canvas', 'pdf-modal-page-info');
        }
    }

    async function nextPage() {
        if (pdfDoc && pdfPage < pdfDoc.numPages) {
            pdfPage += 1;
            await renderPage(pdfDoc, pdfPage, 'pdf-modal-canvas', 'pdf-modal-page-info');
        }
    }

    function closePreview() {
        const modal = document.getElementById('pdf-preview-modal');
        if (modal) {
            modal.style.display = 'none';
        }

        void cancelRender('pdf-modal-canvas');
        pdfDoc = null;
    }

    return {
        init,
        openPreview,
        closePreview,
        getDocument,
        renderPage,
        cancelRender
    };
}
