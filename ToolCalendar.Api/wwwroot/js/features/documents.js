import { escapeAttribute } from '../core/dom.js';
import { formatDate, getBadgeClass } from '../core/formatters.js';

export function createDocumentsFeature(context) {
    let documents = [];
    let page = 1;
    let totalPages = 1;
    const pageSize = 10;
    let searchTimer = null;

    function init() {
        document.getElementById('doc-search')?.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => refresh(1), 350);
        });

        document.getElementById('btn-prev-docs')?.addEventListener('click', async () => {
            if (page > 1) {
                await refresh(page - 1);
            }
        });

        document.getElementById('btn-next-docs')?.addEventListener('click', async () => {
            if (page < totalPages) {
                await refresh(page + 1);
            }
        });

        document.getElementById('all-docs-table')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            const { action: actionName, docId, title } = action.dataset;
            if (!docId) return;

            event.preventDefault();
            if (action.dataset.stopPropagation === 'true') {
                event.stopPropagation();
            }

            const id = parseInt(docId, 10);

            if (actionName === 'open-doc-detail') {
                closeAllDropdowns();
                await context.services.openDocDetail(id);
            }

            if (actionName === 'open-doc-detail-edit') {
                closeAllDropdowns();
                await context.services.openDocDetail(id, 'edit');
            }

            if (actionName === 'open-pdf') {
                closeAllDropdowns();
                await context.services.openPdfPreview(id, title || '');
            }

            if (actionName === 'delete-document') {
                closeAllDropdowns();
                await deleteDocument(id);
            }

            if (actionName === 'toggle-action-dropdown') {
                toggleActionDropdown(id);
            }
        });

        document.addEventListener('click', (event) => {
            if (!event.target.closest('.action-dropdown')) {
                closeAllDropdowns();
            }
        });
    }

    async function refresh(targetPage = page) {
        const search = document.getElementById('doc-search')?.value?.trim() ?? '';
        const url = `/api/documents?page=${targetPage}&size=${pageSize}&search=${encodeURIComponent(search)}`;

        try {
            const response = await context.api.get(url);
            if (!response.ok) return;

            const result = await response.json();
            documents = result.data || [];
            page = result.page || targetPage;
            totalPages = result.totalPages || 1;
            render();
        } catch (error) {
            console.error('Document list load error:', error);
        }
    }

    function render() {
        const role = localStorage.getItem('user_role');
        const body = document.querySelector('#all-docs-table tbody');
        if (!body) return;

        const offset = (page - 1) * pageSize;
        body.innerHTML = documents.map((doc, index) => {
            const safeTitle = escapeAttribute(doc.soVanBan || '');
            let menuItems = `
                <button class="action-dropdown-item item-view" data-action="open-doc-detail" data-doc-id="${doc.id}" data-stop-propagation="true">
                    &#128064; Xem chi tiet
                </button>
                <button class="action-dropdown-item item-view" data-action="open-pdf" data-doc-id="${doc.id}" data-title="${safeTitle}" data-stop-propagation="true">
                    &#128196; Xem ban giay PDF
                </button>`;

            if (role === 'Admin' || role === 'VanThu') {
                menuItems += `
                    <button class="action-dropdown-item item-edit" data-action="open-doc-detail-edit" data-doc-id="${doc.id}" data-stop-propagation="true">
                        &#9999;&#65039; Chinh sua
                    </button>`;
            }

            if (role === 'Admin') {
                menuItems += `
                    <button class="action-dropdown-item item-delete" data-action="delete-document" data-doc-id="${doc.id}" data-stop-propagation="true">
                        &#128465;&#65039; Xoa van ban
                    </button>`;
            }

            return `
                <tr style="cursor:pointer;" data-action="open-doc-detail" data-doc-id="${doc.id}">
                    <td style="text-align:center; color:var(--text-secondary); font-size:0.82rem; font-weight:700; width:48px;">${offset + index + 1}</td>
                    <td style="font-weight:700; color:var(--sidebar-bg);">${doc.soVanBan || '-'}</td>
                    <td>${formatDate(doc.ngayBanHanh)}</td>
                    <td>${doc.trichYeu || ''}</td>
                    <td>${doc.coQuanChuQuan || ''}</td>
                    <td>${formatDate(doc.thoiHan)}</td>
                    <td><span class="badge ${getBadgeClass(doc.soNgayConLai)}">${doc.trangThai || doc.status || ''}</span></td>
                    <td data-stop-propagation="true" style="white-space:nowrap; text-align:center;">
                        <div class="action-dropdown" id="dropdown-${doc.id}">
                            <button class="action-trigger-btn" data-action="toggle-action-dropdown" data-doc-id="${doc.id}" data-stop-propagation="true">
                                ⚙️ Thao tac ▾
                            </button>
                            <div class="action-dropdown-menu" id="dropdown-menu-${doc.id}">
                                ${menuItems}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        document.getElementById('docs-page-info').innerText = `Trang ${page} / ${totalPages}`;
        document.getElementById('btn-prev-docs').disabled = page <= 1;
        document.getElementById('btn-next-docs').disabled = page >= totalPages;
    }

    function toggleActionDropdown(docId) {
        const menu = document.getElementById(`dropdown-menu-${docId}`);
        if (!menu) return;

        const isOpen = menu.classList.contains('open');
        closeAllDropdowns();
        if (!isOpen) {
            menu.classList.add('open');
        }
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.action-dropdown-menu.open').forEach((menu) => {
            menu.classList.remove('open');
        });
    }

    async function deleteDocument(id) {
        const confirmed = await context.ui.showConfirm('Xoa van ban nay?');
        if (!confirmed) return;

        try {
            const response = await context.api.delete(`/api/documents/${id}`);
            if (!response.ok) {
                context.ui.showAlert('Loi khi xoa', '❌');
                return;
            }

            await context.services.refreshCoreData();
        } catch (error) {
            context.ui.showAlert('Loi khi xoa', '❌');
        }
    }

    return {
        init,
        activate() {},
        refresh,
        closeAllDropdowns
    };
}
