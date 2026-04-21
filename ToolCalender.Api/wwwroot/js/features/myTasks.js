import { escapeAttribute } from '../core/dom.js';
import { formatDate } from '../core/formatters.js';

export function createMyTasksFeature(context) {
    function init() {
        document.getElementById('tab-my-tasks')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'open-pdf') {
                await context.services.openPdfPreview(parseInt(action.dataset.docId, 10), action.dataset.title || '');
            }

            if (action.dataset.action === 'open-evidence-modal') {
                openEvidenceModal(parseInt(action.dataset.docId, 10));
            }
        });

        document.getElementById('evidence-modal')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'close-evidence-modal') {
                closeEvidenceModal();
            }

            if (action.dataset.action === 'submit-evidence') {
                await submitEvidence();
            }
        });
    }

    async function activate() {
        await refresh();
    }

    async function refresh() {
        try {
            const response = await context.api.get('/api/documents/my-tasks');
            if (!response.ok) return;
            render(await response.json());
        } catch (error) {
            console.error(error);
        }
    }

    function render(tasks) {
        const tbody = document.getElementById('my-tasks-body');
        if (!tbody) return;

        const now = new Date();
        let countNew = 0;
        let countDoing = 0;
        let countOverdue = 0;

        tbody.innerHTML = tasks.length ? tasks.map((task) => {
            const deadline = task.hanXuLy ? new Date(task.hanXuLy) : null;
            const overdue = deadline && deadline < now;
            if (overdue) countOverdue += 1;
            else if (task.status === 'Dang xu ly') countDoing += 1;
            else countNew += 1;

            return `<tr>
                <td style="font-weight:700; color:var(--sidebar-bg);">${task.soVanBan || '-'}</td>
                <td style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeAttribute(task.trichYeu || '')}">${task.trichYeu || '-'}</td>
                <td>${formatDate(task.hanXuLy)}</td>
                <td><span class="status ${overdue ? 'bg-danger' : task.status === 'Dang xu ly' ? 'bg-warning' : 'bg-success'}">${overdue ? 'Qua han' : task.status}</span></td>
                <td>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn" style="padding:4px 10px; font-size:0.8rem; background:#e2e8f0; color:#1e293b;" data-action="open-pdf" data-doc-id="${task.id}" data-title="${escapeAttribute(task.soVanBan || '')}">📄 Xem PDF</button>
                        <button class="btn btn-primary" style="padding:4px 10px; font-size:0.8rem;" data-action="open-evidence-modal" data-doc-id="${task.id}">📎 Nop bang chung</button>
                    </div>
                </td>
            </tr>`;
        }).join('') : `<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-secondary);">📋 Chua co viec nao duoc giao cho ban.</td></tr>`;

        document.getElementById('mt-stat-new').innerText = countNew;
        document.getElementById('mt-stat-doing').innerText = countDoing;
        document.getElementById('mt-stat-overdue').innerText = countOverdue;
    }

    function openEvidenceModal(docId) {
        document.getElementById('evidence-doc-id').value = docId;
        document.getElementById('evidence-notes').value = '';
        document.getElementById('evidence-files').value = '';
        document.getElementById('evidence-modal').style.display = 'flex';
    }

    function closeEvidenceModal() {
        document.getElementById('evidence-modal').style.display = 'none';
    }

    async function submitEvidence() {
        const docId = document.getElementById('evidence-doc-id').value;
        const notes = document.getElementById('evidence-notes').value;
        const files = document.getElementById('evidence-files').files;

        if (!notes.trim()) {
            context.ui.showAlert('Vui long nhap ghi chu ket qua!', '⚠️');
            return;
        }

        if (!files.length) {
            context.ui.showAlert('Vui long chon it nhat 1 file bang chung!', '⚠️');
            return;
        }

        const formData = new FormData();
        formData.append('notes', notes);
        Array.from(files).forEach((file) => formData.append('files', file));

        const response = await context.api.post(`/api/documents/${docId}/submit-evidence`, {
            body: formData
        });

        if (!response.ok) {
            context.ui.showAlert('Loi khi nop bang chung.', '❌');
            return;
        }

        context.ui.showAlert('Da nop bang chung! Van ban da hoan thanh.', '✅');
        closeEvidenceModal();
        await refresh();
    }

    return {
        init,
        activate,
        refresh
    };
}
