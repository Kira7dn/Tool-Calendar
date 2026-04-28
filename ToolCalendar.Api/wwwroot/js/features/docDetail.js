import { escapeAttribute } from '../core/dom.js';
import { escapeHtml, formatDate, formatDateForTextInput, normalizeDateInputToIso } from '../core/formatters.js';

export function createDocDetailFeature(context) {
    let currentDocId = null;
    let currentDocData = null;
    let isStatusOptionsLoaded = false;
    let statusOptions = ['Chưa xử lý', 'Đang xử lý', 'Hoàn thành', 'Quá hạn'];
    let selectedFiles = [];

    function init() {
        const modal = document.getElementById('doc-detail-modal');
        if (!modal) return;

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

        // Event delegation cho change event - bắt sự kiện dù select được rebuild bao nhiêu lần
        modal.addEventListener('change', (event) => {
            if (event.target.id === 'de-status') {
                onStatusSelectChange();
            }
        });

        // Đính kèm tệp cho bình luận
        const attachBtn = document.getElementById('btn-comment-attach');
        const fileInput = document.getElementById('comment-file-input');
        if (attachBtn && fileInput) {
            attachBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                const files = Array.from(e.target.files);
                selectedFiles = [...selectedFiles, ...files];
                renderFilePreview();
                fileInput.value = ''; // Reset để chọn lại cùng file nếu muốn
            };
        }

        // Real-time listeners
        document.addEventListener('realtime:new_comment', (e) => {
            console.log('[Realtime] New comment event received:', e.detail);
            if (currentDocId === e.detail.documentId) loadComments();
        });
        document.addEventListener('realtime:delete_comment', (e) => {
            console.log('[Realtime] Delete comment event received:', e.detail);
            if (currentDocId === e.detail.documentId) loadComments();
        });
        document.addEventListener('realtime:comment_reaction', (e) => {
            console.log('[Realtime] Reaction event received:', e.detail);
            if (currentDocId === e.detail.documentId) {
                updateReactionBar(e.detail.commentId, e.detail.reactions);
            }
        });
    }

    async function open(id, initialTab = 'view') {
        currentDocId = id;

        // 1. Reset UI về trạng thái loading để tránh hiện dữ liệu cũ của văn bản trước
        resetUI();
        document.getElementById('doc-detail-modal').style.display = 'flex';
        switchTab(initialTab);

        try {
            // 2. Chạy song song các tác vụ: Tải option (nếu chưa có), tải data văn bản, tải bình luận
            const tasks = [
                context.api.get(`/api/documents/${id}`),
                loadComments()
            ];

            if (!isStatusOptionsLoaded) {
                tasks.push(loadStatusOptions());
            }

            const results = await Promise.all(tasks);
            const docResponse = results[0];

            if (!docResponse.ok) throw new Error('Failed to fetch doc');

            currentDocData = await docResponse.json();

            // 3. Render dữ liệu
            renderDetail(currentDocData);

            const role = localStorage.getItem('user_role');
            document.getElementById('doc-tab-edit').style.display = (role === 'Admin' || role === 'VanThu') ? '' : 'none';

        } catch (error) {
            console.error('Document detail load error:', error);
            context.ui.showAlert('Không thể tải chi tiết văn bản', '❌');
            close();
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
                document.getElementById('dv-view-pdf').innerHTML = `<button class="btn btn-sm btn-primary" data-action="open-pdf" data-doc-id="${doc.id}" data-title="${escapeAttribute(doc.soVanBan || '')}">📄 Xem noi dung ban PDF</button>`;
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

    /** Tải danh sách trạng thái từ API và cập nhật select */
    async function loadStatusOptions() {
        if (isStatusOptionsLoaded) return;
        try {
            const res = await context.api.get('/api/stats/settings');
            if (!res.ok) return;
            const settings = await res.json();
            if (Array.isArray(settings.statusList) && settings.statusList.length > 0) {
                statusOptions = settings.statusList;
            }
            isStatusOptionsLoaded = true;
        } catch { /* giữ nguyên mặc định nếu lỗi */ }

        const sel = document.getElementById('de-status');
        if (!sel) return;
        sel.innerHTML = statusOptions.map(s =>
            `<option value="${s}">${s}</option>`
        ).join('') + `<option value="__custom__">✏️ Tùy chỉnh...</option>`;

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
        button.innerText = 'Dang luu...';

        const normalizedDeadline = normalizeDateInputToIso(document.getElementById('de-thoihan').value);

        const updated = {
            ...currentDocData,
            soVanBan: document.getElementById('de-so').value,
            ngayBanHanh: document.getElementById('de-ngaybanhanh').value ? `${document.getElementById('de-ngaybanhanh').value}T00:00:00` : null,
            trichYeu: document.getElementById('de-trichyeu').value,
            coQuanBanHanh: document.getElementById('de-coquanbanhanh').value,
            coQuanChuQuan: document.getElementById('de-coquanchuquan').value,
            thoiHan: normalizedDeadline ? `${normalizedDeadline}T00:00:00` : null,
            status: getStatusValue(),   // lấy từ select hoặc custom input
            priority: document.getElementById('de-priority').value
        };

        try {
            const response = await context.api.put(`/api/documents/${currentDocId}`, {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });

            if (!response.ok) {
                context.ui.showAlert('Loi khi cap nhat van ban.', '❌');
                return;
            }

            currentDocData = updated;
            renderDetail(updated);
            switchTab('view');
            context.ui.showAlert('Da cap nhat van ban thanh cong!', '✅');
            await context.services.refreshCoreData();
        } catch (error) {
            context.ui.showAlert('Loi ket noi.', '❌');
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
        if (!list) return;

        document.getElementById('comment-count-badge').innerText = comments.length;

        const currentUserId = parseInt(localStorage.getItem('user_id') || '0', 10);
        const role = localStorage.getItem('user_role');

        if (!comments.length) {
            list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary);">
                <p style="font-size:2rem; margin-bottom:8px;">💭</p>
                <p>Chua co binh luan nao. Hay la nguoi dau tien!</p>
            </div>`;
            return;
        }

        list.innerHTML = comments.map((comment) => {
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
    }

    async function submitComment(button) {
        const text = document.getElementById('new-comment-text').value.trim();
        if (!text) {
            context.ui.showAlert('Vui long nhap noi dung binh luan!', '⚠️');
            return;
        }

        const originalText = button.innerText;
        button.disabled = true;
        button.innerText = 'Dang gui...';

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
                context.ui.showAlert('Loi khi gui binh luan: ' + err, '❌');
                return;
            }

            document.getElementById('new-comment-text').value = '';
            selectedFiles = [];
            renderFilePreview();
            await loadComments();
        } catch (error) {
            context.ui.showAlert('Loi ket noi.', '❌');
        } finally {
            button.disabled = false;
            button.innerText = originalText;
        }
    }

    async function deleteComment(commentId) {
        const confirmed = await context.ui.showConfirm('Xoa binh luan nay?');
        if (!confirmed) return;

        try {
            const response = await context.api.delete(`/api/documents/${currentDocId}/comments/${commentId}`);
            if (!response.ok) {
                context.ui.showAlert('Loi khi xoa binh luan.', '❌');
                return;
            }

            await loadComments();
        } catch (error) {
            context.ui.showAlert('Loi ket noi.', '❌');
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
        const container = document.getElementById('comment-attachments-preview');
        if (!container) return;

        if (selectedFiles.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = selectedFiles.map((file, index) => {
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

        // Gán sự kiện xóa file
        container.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.index);
                selectedFiles.splice(idx, 1);
                renderFilePreview();
            };
        });
    }

    return {
        init,
        open,
        close
    };
}
