export function createSettingsFeature(context) {
    // Danh sách trạng thái hiện tại (in-memory, sync với UI chips)
    let currentStatusList = [];

    function init() {
        const panel = document.getElementById('tab-settings');
        if (!panel) return;

        panel.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (action?.dataset.action === 'save-settings') await saveSettings(action);
            if (action?.dataset.action === 'show-admin-tab') showAdminTab(action.dataset.adminTab);
        });

        // Nút thêm trạng thái mới
        document.getElementById('btn-add-status')?.addEventListener('click', () => {
            const input = document.getElementById('setting-new-status');
            const val = input?.value?.trim();
            if (!val) return;
            if (currentStatusList.includes(val)) {
                context.ui.showAlert('Trạng thái này đã tồn tại!', '⚠️');
                return;
            }
            currentStatusList.push(val);
            renderStatusChips();
            input.value = '';
        });

        // Enter để thêm nhanh
        document.getElementById('setting-new-status')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('btn-add-status')?.click();
            }
        });
    }

    async function activate() {
        await prefetch();
    }

    async function prefetch() {
        try {
            const response = await context.api.get('/api/stats/settings');
            if (!response.ok) return;
            const settings = await response.json();

            document.getElementById('setting-max-pages').value = settings.maxPagesToScan || 0;
            document.getElementById('setting-deadline-keywords').value = settings.deadlineKeywords || '';
            document.getElementById('setting-deadline-exclude-keywords').value = settings.deadlineExcludeKeywords || '';
            document.getElementById('setting-min-deadline-days').value = settings.minDeadlineDays || 0;

            // Load danh sách trạng thái
            currentStatusList = Array.isArray(settings.statusList) ? [...settings.statusList] : [];
            renderStatusChips();
        } catch (error) {
            console.error('Settings load error:', error);
        }
    }

    function renderStatusChips() {
        const container = document.getElementById('status-chips-container');
        if (!container) return;

        container.innerHTML = currentStatusList.map((s, i) => `
            <span style="
                display:inline-flex; align-items:center; gap:6px;
                background:#e0f2fe; color:#0369a1; font-size:0.85rem;
                padding:5px 10px 5px 12px; border-radius:20px;
                border:1px solid #7dd3fc; font-weight:500;
            ">
                ${escapeHtml(s)}
                <button
                    data-idx="${i}"
                    title="Xoá trạng thái này"
                    style="background:none;border:none;cursor:pointer;color:#0369a1;font-size:1rem;line-height:1;padding:0;display:flex;align-items:center;"
                    onclick="this.closest('#status-chips-container').__removeChip(${i})"
                >✕</button>
            </span>
        `).join('');

        // Gắn hàm xoá vào container để tránh inline string
        container.__removeChip = (idx) => {
            currentStatusList.splice(idx, 1);
            renderStatusChips();
        };
    }

    function escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    async function saveSettings(button) {
        const originalText = button.innerText;
        button.disabled = true;
        button.innerText = 'Đang lưu...';

        try {
            const response = await context.api.post('/api/stats/settings', {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    maxPagesToScan: parseInt(document.getElementById('setting-max-pages').value, 10),
                    deadlineKeywords: document.getElementById('setting-deadline-keywords').value,
                    deadlineExcludeKeywords: document.getElementById('setting-deadline-exclude-keywords').value,
                    minDeadlineDays: parseInt(document.getElementById('setting-min-deadline-days').value, 10) || 0,
                    statusList: currentStatusList.join(',')
                })
            });

            if (!response.ok) {
                context.ui.showAlert('Lỗi khi lưu cấu hình', '❌');
                return;
            }

            context.ui.showAlert('Đã lưu cấu hình hệ thống!', '✅');
        } catch (error) {
            context.ui.showAlert('Lỗi kết nối', '❌');
        } finally {
            button.disabled = false;
            button.innerText = originalText;
        }
    }

    function showAdminTab(tab) {
        ['ocr', 'departments', 'labels', 'backup'].forEach((name) => {
            const panel = document.getElementById(`admin-panel-${name}`);
            const button = document.getElementById(`atab-${name}`);
            if (panel) panel.style.display = name === tab ? 'block' : 'none';
            if (button) button.classList.toggle('active', name === tab);
        });

        context.services.adminMeta.activateSection(tab);
    }

    return {
        init,
        activate,
        prefetch,
        showAdminTab
    };
}
