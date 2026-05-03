import { escapeAttribute } from '../core/dom.js';
import { formatDate, getBadgeClass } from '../core/formatters.js';
import { DOC_STATUS } from '../core/constants.js';

export function createDocumentsFeature(context) {
    let documents = [];
    let page = 1;
    let totalPages = 1;
    const pageSize = 10;
    let searchTimer = null;

    const statusMap = {
        'Chưa xử lý': 'status_pending',
        'Đang xử lý': 'status_processing',
        'Đã rà soát': 'status_reviewed',
        'Đã hoàn thành': 'status_completed',
        'Lỗi OCR': 'status_error_ocr'
    };

    function init() {
        loadStatusFilters();

        document.getElementById('doc-search')?.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => refresh(1), 350);
        });

        document.getElementById('doc-status-filter')?.addEventListener('change', () => {
            refresh(1);
        });

        document.getElementById('doc-sort-filter')?.addEventListener('change', () => {
            refresh(1);
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

        // 3. Lắng nghe cập nhật realtime
        document.addEventListener('realtime:document_updated', () => {
            refresh();
        });
    }

    async function refresh(targetPage = page) {
        const search = document.getElementById('doc-search')?.value?.trim() ?? '';
        const status = document.getElementById('doc-status-filter')?.value ?? '';
        const sort = document.getElementById('doc-sort-filter')?.value ?? 'deadline_asc';
        const url = `/api/documents?page=${targetPage}&size=${pageSize}&search=${encodeURIComponent(search)}&status=${status}&sort=${sort}`;

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
                    &#128064; ${context.i18n.t('view_detail')}
                </button>
                <button class="action-dropdown-item item-view" data-action="open-pdf" data-doc-id="${doc.id}" data-title="${safeTitle}" data-stop-propagation="true">
                    &#128196; ${context.i18n.t('view_pdf')}
                </button>`;

            if (role === 'Admin' || role === 'VanThu') {
                menuItems += `
                    <button class="action-dropdown-item item-edit" data-action="open-doc-detail-edit" data-doc-id="${doc.id}" data-stop-propagation="true">
                        &#9999;&#65039; ${context.i18n.t('edit')}
                    </button>`;
            }

            if (role === 'Admin') {
                menuItems += `
                    <button class="action-dropdown-item item-delete" data-action="delete-document" data-doc-id="${doc.id}" data-stop-propagation="true">
                        &#128465;&#65039; ${context.i18n.t('delete')}
                    </button>`;
            }

            return `
                <tr style="cursor:pointer;" data-action="open-doc-detail" data-doc-id="${doc.id}">
                    <td style="text-align:center; color:var(--text-secondary); font-size:0.82rem; font-weight:700; width:48px;">${offset + index + 1}</td>
                    <td style="font-weight:700; color:var(--sidebar-bg);">${doc.soVanBan || '-'}</td>
                    <td>${formatDate(doc.ngayBanHanh)}</td>
                    <td><div ${doc.trichYeu ? `class="text-truncate-2" title="${escapeAttribute(doc.trichYeu)}"` : ''}>${doc.trichYeu || '-'}</div></td>
                    <td>${doc.coQuanChuQuan || ''}</td>
                    <td>${formatDate(doc.thoiHan)}</td>
                    <td><span class="badge ${getBadgeClass(doc.status, doc.soNgayConLai)}">${context.i18n.t(statusMap[doc.trangThai || doc.status] || (doc.trangThai || doc.status || ''))}</span></td>
                    <td data-stop-propagation="true" style="white-space:nowrap; text-align:center;">
                        <div class="action-dropdown" id="dropdown-${doc.id}">
                            <button class="action-trigger-btn" data-action="toggle-action-dropdown" data-doc-id="${doc.id}" data-stop-propagation="true">
                                ⚙️ ${context.i18n.t('actions')} ▾
                            </button>
                            <div class="action-dropdown-menu" id="dropdown-menu-${doc.id}">
                                ${menuItems}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const pageInfo = context.i18n.t('page_info', { current: page, total: totalPages });
        document.getElementById('docs-page-info').innerText = pageInfo;
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
        const confirmed = await context.ui.showConfirm(context.i18n.t('confirm_delete'));
        if (!confirmed) return;

        try {
            const response = await context.api.delete(`/api/documents/${id}`);
            if (!response.ok) {
                context.ui.showAlert(context.i18n.t('error_saving'), '❌');
                return;
            }

            await context.services.refreshCoreData();
        } catch (error) {
            context.ui.showAlert(context.i18n.t('error_saving'), '❌');
        }
    }

    async function loadStatusFilters() {
        const sel = document.getElementById('doc-status-filter');
        if (!sel) return;
        try {
            const allStatuses = Object.values(DOC_STATUS);
            let html = `<option value="">${context.i18n.t('all_status')}</option>`;

            allStatuses.forEach(s => {
                const i18nKey = statusMap[s.value] || `status_${s.value.toLowerCase().replace(/\s/g, '_')}`;
                const label = context.i18n.t(i18nKey);
                html += `<option value="${s.value}">${s.icon} ${label}</option>`;
            });

            html += `<option value="overdue">🛑 ${context.i18n.t('status_overdue')}</option>`;
            html += `<option value="urgent">🕒 ${context.i18n.t('status_urgent')}</option>`;
            html += `<option value="today">📅 ${context.i18n.t('status_today')}</option>`;

            sel.innerHTML = html;
        } catch (e) { console.error('Load status filters error:', e); }
    }

    return {
        init,
        activate() { },
        refresh,
        closeAllDropdowns
    };
}
