export function createAdminMetaFeature(context) {
    let currentDepts = [];
    let editingDeptId = null;

    function init() {
        document.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            const dropdown = action.closest('.action-menu-dropdown');
            if (dropdown) dropdown.classList.remove('active');

            if (action.dataset.action === 'open-dept-modal') {
                editingDeptId = null;
                document.getElementById('dept-modal-title').innerText = `🏢 ${context.i18n.t('add_department') || 'Thêm Phòng ban'}`;
                document.getElementById('dept-name').value = '';
                document.getElementById('dept-desc').value = '';
                openModal('dept-modal');
            }
            if (action.dataset.action === 'edit-department') {
                editingDeptId = parseInt(action.dataset.departmentId, 10);
                const dept = currentDepts.find(d => d.id === editingDeptId);
                if (dept) {
                    document.getElementById('dept-modal-title').innerText = `📝 ${context.i18n.t('edit_department') || 'Sửa Phòng ban'}`;
                    document.getElementById('dept-name').value = dept.name;
                    document.getElementById('dept-desc').value = dept.description || '';
                    openModal('dept-modal');
                }
            }
            if (action.dataset.action === 'close-dept-modal') closeModal('dept-modal');
            if (action.dataset.action === 'save-department') await saveDepartment();
            if (action.dataset.action === 'delete-department') await deleteDepartment(parseInt(action.dataset.departmentId, 10));

            if (action.dataset.action === 'open-label-modal') openModal('label-modal');
            if (action.dataset.action === 'close-label-modal') closeModal('label-modal');
            if (action.dataset.action === 'create-label') await createLabel();
            if (action.dataset.action === 'delete-label') await deleteLabel(parseInt(action.dataset.labelId, 10));

            if (action.dataset.action === 'open-rule-modal') openModal('rule-modal');
            if (action.dataset.action === 'close-rule-modal') closeModal('rule-modal');
            if (action.dataset.action === 'create-rule') await createRule();
            if (action.dataset.action === 'delete-rule') await deleteRule(parseInt(action.dataset.ruleId, 10));

            if (action.dataset.action === 'download-backup') await downloadBackup();
        });
    }

    function activateSection(section) {
        if (section === 'departments') fetchDepartments();
        if (section === 'labels') {
            fetchLabels();
            fetchRules();
        }
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'flex';
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
    }

    async function fetchDepartments() {
        try {
            const response = await context.api.get('/api/admin/departments');
            if (!response.ok) return;
            currentDepts = await response.json();
            const body = document.getElementById('dept-body');
            if (!body) return;

            body.innerHTML = currentDepts.map((department) => `
                <tr>
                    <td>${department.id}</td>
                    <td style="font-weight:600;">${department.name}</td>
                    <td style="color:var(--text-secondary);">${department.description || '-'}</td>
                    <td>
                        <div class="action-menu-container">
                            <button class="action-menu-btn" title="${context.i18n.t('actions')}">
                                <i data-lucide="more-horizontal"></i>
                            </button>
                            <div class="action-menu-dropdown">
                                <button class="action-menu-item" data-action="edit-department" data-department-id="${department.id}">
                                    <i data-lucide="pencil"></i> ${context.i18n.t('edit')}
                                </button>
                                <button class="action-menu-item delete" data-action="delete-department" data-department-id="${department.id}">
                                    <i data-lucide="trash-2"></i> ${context.i18n.t('delete')}
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>`).join('') || `<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">${context.i18n.t('no_data') || 'Chưa có phòng ban nào'}</td></tr>`;

            if (window.lucide) window.lucide.createIcons();
        } catch (err) { console.error(err); }
    }

    async function saveDepartment() {
        const name = document.getElementById('dept-name').value.trim();
        const description = document.getElementById('dept-desc').value.trim();
        if (!name) {
            context.ui.showAlert(context.i18n.t('error_missing_name') || 'Vui lòng nhập tên!', '⚠️');
            return;
        }

        const payload = { name, description };
        if (editingDeptId) payload.id = editingDeptId;

        const method = editingDeptId ? 'PUT' : 'POST';
        const response = await context.api.request('/api/admin/departments', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            context.ui.showAlert(context.i18n.t('error_saving') || 'Lỗi khi lưu.', '❌');
            return;
        }

        context.ui.showAlert(context.i18n.t('success_saved') || 'Thành công!', '✅');
        closeModal('dept-modal');
        await fetchDepartments();
    }

    async function deleteDepartment(id) {
        if (!await context.ui.showConfirm(context.i18n.t('confirm_delete') || 'Xác nhận xóa?')) return;
        await context.api.delete(`/api/admin/departments/${id}`);
        await fetchDepartments();
    }

    async function fetchLabels() {
        try {
            const response = await context.api.get('/api/admin/labels');
            if (!response.ok) return;
            const labels = await response.json();
            const body = document.getElementById('labels-body');
            if (!body) return;

            body.innerHTML = labels.map((label) => `
                <tr>
                    <td style="font-weight:600;">${label.name}</td>
                    <td>
                        <span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${label.color || '#c0392b'};vertical-align:middle;margin-right:6px;border:1px solid rgba(0,0,0,0.1);"></span> 
                        ${label.color || '-'}
                    </td>
                    <td>
                        <div class="action-menu-container">
                            <button class="action-menu-btn" title="${context.i18n.t('actions')}">
                                <i data-lucide="more-horizontal"></i>
                            </button>
                            <div class="action-menu-dropdown">
                                <button class="action-menu-item delete" data-action="delete-label" data-label-id="${label.id}">
                                    <i data-lucide="trash-2"></i> ${context.i18n.t('delete')}
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>`).join('') || `<tr><td colspan="3" style="text-align:center; color:var(--text-secondary);">${context.i18n.t('no_data') || 'Chưa có nhãn'}</td></tr>`;

            if (window.lucide) window.lucide.createIcons();
        } catch (err) { console.error(err); }
    }

    async function createLabel() {
        const name = document.getElementById('label-name').value.trim();
        if (!name) {
            context.ui.showAlert(context.i18n.t('error_missing_name') || 'Vui lòng nhập tên!', '⚠️');
            return;
        }

        const response = await context.api.post('/api/admin/labels', {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                color: document.getElementById('label-color').value
            })
        });

        if (!response.ok) {
            context.ui.showAlert(context.i18n.t('error_saving') || 'Lỗi khi lưu.', '❌');
            return;
        }

        context.ui.showAlert(context.i18n.t('success_saved') || 'Thành công!', '✅');
        closeModal('label-modal');
        await fetchLabels();
    }

    async function deleteLabel(id) {
        if (!await context.ui.showConfirm(context.i18n.t('confirm_delete') || 'Xác nhận xóa?')) return;
        await context.api.delete(`/api/admin/labels/${id}`);
        await fetchLabels();
    }

    async function fetchRules() {
        try {
            const response = await context.api.get('/api/admin/rules');
            if (!response.ok) return;
            const rules = await response.json();
            const body = document.getElementById('rules-body');
            if (!body) return;

            body.innerHTML = rules.map((rule) => `
                <tr>
                    <td style="font-weight:600;">${rule.keyword}</td>
                    <td>${rule.labelId || '-'}</td>
                    <td>${rule.defaultDeadlineDays || '-'} ${context.i18n.t('days') || 'ngày'}</td>
                    <td>
                        <div class="action-menu-container">
                            <button class="action-menu-btn" title="${context.i18n.t('actions')}">
                                <i data-lucide="more-horizontal"></i>
                            </button>
                            <div class="action-menu-dropdown">
                                <button class="action-menu-item delete" data-action="delete-rule" data-rule-id="${rule.id}">
                                    <i data-lucide="trash-2"></i> ${context.i18n.t('delete')}
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>`).join('') || `<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">${context.i18n.t('no_data') || 'Chưa có quy tắc'}</td></tr>`;

            if (window.lucide) window.lucide.createIcons();
        } catch (err) { console.error(err); }
    }

    async function createRule() {
        const keyword = document.getElementById('rule-keyword').value.trim();
        if (!keyword) {
            context.ui.showAlert(context.i18n.t('error_missing_name') || 'Vui lòng nhập tên!', '⚠️');
            return;
        }

        const response = await context.api.post('/api/admin/rules', {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyword,
                defaultDeadlineDays: parseInt(document.getElementById('rule-days').value, 10)
            })
        });

        if (!response.ok) {
            context.ui.showAlert(context.i18n.t('error_saving') || 'Lỗi khi lưu.', '❌');
            return;
        }

        context.ui.showAlert(context.i18n.t('success_saved') || 'Thành công!', '✅');
        closeModal('rule-modal');
        await fetchRules();
    }

    async function deleteRule(id) {
        if (!await context.ui.showConfirm(context.i18n.t('confirm_delete') || 'Xác nhận xóa?')) return;
        await context.api.delete(`/api/admin/rules/${id}`);
        await fetchRules();
    }

    async function downloadBackup() {
        try {
            const blob = await context.api.blob('/api/backup/export');
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `CongVan_Backup_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            context.ui.showAlert(context.i18n.t('success_saved') || 'Đã tải xuống file backup CSV!', '✅');
        } catch (error) {
            context.ui.showAlert(context.i18n.t('error_saving') || 'Lỗi xuất dữ liệu.', '❌');
        }
    }

    return {
        init,
        activateSection
    };
}
