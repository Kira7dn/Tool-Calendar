import { initMultiSelect } from '../ui/multiSelect.js';
import { formatDateForTextInput, normalizeDateInputToIso } from '../core/formatters.js';

export function createReviewFeature(context) {
    let reviewIndex = 0;
    let reviewPdfDoc = null;
    let reviewPdfPage = 1;
    let reviewOcrPages = [];

    function init() {
        document.getElementById('tab-upload')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'enter-review-scene') {
                const preferredDocId = context.services.upload.getFirstReviewableDocId();
                if (preferredDocId != null) {
                    await enterReviewScene(preferredDocId);
                }
            }
        });

        document.getElementById('review-side-by-side-modal')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');

            if (!action) {
                if (event.target.id === 'review-side-by-side-modal') {
                    exitReviewScene();
                }
                return;
            }

            if (action.dataset.action === 'close-review-modal') {
                exitReviewScene();
            }

            if (action.dataset.action === 'review-prev') {
                await navigate(-1);
            }

            if (action.dataset.action === 'review-next') {
                await navigate(1);
            }

            if (action.dataset.action === 'save-current-review') {
                await saveCurrentReview();
            }

            if (action.dataset.action === 'delete-current-review') {
                await deleteCurrentReview();
            }

            if (action.dataset.action === 'review-pdf-prev') {
                await prevPdfPage();
            }

            if (action.dataset.action === 'review-pdf-next') {
                await nextPdfPage();
            }
        });

    }

    async function enterReviewScene(preferredDocId = null) {
        const docs = context.services.upload.getSessionUploads();
        if (!docs.length) return;

        const preferredIndex = preferredDocId == null
            ? -1
            : docs.findIndex((doc) => String(doc.id) === String(preferredDocId));

        document.getElementById('review-side-by-side-modal').style.display = 'flex';
        reviewIndex = preferredIndex >= 0 ? preferredIndex : 0;
        await loadReviewDoc(reviewIndex);
    }

    function exitReviewScene() {
        document.getElementById('review-side-by-side-modal').style.display = 'none';
        void context.services.pdf.cancelRender('review-pdf-canvas');
        reviewPdfDoc = null;
    }

    async function loadReviewDoc(index) {
        const docs = context.services.upload.getSessionUploads();
        if (index < 0 || index >= docs.length) return;

        const doc = docs[index];
        reviewIndex = index;
        reviewOcrPages = parseOcrPages(doc);

        document.getElementById('review-doc-counter').innerText = `T\u00e0i li\u1ec7u ${index + 1} / ${docs.length}`;
        document.getElementById('review-prev-btn').disabled = index === 0;
        document.getElementById('review-next-btn').disabled = index === docs.length - 1;
        document.getElementById('review-doc-id').value = doc.id;
        document.getElementById('review-so-hieu').value = doc.soVanBan || '';
        document.getElementById('review-co-quan').value = doc.coQuanChuQuan || '';
        document.getElementById('review-trich-yeu').value = doc.trichYeu || '';
        document.getElementById('review-han-xu-ly').value = formatDateForTextInput(doc.thoiHan);
        document.getElementById('review-pdf-filename').innerText = doc.fileName || 'PDF G\u1ed1c';
        syncAssignmentSelectors(doc);

        try {
            reviewPdfDoc = await context.services.pdf.getDocument(`/api/documents/${doc.id}/file`);
            reviewPdfPage = 1;
            await context.services.pdf.renderPage(reviewPdfDoc, reviewPdfPage, 'review-pdf-canvas', 'review-page-info');
            syncCurrentPageText(doc);
        } catch (error) {
            context.ui.showAlert(`Kh\u00f4ng th\u1ec3 hi\u1ec3n th\u1ecb b\u1ea3n xem tr\u01b0\u1edbc PDF: ${error.message}`, '\u274c');
        }
    }

    async function navigate(direction) {
        await loadReviewDoc(reviewIndex + direction);
    }

    async function prevPdfPage() {
        if (reviewPdfDoc && reviewPdfPage > 1) {
            reviewPdfPage -= 1;
            await context.services.pdf.renderPage(reviewPdfDoc, reviewPdfPage, 'review-pdf-canvas', 'review-page-info');
            syncCurrentPageText(getCurrentItem());
        }
    }

    async function nextPdfPage() {
        if (reviewPdfDoc && reviewPdfPage < reviewPdfDoc.numPages) {
            reviewPdfPage += 1;
            await context.services.pdf.renderPage(reviewPdfDoc, reviewPdfPage, 'review-pdf-canvas', 'review-page-info');
            syncCurrentPageText(getCurrentItem());
        }
    }

    async function saveCurrentReview() {
        const currentItem = getCurrentItem();
        if (!currentItem) return;

        const normalizedDeadline = normalizeDateInputToIso(document.getElementById('review-han-xu-ly').value);

        context.services.upload.updateSessionUpload(currentItem.id, {
            soVanBan: document.getElementById('review-so-hieu').value,
            coQuanChuQuan: document.getElementById('review-co-quan').value,
            thoiHan: normalizedDeadline ? `${normalizedDeadline}T00:00:00` : null,
            trichYeu: document.getElementById('review-trich-yeu').value,
            // Keep existing multi-selects unless we add multi-select to review modal too
            ocrPagesJson: currentItem.ocrPagesJson || '[]'
        });

        const saved = await context.services.upload.saveBatchItem(currentItem.id);
        if (!saved) return;

        const docs = context.services.upload.getSessionUploads();
        if (docs.length) {
            await loadReviewDoc(Math.min(reviewIndex, docs.length - 1));
        } else {
            exitReviewScene();
        }
    }

    async function deleteCurrentReview() {
        const currentItem = getCurrentItem();
        if (!currentItem) return;

        await context.services.upload.deleteBatchItem(currentItem.id);
        const docs = context.services.upload.getSessionUploads();
        if (!docs.length) {
            exitReviewScene();
            return;
        }

        await loadReviewDoc(Math.min(reviewIndex, docs.length - 1));
    }

    function parseOcrPages(doc) {
        if (!doc?.ocrPagesJson) return [];

        try {
            const pages = JSON.parse(doc.ocrPagesJson);
            if (!Array.isArray(pages)) return [];

            return pages
                .map((page) => ({
                    pageNumber: Number(page.pageNumber) || 0,
                    text: typeof page.text === 'string' ? page.text : ''
                }))
                .filter((page) => page.pageNumber > 0)
                .sort((a, b) => a.pageNumber - b.pageNumber);
        } catch (error) {
            console.error('OCR pages parse error:', error);
            return [];
        }
    }

    function syncCurrentPageText(doc) {
        const pageLabel = document.getElementById('review-ocr-page-label');
        const fullTextBox = document.getElementById('review-fulltext-page');
        if (!pageLabel || !fullTextBox) return;

        pageLabel.innerText = `Trang ${reviewPdfPage}`;

        const matchedPage = reviewOcrPages.find((page) => page.pageNumber === reviewPdfPage);
        if (matchedPage?.text?.trim()) {
            fullTextBox.value = matchedPage.text.trim();
            return;
        }

        if (reviewPdfPage === 1 && doc?.fullText?.trim() && !isLegacyOcrErrorText(doc.fullText)) {
            fullTextBox.value = doc.fullText.trim();
            return;
        }

        fullTextBox.value = doc?.status === 'Lỗi OCR' || isLegacyOcrErrorText(doc?.fullText)
            ? 'OCR đã lỗi ở lần xử lý trước. Hãy chạy lại OCR cho tài liệu này.'
            : 'Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u OCR theo t\u1eebng trang cho trang n\u00e0y.';
    }

    function syncAssignmentSelectors(doc) {
        const reference = context.services.upload.getReferenceData();
        const departmentSelect = document.getElementById('review-department');
        const assigneeSelect = document.getElementById('review-assignee');
        if (!departmentSelect || !assigneeSelect) return;

        initMultiSelect({
            container: departmentSelect,
            options: reference.departments.map((department) => ({
                id: department.id,
                label: department.name
            })),
            selectedIds: doc?.departmentIds || [],
            suggestedIds: doc?.suggestedDeptIds || [],
            placeholder: 'Chọn phòng ban',
            onChange: (newIds) => {
                const currentItem = getCurrentItem();
                if (!currentItem) return;

                context.services.upload.updateSessionUpload(currentItem.id, {
                    departmentIds: newIds
                });
            }
        });

        initMultiSelect({
            container: assigneeSelect,
            options: reference.users.map((user) => {
                const department = reference.departments.find((item) => item.id === user.departmentId);
                const name = user.fullName || user.username;
                return {
                    id: user.id,
                    label: `${name} - ${department ? department.name.replace('Phòng ', '') : 'Vãng lai'}`,
                    chipLabel: name
                };
            }),
            selectedIds: doc?.assignedToIds || [],
            suggestedIds: doc?.suggestedUserIds || [],
            placeholder: 'Chọn cán bộ',
            onChange: (newIds) => {
                const currentItem = getCurrentItem();
                if (!currentItem) return;

                context.services.upload.updateSessionUpload(currentItem.id, {
                    assignedToIds: newIds
                });
            }
        });
    }

    function getCurrentItem() {
        const docs = context.services.upload.getSessionUploads();
        return docs[reviewIndex] || null;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function isLegacyOcrErrorText(value) {
        return String(value || '').includes('[OCR Total Error]');
    }

    return {
        init,
        enterReviewScene,
        exitReviewScene
    };
}
