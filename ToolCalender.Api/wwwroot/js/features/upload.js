import { formatDate, formatDateForTextInput, normalizeDateInputToIso } from '../core/formatters.js';
import { initMultiSelect } from '../ui/multiSelect.js';

function normalizeBatchItem(doc, overrides = {}) {
    const fileName = overrides.fileName
        || (doc.filePath || '').replace(/\\/g, '/').split('/').pop()
        || doc.originalFileName
        || 'Tài liệu PDF';
    const hasError = doc.status === 'Lỗi OCR'
        || Boolean(doc.fullText && doc.fullText.includes('[OCR Total Error]'));

    // Multi-select support
    let assignedToIds = [];
    try {
        assignedToIds = JSON.parse(doc.assignedUserIds || doc.assignedToIds || '[]');
        if (doc.assignedTo && !assignedToIds.includes(doc.assignedTo)) {
            assignedToIds.push(doc.assignedTo);
        }
    } catch (e) { assignedToIds = []; }

    let departmentIds = [];
    try {
        departmentIds = JSON.parse(doc.assignedDepartmentIds || doc.departmentIds || '[]');
        if (doc.departmentId && !departmentIds.includes(doc.departmentId)) {
            departmentIds.push(doc.departmentId);
        }
    } catch (e) { departmentIds = []; }

    return {
        ...doc,
        fileName,
        hasError,
        assignedToIds,
        departmentIds,
        ocrWarnings: doc.ocrWarnings || [],
        suggestedDeptIds: overrides.batchState === 'Lỗi OCR' ? [] : [...departmentIds],
        suggestedUserIds: overrides.batchState === 'Lỗi OCR' ? [] : [...assignedToIds],
        batchState: overrides.batchState || (hasError ? 'Lỗi OCR' : (assignedToIds.length || departmentIds.length ? 'Sẵn sàng lưu' : 'Cần rà soát'))
    };
}

function shortenFileName(fileName, maxLength = 28) {
    const value = String(fileName || '').trim();
    if (!value || value.length <= maxLength) return value;

    const lastDotIndex = value.lastIndexOf('.');
    if (lastDotIndex <= 0 || lastDotIndex === value.length - 1) {
        return `${value.slice(0, maxLength - 1)}…`;
    }

    const ext = value.slice(lastDotIndex);
    const base = value.slice(0, lastDotIndex);
    const budget = Math.max(8, maxLength - ext.length - 1);
    return `${base.slice(0, budget)}…${ext}`;
}

export function createUploadFeature(context) {
    let sessionUploads = [];
    let batchPage = 1;
    const batchPageSize = 5;
    let editingDocId = null;
    let isSaving = false;
    let departments = [];
    let users = [];

    function buildDepartmentOptions() {
        return departments.map((department) => ({
            id: department.id,
            label: department.name
        }));
    }

    function buildUserOptions() {
        return users.map((user) => {
            const department = departments.find((item) => item.id === user.departmentId);
            const name = user.fullName || user.username;

            return {
                id: user.id,
                label: `${name} - ${department ? department.name.replace('Phòng ', '') : 'Vãng lai'}`,
                chipLabel: name
            };
        });
    }

    function initDepartmentMultiSelect(container, doc, onChange) {
        if (!container || !departments.length) return;

        initMultiSelect({
            container,
            options: buildDepartmentOptions(),
            selectedIds: doc.departmentIds || [],
            suggestedIds: doc.suggestedDeptIds || [],
            placeholder: 'Chọn đơn vị',
            onChange
        });
    }

    function initUserMultiSelect(container, doc, onChange) {
        if (!container || !users.length) return;

        initMultiSelect({
            container,
            options: buildUserOptions(),
            selectedIds: doc.assignedToIds || [],
            suggestedIds: doc.suggestedUserIds || [],
            placeholder: 'Chọn cán bộ',
            onChange
        });
    }

    function syncConfirmAllButtons() {
        const hasEnoughItems = sessionUploads.length >= 2;
        const hasSavableItems = sessionUploads.some((doc) => doc.batchState !== 'Đã lưu' && doc.batchState !== 'Lỗi OCR');

        document.querySelectorAll('[data-action="confirm-all-batch"]').forEach((button) => {
            button.style.display = hasEnoughItems ? 'inline-flex' : 'none';
            button.disabled = !hasSavableItems;
        });
    }

    function init() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const folderInput = document.getElementById('folder-input');

        dropZone?.addEventListener('dragover', (event) => {
            event.preventDefault();
            dropZone.style.background = 'rgba(55, 114, 255, 0.05)';
        });

        dropZone?.addEventListener('dragleave', () => {
            dropZone.style.background = 'rgba(255, 255, 255, 0.02)';
        });

        dropZone?.addEventListener('drop', async (event) => {
            event.preventDefault();
            dropZone.style.background = 'rgba(255, 255, 255, 0.02)';
            if (event.dataTransfer.files.length) {
                await handleFiles(event.dataTransfer.files);
            }
        });

        fileInput?.addEventListener('change', async () => {
            if (fileInput.files.length) {
                await handleFiles(fileInput.files);
                fileInput.value = '';
            }
        });

        folderInput?.addEventListener('change', async () => {
            if (folderInput.files.length) {
                await handleFiles(folderInput.files);
                folderInput.value = '';
            }
        });

        document.getElementById('tab-upload')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'open-file-input') {
                document.getElementById('file-input')?.click();
            }

            if (action.dataset.action === 'open-folder-input') {
                document.getElementById('folder-input')?.click();
            }

            if (action.dataset.action === 'confirm-all-batch') {
                await confirmAllBatch();
            }

            if (action.dataset.action === 'clear-batch') {
                await clearBatch();
            }

            if (action.dataset.action === 'prev-batch-page') {
                prevBatchPage();
            }

            if (action.dataset.action === 'next-batch-page') {
                nextBatchPage();
            }

            if (action.dataset.action === 'open-edit-modal') {
                openEditModal(parseInt(action.dataset.docId, 10));
            }

            if (action.dataset.action === 'preview-batch-item') {
                // Truyền doc.id dạng string để hỗ trợ cả ID thực (số) lẫn temp ID
                context.services.enterReviewScene(action.dataset.docId);
            }

            if (action.dataset.action === 'save-batch-item') {
                await saveBatchItem(parseInt(action.dataset.docId, 10));
            }

            if (action.dataset.action === 'delete-batch-item') {
                await deleteBatchItem(parseInt(action.dataset.docId, 10));
            }
        });

        document.getElementById('tab-upload')?.addEventListener('change', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement) && !(target instanceof HTMLInputElement && target.dataset.action === 'multi-select-option')) return;

            // Handle standard selects if any remain
            if (target instanceof HTMLSelectElement) {
                if (target.dataset.action === 'select-department') {
                    updateDepartmentSelection(parseDocId(target.dataset.docId), target.value);
                }
                if (target.dataset.action === 'select-assignee') {
                    updateAssigneeSelection(parseDocId(target.dataset.docId), target.value);
                }
            }
        });

        // Click outside to close multi-select-dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.multi-select-container') && !e.target.closest('.multi-select-dropdown')) {
                document.querySelectorAll('.multi-select-dropdown.active').forEach(d => d.classList.remove('active'));
            }
        });

        document.getElementById('edit-ocr-modal')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'close-edit-modal') {
                closeEditModal();
            }

            if (action.dataset.action === 'save-edit') {
                await saveEdit(action);
            }
        });
    }

    async function activate() {
        await ensureReferenceData();
    }

    async function ensureReferenceData() {
        if (departments.length && users.length) return;

        try {
            const [departmentResponse, userResponse] = await Promise.all([
                context.api.get('/api/admin/departments'),
                context.api.get('/api/users')
            ]);

            if (departmentResponse.ok) {
                departments = await departmentResponse.json();
            }

            if (userResponse.ok) {
                const payload = await userResponse.json();
                users = payload.filter((user) => user.role === 'CanBo');
            }
        } catch (error) {
            console.error('Reference data load error:', error);
        }
    }

    async function handleFiles(files) {
        await ensureReferenceData();

        document.getElementById('upload-processing').style.display = 'flex';
        document.getElementById('drop-zone').style.display = 'none';
        document.getElementById('batch-upload-result').style.display = 'none';

        const fileArray = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.pdf'));
        if (!fileArray.length) {
            context.ui.showAlert('Không tìm thấy file PDF hợp lệ để tải lên.');
            document.getElementById('upload-processing').style.display = 'none';
            document.getElementById('drop-zone').style.display = 'flex';
            return;
        }

        const processingInfo = document.getElementById('processing-file-count');
        const progressBar = document.getElementById('upload-progress-bar');
        const fileNameText = document.getElementById('processing-filename');

        let successCount = 0;
        progressBar.style.width = '0%';
        processingInfo.innerText = `Tìm thấy ${fileArray.length} file PDF. Bắt đầu xử lý...`;

        for (let index = 0; index < fileArray.length; index += 1) {
            const file = fileArray[index];
            const progress = Math.round((index / fileArray.length) * 100);
            progressBar.style.width = `${progress}%`;
            processingInfo.innerText = `Đang xử lý file ${index + 1} / ${fileArray.length}`;
            fileNameText.innerText = file.name;

            const tempId = `temp-${Date.now()}-${index}`;
            sessionUploads.push({
                id: tempId,
                fileName: file.name,
                soVanBan: '',
                tenCongVan: '',
                trichYeu: '',
                thoiHan: null,
                coQuanChuQuan: '',
                coQuanChuQuan: '',
                departmentIds: [],
                assignedToIds: [],
                ocrPagesJson: '[]',
                fullText: '',
                hasError: false,
                batchState: 'Đang OCR'
            });
            document.getElementById('batch-upload-result').style.display = 'block';
            renderBatchTable();

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await context.api.post('/api/documents/upload', {
                    body: formData
                });

                const tempIndex = sessionUploads.findIndex((item) => item.id === tempId);
                if (tempIndex === -1) continue;

                if (!response.ok) {
                    sessionUploads[tempIndex] = {
                        ...sessionUploads[tempIndex],
                        batchState: 'Lỗi OCR',
                        hasError: true,
                        fullText: '[OCR Total Error]'
                    };
                    renderBatchTable();
                    continue;
                }

                const doc = await response.json();
                sessionUploads[tempIndex] = normalizeBatchItem(doc, {
                    fileName: file.name,
                    batchState: doc.status === 'Lỗi OCR' || doc.fullText?.includes('[OCR Total Error]') ? 'Lỗi OCR' : 'Cần rà soát'
                });
                successCount += 1;
            } catch (error) {
                console.error(`Upload error for ${file.name}:`, error);
                const tempIndex = sessionUploads.findIndex((item) => item.id === tempId);
                if (tempIndex !== -1) {
                    sessionUploads[tempIndex] = {
                        ...sessionUploads[tempIndex],
                        batchState: 'Lỗi OCR',
                        hasError: true,
                        fullText: '[OCR Total Error]'
                    };
                }
            }

            renderBatchTable();
        }

        progressBar.style.width = '100%';
        processingInfo.innerText = `Hoàn tất xử lý ${successCount}/${fileArray.length} file.`;

        document.getElementById('upload-processing').style.display = 'none';
        document.getElementById('drop-zone').style.display = 'flex';

        if (!successCount && !sessionUploads.length) {
            context.ui.showAlert('Không thể tải lên bất kỳ file nào. Vui lòng kiểm tra lại kết nối hoặc định dạng file.', '❌');
            return;
        }

        batchPage = 1;
        document.getElementById('batch-upload-result').style.display = 'block';
        renderBatchTable();
        await context.services.refreshCoreData();
    }

    function renderBatchTable() {
        const tbody = document.querySelector('#batch-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const totalPages = Math.ceil(sessionUploads.length / batchPageSize) || 1;
        batchPage = Math.min(Math.max(batchPage, 1), totalPages);

        document.getElementById('batch-page-info').innerText = `Trang ${batchPage} / ${totalPages}`;
        document.getElementById('btn-prev-batch').disabled = batchPage === 1;
        document.getElementById('btn-next-batch').disabled = batchPage === totalPages;

        // Ẩn pagination nếu chỉ có 1 trang
        const paginationEl = document.querySelector('#batch-upload-result .pagination');
        if (paginationEl) {
            paginationEl.style.display = totalPages > 1 ? 'flex' : 'none';
        }

        syncConfirmAllButtons();

        const start = (batchPage - 1) * batchPageSize;
        const pageItems = sessionUploads.slice(start, start + batchPageSize);

        pageItems.forEach((doc) => {
            const isProcessing = doc.batchState === 'Đang OCR';
            const row = document.createElement('tr');
            row.setAttribute('data-row-id', doc.id);
            row.innerHTML = `
                <td>
                    <div class="batch-file-name" title="${escapeHtml(doc.fileName || 'Tài liệu PDF')}">${escapeHtml(shortenFileName(doc.fileName || 'Tài liệu PDF'))}</div>
                </td>
                <td>
                    ${isProcessing ? '<div class="skeleton-text"></div>' : `<input class="batch-inline-input ${doc.ocrWarnings?.some(w => w.includes('Số hiệu')) ? 'warning-border' : ''}" type="text" data-field="soVanBan" data-doc-id="${doc.id}" value="${escapeAttribute(doc.soVanBan || '')}" placeholder="Số hiệu">`}
                </td>
                <td>
                    ${isProcessing ? '<div class="skeleton-text"></div>' : `<input class="batch-inline-input ${doc.ocrWarnings?.some(w => w.includes('Hạn')) ? 'warning-border' : ''}" type="date" data-field="thoiHan" data-doc-id="${doc.id}" value="${doc.thoiHan ? doc.thoiHan.split('T')[0] : ''}">`}
                </td>
                <td>${isProcessing ? '<div class="skeleton-text"></div>' : `<div class="dept-select-container" id="dept-container-${doc.id}"></div>`}</td>
                <td>${isProcessing ? '<div class="skeleton-text"></div>' : `<div class="user-select-container" id="user-container-${doc.id}"></div>`}</td>
                <td>
                    <div class="batch-actions">
                        ${!isProcessing && doc.ocrWarnings && doc.ocrWarnings.length > 0 ? `
                        <button class="batch-action-btn batch-action-btn-warning" title="${escapeHtml(doc.ocrWarnings.join('\n'))}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </button>
                        ` : ''}
                        <button class="batch-action-btn batch-action-btn-preview" data-action="preview-batch-item" data-doc-id="${doc.id}" title="Xem trước" ${isProcessing ? 'disabled' : ''}>
                            ${renderBatchActionIcon('preview')}
                        </button>
                        <button class="batch-action-btn batch-action-btn-save" data-action="save-batch-item" data-doc-id="${doc.id}" ${canSave(doc) ? '' : 'disabled'} title="Lưu file">
                            ${renderBatchActionIcon('save')}
                        </button>
                        <button class="batch-action-btn batch-action-btn-delete" data-action="delete-batch-item" data-doc-id="${doc.id}" title="Xóa file">
                            ${renderBatchActionIcon('delete')}
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);

            if (!isProcessing) {
                const deptContainer = row.querySelector('.dept-select-container');
                const userContainer = row.querySelector('.user-select-container');
                if (deptContainer) {
                    initDepartmentMultiSelect(deptContainer, doc, (newIds) => processRowChange(doc.id, 'departmentIds', newIds));
                }
                if (userContainer) {
                    initUserMultiSelect(userContainer, doc, (newIds) => processRowChange(doc.id, 'assignedToIds', newIds));
                }
            }
        });

        tbody.querySelectorAll('[data-field]').forEach((input) => {
            input.addEventListener('change', (event) => {
                const docId = parseDocId(event.target.dataset.docId);
                const field = event.target.dataset.field;
                let value = event.target.value;
                if (field === 'thoiHan') value = value ? `${value}T00:00:00` : null;
                processRowChange(docId, field, value);
            });
        });
    }

    function buildBatchSummary() {
        const counts = {
            processing: sessionUploads.filter((item) => item.batchState === 'Đang OCR').length,
            review: sessionUploads.filter((item) => item.batchState === 'Cần rà soát').length,
            ready: sessionUploads.filter((item) => item.batchState === 'Sẵn sàng lưu').length,
            saved: sessionUploads.filter((item) => item.batchState === 'Đã lưu').length,
            failed: sessionUploads.filter((item) => item.batchState === 'Lỗi OCR').length
        };

        return [
            buildBatchSummaryChip('Đang OCR', counts.processing, 'processing'),
            buildBatchSummaryChip('Cần rà soát', counts.review, 'review'),
            buildBatchSummaryChip('Sẵn sàng lưu', counts.ready, 'ready'),
            buildBatchSummaryChip('Đã lưu', counts.saved, 'saved'),
            buildBatchSummaryChip('Lỗi OCR', counts.failed, 'failed')
        ].join('');
    }

    function processRowChange(docId, key, value) {
        const index = findItemIndex(docId);
        if (index === -1) return;

        let item = sessionUploads[index];
        const patch = {};
        patch[key] = value;
        item = applyPatch(item, patch);

        if (item.batchState !== 'Lỗi OCR' && item.batchState !== 'Đã lưu') {
            const hasAssign = (item.departmentIds && item.departmentIds.length > 0) || (item.assignedToIds && item.assignedToIds.length > 0);
            item = applyPatch(item, { batchState: hasAssign ? 'Sẵn sàng lưu' : 'Cần rà soát' });
        }

        sessionUploads[index] = item;
        updateRowUI(item);
    }

    function updateRowUI(item) {
        const row = document.querySelector(`tr[data-row-id="${item.id}"]`);
        if (!row) return;

        const statusSpan = row.querySelector('.status');
        if (statusSpan) {
            statusSpan.className = `status ${statusClass(item.batchState)}`;
            statusSpan.innerText = item.batchState;
        }

        const saveBtn = row.querySelector('.batch-action-btn-save');
        if (saveBtn) {
            saveBtn.disabled = !canSave(item);
        }

        document.getElementById('batch-summary').innerHTML = buildBatchSummary();
        syncConfirmAllButtons();
    }

    function buildBatchSummaryChip(label, count, tone) {
        return `
            <span class="batch-summary-chip batch-summary-chip-${tone}">
                <span class="batch-summary-chip-icon" aria-hidden="true">${renderBatchSummaryIcon(tone)}</span>
                <span class="batch-summary-chip-label">${label}</span>
                <strong>${count}</strong>
            </span>
        `;
    }

    function renderBatchSummaryIcon(tone) {
        if (tone === 'processing') {
            return '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"></path><path d="M12 7v5l3 3"></path></svg>';
        }

        if (tone === 'review') {
            return '<svg viewBox="0 0 24 24"><path d="M3 12s3.5 -6 9 -6s9 6 9 6s-3.5 6 -9 6s-9 -6 -9 -6"></path><path d="M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0 -6"></path></svg>';
        }

        if (tone === 'ready') {
            return '<svg viewBox="0 0 24 24"><path d="M6 4h11l3 3v13h-14z"></path><path d="M9 4v6h6"></path><path d="M9 18h6"></path></svg>';
        }

        if (tone === 'saved') {
            return '<svg viewBox="0 0 24 24"><path d="M7 12l3 3l7 -7"></path><path d="M5 21h14"></path></svg>';
        }

        return '<svg viewBox="0 0 24 24"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86l-7.27 12.6a2 2 0 0 0 1.73 3h14.5a2 2 0 0 0 1.73 -3l-7.26 -12.6a2 2 0 0 0 -3.46 0z"></path></svg>';
    }

    function renderBatchActionIcon(type) {
        if (type === 'preview') {
            return '<svg class="batch-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5 -6 9 -6s9 6 9 6s-3.5 6 -9 6s-9 -6 -9 -6"></path><path d="M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0 -6"></path></svg>';
        }

        if (type === 'save') {
            return '<svg class="batch-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h11l3 3v13h-14z"></path><path d="M9 4v6h6"></path><path d="M9 18h6"></path></svg>';
        }

        return '<svg class="batch-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"></path><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"></path></svg>';
    }



    function updateDepartmentSelection(docId, rawValue) {
        // Fallback for any legacy calls
        const index = findItemIndex(docId);
        if (index === -1) return;
        const id = parseInt(rawValue, 10);
        if (isNaN(id)) return;
        toggleSelection(docId, 'dept', id, true);
    }

    function updateAssigneeSelection(docId, rawValue) {
        // Fallback for any legacy calls
        const index = findItemIndex(docId);
        if (index === -1) return;
        const id = parseInt(rawValue, 10);
        if (isNaN(id)) return;
        toggleSelection(docId, 'user', id, true);
    }

    async function clearBatch() {
        if (!sessionUploads.length) {
            document.getElementById('batch-upload-result').style.display = 'none';
            return;
        }

        const confirmed = await context.ui.showConfirm('Bạn có chắc chắn muốn hủy đợt bóc tách này? Thao tác này sẽ xóa vĩnh viễn các văn bản khỏi hệ thống.');
        if (!confirmed) return;

        try {
            const response = await context.api.delete('/api/documents/bulk-delete', {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionUploads.filter((doc) => Number.isInteger(doc.id)).map((doc) => doc.id))
            });

            if (!response.ok) {
                context.ui.showAlert('Lỗi khi xóa.', '❌');
                return;
            }

            context.ui.showAlert(`Đã hủy và xóa ${sessionUploads.length} văn bản khỏi hệ thống.`, '✅');
            sessionUploads = [];
            document.getElementById('batch-upload-result').style.display = 'none';
            batchPage = 1;
            await context.services.refreshCoreData();
        } catch (error) {
            context.ui.showAlert('Lỗi kết nối khi thực hiện xóa.', '❌');
        }
    }

    async function confirmAllBatch() {
        const saveTargets = sessionUploads.filter((doc) => doc.batchState !== 'Đã lưu' && doc.batchState !== 'Lỗi OCR');
        if (!saveTargets.length) {
            context.ui.showAlert('Không có file hợp lệ để lưu.', '⚠️');
            return;
        }

        const confirmed = await context.ui.showConfirm(`Xác nhận lưu ${saveTargets.length} văn bản hợp lệ trong đợt này?`);
        if (!confirmed) return;

        let success = 0;
        let failed = 0;
        for (const doc of saveTargets) {
            const result = await saveBatchItem(doc.id, { silent: true });
            if (result) success += 1;
            else failed += 1;
        }

        renderBatchTable();
        await context.services.refreshCoreData();
        context.ui.showAlert(`Đã lưu ${success} file. Thất bại ${failed} file.`, failed ? '⚠️' : '✅');
    }

    async function saveBatchItem(docId, { silent = false } = {}) {
        const index = findItemIndex(docId);
        if (index === -1) return false;
        const item = sessionUploads[index];

        if (!canSave(item)) {
            if (!silent) {
                context.ui.showAlert('Cần chọn phòng ban hoặc cán bộ trước khi lưu.', '⚠️');
            }
            return false;
        }

        const payload = {
            ...item,
            status: 'Chưa xử lý'
        };

        try {
            const updateResponse = await context.api.put(`/api/documents/${item.id}`, {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!updateResponse.ok) {
                throw new Error('Không thể cập nhật thông tin văn bản');
            }

            if (item.departmentIds?.length || item.assignedToIds?.length) {
                const assignResponse = await context.api.post(`/api/documents/${item.id}/assign`, {
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        departmentIds: item.departmentIds || [],
                        userIds: item.assignedToIds || []
                    })
                });

                if (!assignResponse.ok) {
                    throw new Error('Không thể điều phối văn bản');
                }
            }

            sessionUploads[index] = applyPatch(item, { batchState: 'Đã lưu' });
            if (!silent) {
                context.ui.showAlert('Đã lưu và điều phối văn bản thành công.', '✅');
            }
            return true;
        } catch (error) {
            if (!silent) {
                context.ui.showAlert(`Lỗi khi lưu: ${error.message}`, '❌');
            }
            return false;
        }
    }

    async function deleteBatchItem(docId) {
        const index = findItemIndex(docId);
        if (index === -1) return;

        const confirmed = await context.ui.showConfirm('Xóa file này khỏi danh sách và hệ thống?');
        if (!confirmed) return;

        const item = sessionUploads[index];
        if (Number.isInteger(item.id)) {
            const response = await context.api.delete('/api/documents/bulk-delete', {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([item.id])
            });

            if (!response.ok) {
                context.ui.showAlert('Lỗi khi xóa file.', '❌');
                return;
            }
        }

        sessionUploads.splice(index, 1);
        if (!sessionUploads.length) {
            document.getElementById('batch-upload-result').style.display = 'none';
        }
        renderBatchTable();
        await context.services.refreshCoreData();
    }

    function prevBatchPage() {
        if (batchPage > 1) {
            batchPage -= 1;
            renderBatchTable();
        }
    }

    function nextBatchPage() {
        const totalPages = Math.ceil(sessionUploads.length / batchPageSize);
        if (batchPage < totalPages) {
            batchPage += 1;
            renderBatchTable();
        }
    }

    function openEditModal(id) {
        const doc = sessionUploads.find((item) => item.id === id);
        if (!doc) return;

        editingDocId = id;
        document.getElementById('ocr-so').value = doc.soVanBan || '';
        document.getElementById('ocr-so').className = `modal-input ${doc.ocrWarnings?.some(w => w.includes('Số hiệu')) ? 'warning-border' : ''}`;

        document.getElementById('ocr-trichyeu').value = doc.trichYeu || '';
        document.getElementById('ocr-trichyeu').className = `modal-textarea ${doc.ocrWarnings?.some(w => w.includes('Trích yếu')) ? 'warning-border' : ''}`;

        document.getElementById('ocr-coquan').value = doc.coQuanChuQuan || '';

        document.getElementById('ocr-han').value = formatDateForTextInput(doc.thoiHan);
        document.getElementById('ocr-han').className = `modal-input ${doc.ocrWarnings?.some(w => w.includes('Hạn')) ? 'warning-border' : ''}`;

        const deptContainer = document.getElementById('modal-dept-container');
        initDepartmentMultiSelect(deptContainer, doc, (newIds) => {
            processRowChange(id, 'departmentIds', newIds);
        });

        const userContainer = document.getElementById('modal-user-container');
        initUserMultiSelect(userContainer, doc, (newIds) => {
            processRowChange(id, 'assignedToIds', newIds);
        });

        const modalBody = document.querySelector('#edit-ocr-modal .modal-body');
        if (modalBody) {
            let warnDiv = document.getElementById('edit-modal-warnings');
            if (!warnDiv) {
                warnDiv = document.createElement('div');
                warnDiv.id = 'edit-modal-warnings';
                modalBody.insertBefore(warnDiv, modalBody.firstChild);
            }
            if (doc.ocrWarnings && doc.ocrWarnings.length > 0) {
                warnDiv.innerHTML = `<div class="modal-warning-box" style="background:#fef2f2; border-left:4px solid #ef4444; padding:8px 12px; margin-bottom:15px; border-radius:4px;">
                    <strong style="color:#b91c1c;">⚠️ Cảnh báo OCR:</strong><br/>
                    <div style="color:#991b1b; font-size:0.9rem; margin-top:4px;">${doc.ocrWarnings.map(w => `- ${escapeHtml(w)}`).join('<br/>')}</div>
                </div>`;
                warnDiv.style.display = 'block';
            } else {
                warnDiv.style.display = 'none';
            }
        }

        document.getElementById('edit-ocr-modal').style.display = 'flex';
    }

    function closeEditModal() {
        document.getElementById('edit-ocr-modal').style.display = 'none';
        editingDocId = null;
    }

    async function saveEdit(button) {
        if (isSaving || !editingDocId) return;

        const docIndex = findItemIndex(editingDocId);
        if (docIndex === -1) return;

        isSaving = true;
        const originalText = button.innerText;
        button.disabled = true;
        button.innerText = 'Đang lưu...';

        const normalizedDeadline = normalizeDateInputToIso(document.getElementById('ocr-han').value);

        sessionUploads[docIndex] = applyPatch(sessionUploads[docIndex], {
            soVanBan: document.getElementById('ocr-so').value,
            trichYeu: document.getElementById('ocr-trichyeu').value,
            coQuanChuQuan: document.getElementById('ocr-coquan').value,
            thoiHan: normalizedDeadline ? `${normalizedDeadline}T00:00:00` : null
        });

        try {
            renderBatchTable();
            closeEditModal();
        } finally {
            isSaving = false;
            button.disabled = false;
            button.innerText = originalText;
        }
    }

    function getSessionUploads() {
        return sessionUploads;
    }

    function updateSessionUpload(docId, patch) {
        const index = findItemIndex(docId);
        if (index !== -1) {
            sessionUploads[index] = applyPatch(sessionUploads[index], patch);
            renderBatchTable();
        }
    }

    function getItem(docId) {
        return sessionUploads.find((item) => String(item.id) === String(docId)) || null;
    }

    function getFirstReviewableDocId() {
        return sessionUploads.find((item) => item.batchState !== 'Lỗi OCR' && item.batchState !== 'Đã lưu')?.id
            ?? sessionUploads.find((item) => item.batchState !== 'Lỗi OCR')?.id
            ?? null;
    }

    function getReferenceData() {
        return { departments, users };
    }

    function getUsersForDepartment(departmentId) {
        if (!departmentId) return users;
        return users.filter((user) => user.departmentId === departmentId);
    }

    function parseDocId(value) {
        return /^\d+$/.test(String(value)) ? parseInt(value, 10) : value;
    }

    function findItemIndex(docId) {
        return sessionUploads.findIndex((item) => String(item.id) === String(docId));
    }

    function canSave(item) {
        return item.batchState !== 'Đang OCR' && item.batchState !== 'Lỗi OCR';
    }

    function applyPatch(item, patch) {
        const merged = {
            ...item,
            ...patch
        };

        // If a user is selected, ensure their department is also in the selected departments (optional logic)
        /*
        if (patch.assignedToIds) {
            patch.assignedToIds.forEach(uid => {
                const u = users.find(x => x.id === uid);
                if (u && u.departmentId && !merged.departmentIds.includes(u.departmentId)) {
                    merged.departmentIds.push(u.departmentId);
                }
            });
        }
        */

        if (merged.batchState !== 'Đã lưu' && merged.batchState !== 'Đang OCR' && merged.batchState !== 'Lỗi OCR') {
            merged.batchState = (merged.departmentIds?.length || merged.assignedToIds?.length) ? 'Sẵn sàng lưu' : 'Cần rà soát';
        }

        return merged;
    }

    function statusClass(batchState) {
        if (batchState === 'Đã lưu') return 'bg-success';
        if (batchState === 'Lỗi OCR') return 'bg-danger';
        if (batchState === 'Sẵn sàng lưu') return 'bg-success';
        return 'bg-warning';
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function escapeAttribute(value) {
        return escapeHtml(value);
    }

    return {
        init,
        activate,
        handleFiles,
        renderBatchTable,
        getSessionUploads,
        updateSessionUpload,
        clearBatch,
        confirmAllBatch,
        saveBatchItem,
        deleteBatchItem,
        getItem,
        getFirstReviewableDocId,
        getReferenceData,
        getUsersForDepartment
    };
}
