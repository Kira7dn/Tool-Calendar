export function createSettingsFeature(context) {
    // Danh sách trạng thái hiện tại (in-memory, sync với UI chips)
    let currentStatusList = [];

    function init() {
        const panel = document.getElementById('tab-settings');
        if (!panel) return;

        // Bắt sự kiện click chung trên panel
        panel.addEventListener('click', async (event) => {
            const actionBtn = event.target.closest('[data-action]');
            if (!actionBtn) return;

            const action = actionBtn.dataset.action;
            console.log("Settings click action:", action);

            if (action === 'save-settings') await saveSettings(actionBtn);
            if (action === 'show-admin-tab') showAdminTab(actionBtn.dataset.adminTab);
            if (action === 'refresh-audit-logs') await loadAuditLogs();
            if (action === 'trigger-scan') await triggerScan(actionBtn);
            if (action === 'test-notification') await testNotification(actionBtn);
            if (action === 'clear-audit-logs') await clearAuditLogs(actionBtn);
        });

        // Gán sự kiện trực tiếp cho các nút subnav để chắc chắn
        ['ocr', 'audit', 'departments', 'labels', 'backup'].forEach(tabName => {
            const btn = document.getElementById(`atab-${tabName}`);
            if (btn) {
                btn.onclick = (e) => {
                    console.log(`Direct click on tab: ${tabName}`);
                    showAdminTab(tabName);
                };
            }
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
            document.getElementById('setting-scan-time').value = settings.notificationScanTime || '08:30';

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
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
                    notificationScanTime: document.getElementById('setting-scan-time').value,
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
        console.log("Switching to admin tab:", tab);
        ['ocr', 'departments', 'labels', 'backup', 'audit'].forEach((name) => {
            const panel = document.getElementById(`admin-panel-${name}`);
            const button = document.getElementById(`atab-${name}`);
            
            if (panel) {
                const isTarget = name === tab;
                panel.style.setProperty('display', isTarget ? 'block' : 'none', 'important');
                console.log(`Panel ${name}: display=${panel.style.display}`);
            } else {
                console.warn(`Panel not found: admin-panel-${name}`);
            }
            
            if (button) button.classList.toggle('active', name === tab);
        });

        if (tab === 'audit') {
            console.log("Calling loadAuditLogs...");
            loadAuditLogs();
        }

        context.services.adminMeta.activateSection(tab);
    }

    async function loadAuditLogs() {
        console.log("Loading audit logs...");
        const tbody = document.getElementById('audit-body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:grey;">Đang tải nhật ký...</td></tr>';

        try {
            const response = await context.api.get('/api/admin/audit-logs?limit=100');
            if (!response.ok) return;
            const logs = await response.json();

            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:grey;">Chưa có nhật ký nào.</td></tr>';
                return;
            }

            tbody.innerHTML = logs.map(log => {
                const date = new Date(log.timestamp).toLocaleString('vi-VN');
                return `
                    <tr>
                        <td style="white-space:nowrap; color:#64748b;">${date}</td>
                        <td style="font-weight:600; color:#0f172a;">${log.userFullName}</td>
                        <td style="color:#334155;">${escapeHtml(log.action)}</td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:red;">Lỗi khi tải nhật ký.</td></tr>';
        }
    }

    async function triggerScan(button) {
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span>⏳ Đang quét...</span>';

        try {
            const response = await context.api.post('/api/notification/trigger-scan');
            if (response.ok) {
                context.ui.showAlert('Đã hoàn thành quét thời hạn!', '✅');
                await loadAuditLogs();
            } else {
                context.ui.showAlert('Lỗi khi kích hoạt quét', '❌');
            }
        } catch (e) {
            context.ui.showAlert('Lỗi kết nối', '❌');
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }

    async function testNotification(button) {
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span>⏳ Đang gửi...</span>';

        try {
            const response = await context.api.post('/api/notification/test');
            if (response.ok) {
                context.ui.showAlert('Đã gửi thông báo thử nghiệm! Hãy kiểm tra góc màn hình.', '🔔');
            } else {
                const err = await response.text();
                context.ui.showAlert('Lỗi: ' + err, '❌');
            }
        } catch (e) {
            context.ui.showAlert('Lỗi kết nối', '❌');
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }

    async function clearAuditLogs(button) {
        if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ nhật ký hệ thống? Hành động này không thể hoàn tác.')) return;

        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span>⏳ Đang dọn...</span>';

        try {
            const response = await context.api.post('/api/admin/clear-audit-logs');
            if (response.ok) {
                context.ui.showAlert('Đã dọn sạch nhật ký hệ thống!', '🗑️');
                await loadAuditLogs();
            } else {
                context.ui.showAlert('Lỗi khi xóa nhật ký', '❌');
            }
        } catch (e) {
            context.ui.showAlert('Lỗi kết nối', '❌');
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }

    return {
        init,
        activate,
        prefetch,
        showAdminTab
    };
}
