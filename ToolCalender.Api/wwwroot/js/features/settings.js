export function createSettingsFeature(context) {
    function init() {
        document.getElementById('tab-settings')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'save-settings') {
                await saveSettings(action);
            }

            if (action.dataset.action === 'show-admin-tab') {
                showAdminTab(action.dataset.adminTab);
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
        } catch (error) {
            console.error('Settings load error:', error);
        }
    }

    async function saveSettings(button) {
        const originalText = button.innerText;
        button.disabled = true;
        button.innerText = 'Dang luu...';

        try {
            const response = await context.api.post('/api/stats/settings', {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    maxPagesToScan: parseInt(document.getElementById('setting-max-pages').value, 10),
                    deadlineKeywords: document.getElementById('setting-deadline-keywords').value
                })
            });

            if (!response.ok) {
                context.ui.showAlert('Loi khi luu cau hinh', '❌');
                return;
            }

            context.ui.showAlert('Da luu cau hinh he thong!', '✅');
        } catch (error) {
            context.ui.showAlert('Loi ket noi', '❌');
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
