import { escapeAttribute } from '../core/dom.js';
import { escapeHtml, formatDate, formatDateForTextInput, normalizeDateInputToIso } from '../core/formatters.js';

export function createDocDetailFeature(context) {
    let currentDocId = null;
    let currentDocData = null;

    function init() {
        document.getElementById('doc-detail-modal')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            const actionName = action.dataset.action;

            if (actionName === 'close-doc-detail-modal') {
                close();
            }

            if (actionName === 'switch-doc-tab') {
                switchTab(action.dataset.docTab);
            }

            if (actionName === 'save-doc-detail') {
                await saveDetail(action);
            }

            if (actionName === 'submit-comment') {
                await submitComment(action);
            }

            if (actionName === 'delete-comment') {
                await deleteComment(parseInt(action.dataset.commentId, 10));
            }

            if (actionName === 'toggle-reaction') {
                await toggleReaction(parseInt(action.dataset.commentId, 10), action.dataset.reactionType);
            }

            if (actionName === 'open-pdf') {
                await context.services.openPdfPreview(parseInt(action.dataset.docId, 10), action.dataset.title || '');
            }
        });
    }

    async function open(id, initialTab = 'view') {
        currentDocId = id;

        try {
            const response = await context.api.get(`/api/documents/${id}`);
            if (!response.ok) return;
            currentDocData = await response.json();
        } catch (error) {
            console.error('Document detail load error:', error);
            return;
        }

        renderDetail(currentDocData);
        const role = localStorage.getItem('user_role');
        document.getElementById('doc-tab-edit').style.display = role === 'Admin' || role === 'VanThu' ? '' : 'none';
        document.getElementById('doc-detail-modal').style.display = 'flex';

        switchTab(initialTab);
        await loadComments();
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
        document.getElementById('de-status').value = doc.status || 'Chua xu ly';
        document.getElementById('de-priority').value = doc.priority || 'Thuong';
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
            status: document.getElementById('de-status').value,
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
                { type: 'like', emoji: '👍', label: 'Like' },
                { type: 'love', emoji: '❤️', label: 'Love' },
                { type: 'hate', emoji: '😡', label: 'Hate' },
                { type: 'dislike', emoji: '👎', label: 'Dislike' }
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

            return `<div class="comment-card" id="comment-card-${comment.id}">
                <div class="comment-meta">
                    <span class="comment-username">${comment.username}</span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="comment-time">${new Date(comment.createdAt).toLocaleString('vi-VN')}</span>
                        ${deleteButton}
                    </div>
                </div>
                <div class="comment-content">${escapeHtml(comment.content)}</div>
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
            const response = await context.api.post(`/api/documents/${currentDocId}/comments`, {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text })
            });

            if (!response.ok) {
                context.ui.showAlert('Loi khi gui binh luan.', '❌');
                return;
            }

            document.getElementById('new-comment-text').value = '';
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
            { type: 'like', emoji: '👍', label: 'Like' },
            { type: 'love', emoji: '❤️', label: 'Love' },
            { type: 'hate', emoji: '😡', label: 'Hate' },
            { type: 'dislike', emoji: '👎', label: 'Dislike' }
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

    return {
        init,
        open,
        close
    };
}
