import { escapeAttribute } from '../core/dom.js';
import { escapeHtml, formatDate, formatDateForTextInput, normalizeDateInputToIso } from '../core/formatters.js';
import { DOC_STATUS, getStatusConfig } from '../core/constants.js';

export function createDocDetailFeature(context) {
    let currentDocId = null;
    let currentDocData = null;
    let isStatusOptionsLoaded = false;
    let statusOptions = ['Chưa xử lý', 'Đang xử lý', 'Hoàn thành', 'Quá hạn'];
    let selectedFiles = [];

    function init() {
        // === DESKTOP MODAL ===
        const modal = document.getElementById('doc-detail-modal');
        if (modal) {
            modal.addEventListener('click', async (event) => {
                const action = event.target.closest('[data-action]');
                if (!action) return;
                const actionName = action.dataset.action;
                if (actionName === 'close-doc-detail-modal') close();
                if (actionName === 'switch-doc-tab') switchTab(action.dataset.docTab);
                if (actionName === 'save-doc-detail') await saveDetail(action);
                if (actionName === 'submit-comment') await submitComment(action);
                if (actionName === 'delete-comment') await deleteComment(parseInt(action.dataset.commentId, 10));
                if (actionName === 'toggle-reaction') await toggleReaction(parseInt(action.dataset.commentId, 10), action.dataset.reactionType);
                if (actionName === 'open-pdf') await context.services.openPdfPreview(parseInt(action.dataset.docId, 10), action.dataset.title || '');
            });
            modal.addEventListener('change', (event) => {
                if (event.target.id === 'de-status') onStatusSelectChange();
            });
        }

        // === MOBILE PAGE ===
        const page = document.getElementById('doc-detail-page');
        if (page) {
            page.addEventListener('click', async (event) => {
                const action = event.target.closest('[data-action]');
                if (!action) return;
                const actionName = action.dataset.action;
                if (actionName === 'close-doc-detail-page') closePage();
                if (actionName === 'switch-doc-page-tab') switchPageTab(action.dataset.pageTab);
                if (actionName === 'doc-page-pdf-prev') await prevPdfPage();
                if (actionName === 'doc-page-pdf-next') await nextPdfPage();
                if (actionName === 'save-doc-page-detail') await saveDetail(action, true);
                if (actionName === 'submit-comment') await submitComment(action);
                if (actionName === 'delete-comment') await deleteComment(parseInt(action.dataset.commentId, 10));
                if (actionName === 'toggle-reaction') await toggleReaction(parseInt(action.dataset.commentId, 10), action.dataset.reactionType);
                if (actionName === 'open-pdf') {
                    switchPageTab('content');
                }
            });
            page.addEventListener('change', (event) => {
                if (event.target.id === 'de-status') onStatusSelectChange();
            });
        }

        // File attach - Desktop Modal
        const attachBtn = document.getElementById('btn-comment-attach');
        const fileInput = document.getElementById('comment-file-input');
        if (attachBtn && fileInput) {
            attachBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                const files = Array.from(e.target.files);
                selectedFiles = [...selectedFiles, ...files];
                renderFilePreview();
                fileInput.value = '';
            };
        }

        // File attach - Mobile Page (IDs trên mobile có prefix "page-")
        const pageAttachBtn = document.getElementById('page-btn-comment-attach');
        const pageFileInput = document.getElementById('page-comment-file-input');
        if (pageAttachBtn && pageFileInput) {
            pageAttachBtn.onclick = () => pageFileInput.click();
            pageFileInput.onchange = (e) => {
                const files = Array.from(e.target.files);
                selectedFiles = [...selectedFiles, ...files];
                renderFilePreview();
                pageFileInput.value = '';
            };
        }

        // Real-time listeners
        document.addEventListener('realtime:new_comment', (e) => {
            if (currentDocId === e.detail.documentId) loadComments();
        });
        document.addEventListener('realtime:delete_comment', (e) => {
            if (currentDocId === e.detail.documentId) loadComments();
        });
        document.addEventListener('realtime:comment_reaction', (e) => {
            if (currentDocId === e.detail.documentId) {
                updateReactionBar(e.detail.commentId, e.detail.reactions);
            }
        });
    }

    /** Detect mobile: dùng page trượt; desktop: dùng modal */
    function isMobileView() {
        return window.innerWidth <= 768;
    }

    async function open(id, initialTab = 'view') {
        currentDocId = id;
        if (isMobileView()) {
            await openPage(id, initialTab);
        } else {
            await openModal(id, initialTab);
        }
    }

    async function openModal(id, initialTab = 'view') {
        currentDocId = id;
        resetUI();
        document.getElementById('doc-detail-modal').style.display = 'flex';
        switchTab(initialTab);
        try {
            const tasks = [
                context.api.get(`/api/documents/${id}`),
                loadComments()
            ];
            if (!isStatusOptionsLoaded) tasks.push(loadStatusOptions());
            const results = await Promise.all(tasks);
            const docResponse = results[0];
            if (!docResponse.ok) throw new Error('Failed to fetch doc');
            currentDocData = await docResponse.json();
            renderDetail(currentDocData);
            const role = localStorage.getItem('user_role');
            document.getElementById('doc-tab-edit').style.display = (role === 'Admin' || role === 'VanThu') ? '' : 'none';
        } catch (error) {
            console.error('Document detail load error:', error);
            context.ui.showAlert(context.i18n.t('error_load_failed'), '❌');
            close();
        }
    }

    async function openPage(id, initialTab = 'view') {
        currentDocId = id;
        const page = document.getElementById('doc-detail-page');
        if (!page) return openModal(id, initialTab); // fallback

        // Reset page UI
        const titleEl = document.getElementById('doc-page-title');
        const subEl = document.getElementById('doc-page-subtitle');
        if (titleEl) titleEl.textContent = 'Đang tải...';
        if (subEl) subEl.textContent = '';

        // Show page with slide animation
        page.style.display = 'flex';
        requestAnimationFrame(() => requestAnimationFrame(() => page.classList.add('open')));
        switchPageTab(initialTab);

        // Re-init Lucide icons for back button
        if (window.lucide) window.lucide.createIcons();

        try {
            const tasks = [
                context.api.get(`/api/documents/${id}`),
                loadComments()
            ];
            if (!isStatusOptionsLoaded) tasks.push(loadStatusOptions());
            const results = await Promise.all(tasks);
            const docResponse = results[0];
            if (!docResponse.ok) throw new Error('Failed');
            currentDocData = await docResponse.json();
            renderDetailPage(currentDocData);
            renderDetail(currentDocData); // keep modal IDs in sync for save logic

            const role = localStorage.getItem('user_role');
            const editBtn = document.getElementById('doc-page-edit-btn');
            const editTab = document.getElementById('doc-page-tab-edit');
            const canEdit = (role === 'Admin' || role === 'VanThu');
            if (editBtn) editBtn.style.display = canEdit ? 'block' : 'none';
            if (editTab) editTab.style.display = canEdit ? '' : 'none';
        } catch (error) {
            console.error('Page load error:', error);
            context.ui.showAlert(context.i18n.t('error_load_failed'), '❌');
            closePage();
        }
    }

    function closePage() {
        const page = document.getElementById('doc-detail-page');
        if (!page) return;
        page.classList.remove('open');
        setTimeout(() => { page.style.display = 'none'; }, 340);

        // Clean up PDF resources
        if (pdfDoc) {
            void context.services.pdf.cancelRender('doc-page-pdf-canvas');
            pdfDoc = null;
        }

        currentDocId = null;
        currentDocData = null;
    }

    let pdfDoc = null;
    let pdfPageNum = 1;

    async function switchPageTab(tab) {
        ['view', 'content', 'edit', 'comments'].forEach(t => {
            const panel = document.getElementById(`doc-page-panel-${t}`);
            const tabBtn = document.getElementById(`doc-page-tab-${t}`);
            if (panel) panel.style.display = t === tab ? 'flex' : 'none';
            if (tabBtn) tabBtn.classList.toggle('active', t === tab);
        });

        if (tab === 'content') {
            await loadPdfContent();
        }

        // Sync comment list when switching to comments tab
        if (tab === 'comments') {
            const desktopList = document.getElementById('comment-list');
            const mobileList = document.getElementById('doc-page-comment-list');
            if (desktopList && mobileList) {
                mobileList.innerHTML = desktopList.innerHTML;
            }
        }
    }

    async function loadPdfContent() {
        if (!currentDocData || !currentDocData.filePath) {
            document.getElementById('doc-page-pdf-tools').style.display = 'none';
            document.getElementById('doc-page-content-empty').style.display = 'block';
            return;
        }

        const isPdf = currentDocData.filePath.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            document.getElementById('doc-page-pdf-tools').style.display = 'none';
            document.getElementById('doc-page-content-empty').style.display = 'block';
            return;
        }

        if (pdfDoc) return; // Already loaded

        const loader = document.getElementById('doc-page-pdf-loader');
        if (loader) loader.style.display = 'flex';
        document.getElementById('doc-page-content-empty').style.display = 'none';

        try {
            pdfDoc = await context.services.pdf.getDocument(`/api/documents/${currentDocId}/file`);
            pdfPageNum = 1;
            document.getElementById('doc-page-pdf-tools').style.display = 'flex';
            await renderPdfPage();
        } catch (error) {
            console.error('PDF load error:', error);
            document.getElementById('doc-page-content-empty').style.display = 'block';
        } finally {
            if (loader) loader.style.display = 'none';
        }
    }

    async function renderPdfPage() {
        if (!pdfDoc) return;
        await context.services.pdf.renderPage(pdfDoc, pdfPageNum, 'doc-page-pdf-canvas', 'doc-page-pdf-info');
    }

    async function prevPdfPage() {
        if (pdfDoc && pdfPageNum > 1) {
            pdfPageNum--;
            await renderPdfPage();
        }
    }

    async function nextPdfPage() {
        if (pdfDoc && pdfPageNum < pdfDoc.numPages) {
            pdfPageNum++;
            await renderPdfPage();
        }
    }

    function renderDetailPage(doc) {
        // Title bar
        const titleEl = document.getElementById('doc-page-title');
        const subEl = document.getElementById('doc-page-subtitle');
        if (titleEl) titleEl.textContent = doc.soVanBan || 'Chi tiết văn bản';
        if (subEl) subEl.textContent = doc.trichYeu ? doc.trichYeu.substring(0, 60) + (doc.trichYeu.length > 60 ? '...' : '') : '';

        // Overview chips
        const chipsEl = document.getElementById('doc-page-chips');
        if (chipsEl) {
            const statusConfig = getStatusConfig(doc.status);
            const priorityColor = doc.priority === 'Thượng khẩn' ? '#c0392b' : doc.priority === 'Khẩn' ? '#d68910' : '#1a3a6e';

            // Giả lập màu hex từ class badge (vì mobile dùng style inline)
            let sColor = '#64748b'; // mặc định
            if (statusConfig.badgeClass === 'badge-success') sColor = '#10b981';
            if (statusConfig.badgeClass === 'badge-danger') sColor = '#ef4444';
            if (statusConfig.badgeClass === 'badge-warning') sColor = '#f59e0b';

            chipsEl.innerHTML = `
                <span class="doc-page-chip" style="background:${sColor}22; color:${sColor};">${statusConfig.icon} ${doc.trangThai || doc.status || 'Chưa xử lý'}</span>
                <span class="doc-page-chip" style="background:${priorityColor}22; color:${priorityColor};">⚡ ${doc.priority || 'Thường'}</span>
            `;
        }

        // Field rows
        function setField(id, value) {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = `<span class="doc-page-field-value">${value || '-'}</span>`;
        }
        setField('dpf-so', doc.soVanBan);
        setField('dpf-ngaybanhanh', formatDate(doc.ngayBanHanh));
        setField('dpf-trichyeu', doc.trichYeu);
        setField('dpf-coquanbanhanh', doc.coQuanBanHanh);
        setField('dpf-coquanchuquan', doc.coQuanChuQuan);
        setField('dpf-thoihan', formatDate(doc.thoiHan));
        setField('dpf-status', doc.status);
        setField('dpf-priority', doc.priority);
        setField('dpf-ngaythem', formatDate(doc.ngayThem));

        // Sync inputs for mobile edit tab
        const mFields = {
            'mde-so': doc.soVanBan || '',
            'mde-ngaybanhanh': doc.ngayBanHanh ? doc.ngayBanHanh.split('T')[0] : '',
            'mde-trichyeu': doc.trichYeu || '',
            'mde-coquanbanhanh': doc.coQuanBanHanh || '',
            'mde-coquanchuquan': doc.coQuanChuQuan || '',
            'mde-thoihan': formatDateForTextInput(doc.thoiHan),
            'mde-priority': doc.priority || 'Thường'
        };
        Object.keys(mFields).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = mFields[id];
        });

        // Handle mobile status
        const mStatus = document.getElementById('mde-status');
        const mCustom = document.getElementById('mde-status-custom');
        if (mStatus && mCustom) {
            const val = doc.status || 'Chưa xử lý';
            if (statusOptions.includes(val)) {
                mStatus.value = val;
                mCustom.style.display = 'none';
                mCustom.value = '';
            } else {
                mStatus.value = '__custom__';
                mCustom.style.display = 'block';
                mCustom.value = val;
            }
            mStatus.onchange = () => {
                mCustom.style.display = mStatus.value === '__custom__' ? 'block' : 'none';
                if (mStatus.value === '__custom__') mCustom.focus();
            };
        }

        // File
        const fileEl = document.getElementById('doc-page-file-content');
        if (fileEl) {
            if (doc.filePath) {
                const isPdf = doc.filePath.toLowerCase().endsWith('.pdf');
                if (isPdf) {
                    fileEl.innerHTML = `<button class="btn btn-primary" style="border-radius:12px; width:100%;" data-action="open-pdf" data-doc-id="${doc.id}" data-title="${doc.soVanBan || ''}">📄 ${context.i18n.t('view_pdf_content')}</button>`;
                } else {
                    fileEl.innerHTML = `<a class="btn" style="background:#10b981; color:white; border-radius:12px; width:100%; text-decoration:none; display:block; text-align:center;" href="/api/documents/${doc.id}/file" target="_blank">📝 Tải xuống văn bản (Word)</a>`;
                }
            } else {
                fileEl.innerHTML = '<i style="color:#94a3b8; font-size:0.85rem;">Không có tệp đính kèm</i>';
            }
        }
    }

    function resetUI() {
        document.getElementById('doc-modal-title').innerText = 'Đang tải...';
        document.getElementById('doc-modal-subtitle').innerText = '';
        const fields = ['dv-so', 'dv-ngaybanhanh', 'dv-trichyeu', 'dv-coquanbanhanh', 'dv-coquanchuquan', 'dv-thoihan', 'dv-status', 'dv-priority', 'dv-ngaythem'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<span class="skeleton-text"></span>';
        });
        document.getElementById('comment-list').innerHTML = '<div class="loader-inner"></div>';
        document.getElementById('dv-view-pdf').innerHTML = '';
        document.getElementById('dv-evidence').innerHTML = '';
    }

    function close() {
        document.getElementById('doc-detail-modal').style.display = 'none';
        currentDocId = null;
        currentDocData = null;
    }

    function renderDetail(doc) {
        document.getElementById('doc-modal-title').innerText = doc.soVanBan || 'Chi tiet van ban';
        document.getElementById('doc-modal-subtitle').innerText = doc.trichYeu
            ? doc.trichYeu.substring(0, 80) + (doc.trichYeu.length > 80 ? '...' : '')
            : '';

        document.getElementById('dv-so').innerText = doc.soVanBan || '-';
        document.getElementById('dv-ngaybanhanh').innerText = formatDate(doc.ngayBanHanh);
        document.getElementById('dv-trichyeu').innerText = doc.trichYeu || '-';
        document.getElementById('dv-coquanbanhanh').innerText = doc.coQuanBanHanh || '-';
        document.getElementById('dv-coquanchuquan').innerText = doc.coQuanChuQuan || '-';
        document.getElementById('dv-thoihan').innerText = formatDate(doc.thoiHan);
        document.getElementById('dv-status').innerText = doc.status || '-';
        document.getElementById('dv-priority').innerText = doc.priority || '-';
        document.getElementById('dv-ngaythem').innerText = formatDate(doc.ngayThem);
        if (doc.filePath) {
            const isPdf = doc.filePath.toLowerCase().endsWith('.pdf');
            if (isPdf) {
                document.getElementById('dv-view-pdf').innerHTML = `<button class="btn btn-sm btn-primary" data-action="open-pdf" data-doc-id="${doc.id}" data-title="${escapeAttribute(doc.soVanBan || '')}">📄 ${context.i18n.t('view_pdf_content')}</button>`;
            } else {
                document.getElementById('dv-view-pdf').innerHTML = `<a class="btn btn-sm" style="background:#10b981; color:white; display:inline-block; text-decoration:none; padding: 6px 12px; border-radius:6px; font-size:0.85rem;" href="/api/documents/${doc.id}/file" target="_blank">📝 Tai xuong van ban (Word)</a>`;
            }
        } else {
            document.getElementById('dv-view-pdf').innerHTML = '<i style="color:#94a3b8; font-size:0.85rem;">Khong co tep dinh kem</i>';
        }

        renderEvidence(doc);

        document.getElementById('de-so').value = doc.soVanBan || '';
        document.getElementById('de-ngaybanhanh').value = doc.ngayBanHanh ? doc.ngayBanHanh.split('T')[0] : '';
        document.getElementById('de-trichyeu').value = doc.trichYeu || '';
        document.getElementById('de-coquanbanhanh').value = doc.coQuanBanHanh || '';
        document.getElementById('de-coquanchuquan').value = doc.coQuanChuQuan || '';
        document.getElementById('de-thoihan').value = formatDateForTextInput(doc.thoiHan);
        document.getElementById('de-priority').value = doc.priority || 'Thường';

        // Đặt giá trị trạng thái: nếu không nằm trong danh sách → dùng custom input
        setStatusValue(doc.status || 'Chưa xử lý');
    }

    function renderEvidence(doc) {
        let html = '';
        if (doc.evidencePaths && doc.evidencePaths !== '[]') {
            try {
                const paths = JSON.parse(doc.evidencePaths);
                html += '<div style="margin-top:10px; padding:12px; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1;">';
                html += `<p style="font-size:0.85rem; font-weight:700; color:#334155; margin-bottom:8px;">Bang chung xu ly (Nop luc ${doc.completionDate ? formatDate(doc.completionDate) : 'Chua ro'})</p>`;
                if (doc.evidenceNotes) {
                    html += `<p style="font-size:0.85rem; margin-bottom:12px; color:#475569;">Ghi chu: ${doc.evidenceNotes}</p>`;
                }
                html += '<div style="display:flex; gap:10px; flex-wrap:wrap;">';
                paths.forEach((path, index) => {
                    const ext = path.toLowerCase().split('.').pop();
                    let icon = '🖼️ Anh';
                    if (ext === 'pdf') icon = '📄 PDF';
                    if (ext === 'doc' || ext === 'docx') icon = '📝 Word';
                    html += `<a href="/api/documents/${doc.id}/evidence/${index}" target="_blank" style="padding:6px 14px; background:#3b82f6; color:white; border-radius:6px; font-size:0.8rem; text-decoration:none; display:flex; align-items:center; gap:6px;">${icon} Bang chung ${index + 1}</a>`;
                });
                html += '</div></div>';
            } catch (error) {
                console.error('Evidence parse error:', error);
            }
        }

        document.getElementById('dv-evidence').innerHTML = html;
    }

    // ─── Status helpers ───────────────────────────────────────────────────

    /** Tải danh sách trạng thái từ hằng số hệ thống và cập nhật select */
    async function loadStatusOptions() {
        if (isStatusOptionsLoaded) return;

        // Chuyển đối tượng DOC_STATUS thành mảng các giá trị
        const statusList = Object.values(DOC_STATUS);
        statusOptions = statusList.map(s => s.value);

        const sel = document.getElementById('de-status');
        if (!sel) return;

        sel.innerHTML = statusList.map(s =>
            `<option value="${s.value}">${s.icon} ${s.label}</option>`
        ).join('') + `<option value="__custom__">✏️ Tùy chỉnh...</option>`;

        isStatusOptionsLoaded = true;

        // Gán trực tiếp onchange đảm bảo 100% hoạt động
        sel.onchange = onStatusSelectChange;
    }

    /** Gán giá trị: nếu value không có trong danh sách → hiện custom input */
    function setStatusValue(val) {
        const sel = document.getElementById('de-status');
        const customInput = document.getElementById('de-status-custom');
        if (!sel || !customInput) return;

        if (statusOptions.includes(val)) {
            sel.value = val;
            customInput.style.display = 'none';
            customInput.value = '';
        } else {
            sel.value = '__custom__';
            customInput.style.display = 'block';
            customInput.value = val;
        }
    }

    /** Đọc giá trị thực từ select hoặc custom input */
    function getStatusValue() {
        const sel = document.getElementById('de-status');
        if (sel?.value === '__custom__') {
            return document.getElementById('de-status-custom')?.value?.trim() || 'Chưa xử lý';
        }
        return sel?.value || 'Chưa xử lý';
    }

    /** Hiện/ẩn custom input khi thay đổi select */
    function onStatusSelectChange() {
        const customInput = document.getElementById('de-status-custom');
        if (!customInput) return;
        const isCustom = document.getElementById('de-status')?.value === '__custom__';
        customInput.style.display = isCustom ? 'block' : 'none';
        if (isCustom) customInput.focus();
    }

    // ─────────────────────────────────────────────────────────────────────

    function switchTab(tab) {
        ['view', 'edit', 'comments'].forEach((panel) => {
            document.getElementById(`doc-panel-${panel}`).style.display = panel === tab ? 'block' : 'none';
            document.getElementById(`doc-tab-${panel}`)?.classList.toggle('doc-modal-tab-active', panel === tab);
        });
    }

    async function saveDetail(button) {
        if (!currentDocId || !currentDocData) return;

        const originalText = button.innerText;
        button.disabled = true;
        button.innerText = 'Đang lưu...';

        const isMobile = !!button.closest('#doc-detail-page');
        const p = isMobile ? 'mde-' : 'de-';

        const getStatus = () => {
            const sel = document.getElementById(`${p}status`);
            if (sel?.value === '__custom__') {
                return document.getElementById(`${p}status-custom`)?.value?.trim() || 'Chưa xử lý';
            }
            return sel?.value || 'Chưa xử lý';
        };

        const soVanBan = document.getElementById(`${p}so`).value.trim();
        const trichYeu = document.getElementById(`${p}trichyeu`).value.trim();
        const ngayBanHanhRaw = document.getElementById(`${p}ngaybanhanh`).value;
        const thoiHanRaw = document.getElementById(`${p}thoihan`).value;

        // --- Validate Frontend ---
        if (!soVanBan) {
            context.ui.showAlert(context.i18n.t('error_missing_so'), '⚠️');
            button.disabled = false;
            button.innerText = originalText;
            return;
        }
        if (!trichYeu) {
            context.ui.showAlert(context.i18n.t('error_missing_summary'), '⚠️');
            button.disabled = false;
            button.innerText = originalText;
            return;
        }

        const normalizedDeadline = normalizeDateInputToIso(thoiHanRaw);
        if (thoiHanRaw && !normalizedDeadline) {
            context.ui.showAlert(context.i18n.t('error_invalid_date'), '⚠️');
            button.disabled = false;
            button.innerText = originalText;
            return;
        }

        const updated = {
            ...currentDocData,
            soVanBan,
            ngayBanHanh: ngayBanHanhRaw ? `${ngayBanHanhRaw}T00:00:00` : null,
            trichYeu,
            coQuanBanHanh: document.getElementById(`${p}coquanbanhanh`).value,
            coQuanChuQuan: document.getElementById(`${p}coquanchuquan`).value,
            thoiHan: normalizedDeadline ? `${normalizedDeadline}T00:00:00` : null,
            status: getStatus(),
            priority: document.getElementById(`${p}priority`).value
        };

        try {
            const response = await context.api.put(`/api/documents/${currentDocId}`, {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });

            if (!response.ok) {
                let errorMsg = context.i18n.t('error_saving');
                try {
                    const error = await response.json();
                    if (error.errors) {
                        // Trích xuất các câu lỗi từ đối tượng errors của .NET
                        errorMsg = Object.values(error.errors).flat().join('\n');
                    } else if (error.message) {
                        errorMsg = error.message;
                    }
                } catch (e) {
                    const text = await response.text();
                    if (text) errorMsg = text;
                }
                context.ui.showAlert(`${context.i18n.t('error_update_failed')}\n${errorMsg}`, '❌');
                return;
            }

            currentDocData = updated;

            if (button.closest('#doc-detail-page')) {
                renderDetailPage(updated);
                switchPageTab('view');
            } else {
                renderDetail(updated);
                switchTab('view');
            }

            context.ui.showAlert('Đã cập nhật văn bản thành công!', '✅');
            await context.services.refreshCoreData();
        } catch (error) {
            context.ui.showAlert(context.i18n.t('error_connection'), '❌');
        } finally {
            button.disabled = false;
            button.innerText = originalText;
        }
    }

    async function loadComments() {
        if (!currentDocId) return;

        try {
            const response = await context.api.get(`/api/documents/${currentDocId}/comments`);
            if (!response.ok) return;
            const comments = await response.json();
            renderComments(comments);
        } catch (error) {
            console.error('Comment load error:', error);
        }
    }

    function renderComments(comments) {
        const list = document.getElementById('comment-list');
        const pageList = document.getElementById('doc-page-comment-list');
        const badge = document.getElementById('comment-count-badge');
        const pageBadge = document.getElementById('doc-page-comment-badge');

        const countText = comments.length.toString();
        if (badge) badge.innerText = countText;
        if (pageBadge) pageBadge.innerText = countText;

        const currentUserId = parseInt(localStorage.getItem('user_id') || '0', 10);
        const role = localStorage.getItem('user_role');

        if (!comments.length) {
            list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary);">
                <p style="font-size:2rem; margin-bottom:8px;">💭</p>
                <p>${context.i18n.t('no_comments_yet')}</p>
            </div>`;
            return;
        }

        const html = comments.map((comment) => {
            const reactions = comment.reactions || {};
            const reactionTypes = [
                { type: 'like', emoji: '👍', label: 'Thích' },
                { type: 'love', emoji: '❤️', label: 'Yêu thích' },
                { type: 'hate', emoji: '😡', label: 'Phẫn nộ' },
                { type: 'dislike', emoji: '👎', label: 'Không thích' }
            ];

            let userReaction = null;
            reactionTypes.forEach((type) => {
                if (reactions[type.type]?.users?.some((user) => user === localStorage.getItem('user_name'))) {
                    userReaction = type.type;
                }
            });

            const reactionButtons = reactionTypes.map((type) => {
                const count = reactions[type.type]?.count || 0;
                const users = reactions[type.type]?.users?.join(', ') || type.label;
                return `<button class="reaction-btn ${userReaction === type.type ? `active-${type.type}` : ''}" title="${users}" data-action="toggle-reaction" data-comment-id="${comment.id}" data-reaction-type="${type.type}">${type.emoji} <span class="reaction-count">${count > 0 ? count : ''}</span></button>`;
            }).join('');

            const canDelete = comment.userId === currentUserId || role === 'Admin';
            const deleteButton = canDelete
                ? `<button class="comment-delete-btn" data-action="delete-comment" data-comment-id="${comment.id}" title="Xoa binh luan">🗑️</button>`
                : '';

            // Render attachments
            let attachmentsHtml = '';
            if (comment.attachmentPaths && comment.attachmentPaths !== '[]') {
                try {
                    const paths = JSON.parse(comment.attachmentPaths);
                    attachmentsHtml = '<div class="comment-attachments">';
                    paths.forEach(path => {
                        const fileName = path.split('/').pop().substring(15); // Bỏ prefix timestamp
                        const ext = path.toLowerCase().split('.').pop();
                        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

                        if (isImage) {
                            attachmentsHtml += `
                                <a href="${path}" target="_blank" class="attachment-item image-preview">
                                    <img src="${path}" alt="${fileName}">
                                </a>`;
                        } else {
                            let icon = '📄';
                            if (ext === 'pdf') icon = '📕';
                            if (['doc', 'docx'].includes(ext)) icon = '📘';
                            if (['xls', 'xlsx'].includes(ext)) icon = '📗';

                            attachmentsHtml += `
                                <a href="${path}" target="_blank" class="attachment-item file-link">
                                    <span class="file-icon">${icon}</span>
                                    <span class="file-name" title="${fileName}">${fileName}</span>
                                </a>`;
                        }
                    });
                    attachmentsHtml += '</div>';
                } catch (e) { console.error('Parse attachments error', e); }
            }

            return `<div class="comment-card" id="comment-card-${comment.id}">
                <div class="comment-meta">
                    <span class="comment-username">${comment.username}</span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="comment-time">${new Date(comment.createdAt).toLocaleString('vi-VN')}</span>
                        ${deleteButton}
                    </div>
                </div>
                <div class="comment-content">${escapeHtml(comment.content)}</div>
                ${attachmentsHtml}
                <div class="reaction-bar" id="reaction-bar-${comment.id}">${reactionButtons}</div>
            </div>`;
        }).join('');

        // Render vào cả hai danh sách (modal và mobile page)
        if (list) list.innerHTML = html;
        if (pageList) pageList.innerHTML = html;
    }

    async function submitComment(button) {
        // Phát hiện context: mobile page hay desktop modal
        const isPage = !!button.closest('#doc-detail-page');
        const textareaId = isPage ? 'page-new-comment-text' : 'new-comment-text';
        const previewId = isPage ? 'page-comment-attachments-preview' : 'comment-attachments-preview';

        const textarea = document.getElementById(textareaId);
        const text = textarea?.value.trim();
        if (!text) {
            context.ui.showAlert(context.i18n.t('error_empty_comment'), '⚠️');
            return;
        }

        const originalText = button.innerText;
        button.disabled = true;
        button.innerText = 'Đang gửi...';

        try {
            const formData = new FormData();
            formData.append('content', text);
            selectedFiles.forEach(file => {
                formData.append('files', file);
            });

            const response = await context.api.post(`/api/documents/${currentDocId}/comments`, {
                body: formData
            });

            if (!response.ok) {
                const err = await response.text();
                context.ui.showAlert(context.i18n.t('error_send_comment_failed') + ' ' + err, '❌');
                return;
            }

            if (textarea) textarea.value = '';
            selectedFiles = [];
            renderFilePreview();
            await loadComments();
        } catch (error) {
            context.ui.showAlert(context.i18n.t('error_connection'), '❌');
        } finally {
            button.disabled = false;
            button.innerText = originalText;
        }
    }

    async function deleteComment(commentId) {
        const confirmed = await context.ui.showConfirm(context.i18n.t('confirm_delete_comment'));
        if (!confirmed) return;

        try {
            const response = await context.api.delete(`/api/documents/${currentDocId}/comments/${commentId}`);
            if (!response.ok) {
                context.ui.showAlert(context.i18n.t('error_delete_comment_failed'), '❌');
                return;
            }

            await loadComments();
        } catch (error) {
            context.ui.showAlert(context.i18n.t('error_connection'), '❌');
        }
    }

    async function toggleReaction(commentId, reactionType) {
        try {
            const response = await context.api.post(`/api/documents/${currentDocId}/comments/${commentId}/react`, {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reactionType })
            });

            if (!response.ok) return;

            const data = await response.json();
            updateReactionBar(commentId, data.reactions);
        } catch (error) {
            console.error('Reaction error:', error);
        }
    }

    function updateReactionBar(commentId, reactions) {
        const bar = document.getElementById(`reaction-bar-${commentId}`);
        if (!bar) return;

        const reactionTypes = [
            { type: 'like', emoji: '👍', label: 'Thích' },
            { type: 'love', emoji: '❤️', label: 'Yêu thích' },
            { type: 'hate', emoji: '😡', label: 'Phẫn nộ' },
            { type: 'dislike', emoji: '👎', label: 'Không thích' }
        ];

        const currentUsername = localStorage.getItem('user_name');
        let userReaction = null;
        reactionTypes.forEach((type) => {
            if (reactions[type.type]?.users?.includes(currentUsername)) {
                userReaction = type.type;
            }
        });

        bar.innerHTML = reactionTypes.map((type) => {
            const count = reactions[type.type]?.count || 0;
            const users = reactions[type.type]?.users?.join(', ') || type.label;
            return `<button class="reaction-btn ${userReaction === type.type ? `active-${type.type}` : ''}" title="${users}" data-action="toggle-reaction" data-comment-id="${commentId}" data-reaction-type="${type.type}">${type.emoji} <span class="reaction-count">${count > 0 ? count : ''}</span></button>`;
        }).join('');
    }

    function renderFilePreview() {
        // Render vào cả hai container (modal và mobile page)
        const containers = [
            document.getElementById('comment-attachments-preview'),
            document.getElementById('page-comment-attachments-preview')
        ].filter(Boolean);

        const html = selectedFiles.length === 0 ? '' : selectedFiles.map((file, index) => {
            const ext = file.name.split('.').pop().toLowerCase();
            let icon = '📄';
            if (['jpg', 'jpeg', 'png'].includes(ext)) icon = '🖼️';
            if (ext === 'pdf') icon = '📕';
            return `
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:6px 10px; display:flex; align-items:center; gap:8px; font-size:0.85rem; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span>${icon}</span>
                    <span style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.name}</span>
                    <button type="button" class="remove-file-btn" data-index="${index}" style="background:none; border:none; cursor:pointer; color:#ef4444; font-weight:700;">✕</button>
                </div>
            `;
        }).join('');

        containers.forEach(container => {
            container.innerHTML = html;
            container.querySelectorAll('.remove-file-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    selectedFiles.splice(idx, 1);
                    renderFilePreview();
                };
            });
        });
    }

    return {
        init,
        open,
        close
    };
}
