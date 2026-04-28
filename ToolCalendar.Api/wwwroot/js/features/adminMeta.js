export function createAdminMetaFeature(context) {
    function init() {
        document.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'open-dept-modal') openModal('dept-modal');
            if (action.dataset.action === 'close-dept-modal') closeModal('dept-modal');
            if (action.dataset.action === 'create-department') await createDepartment();
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
        document.getElementById(id).style.display = 'flex';
    }

    function closeModal(id) {
        document.getElementById(id).style.display = 'none';
    }

    async function fetchDepartments() {
        const response = await context.api.get('/api/admin/departments');
        if (!response.ok) return;
        const departments = await response.json();
        document.getElementById('dept-body').innerHTML = departments.map((department) => `<tr><td>${department.id}</td><td style="font-weight:600;">${department.name}</td><td style="color:var(--text-secondary);">${department.description || '-'}</td><td><button class="btn" style="padding:4px 10px; font-size:0.8rem; color:var(--danger); background:#fee2e2;" data-action="delete-department" data-department-id="${department.id}">Xoa</button></td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">Chua co phong ban nao</td></tr>';
    }

    async function createDepartment() {
        const name = document.getElementById('dept-name').value.trim();
        if (!name) {
            context.ui.showAlert('Vui long nhap ten phong ban!', '⚠️');
            return;
        }

        const response = await context.api.post('/api/admin/departments', {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description: document.getElementById('dept-desc').value
            })
        });

        if (!response.ok) {
            context.ui.showAlert('Loi khi them.', '❌');
            return;
        }

        context.ui.showAlert('Da them phong ban!', '✅');
        closeModal('dept-modal');
        await fetchDepartments();
    }

    async function deleteDepartment(id) {
        if (!await context.ui.showConfirm('Xoa phong ban nay?')) return;
        await context.api.delete(`/api/admin/departments/${id}`);
        await fetchDepartments();
    }

    async function fetchLabels() {
        const response = await context.api.get('/api/admin/labels');
        if (!response.ok) return;
        const labels = await response.json();
        document.getElementById('labels-body').innerHTML = labels.map((label) => `<tr><td style="font-weight:600;">${label.name}</td><td><span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${label.color || '#c0392b'};vertical-align:middle;"></span> ${label.color || '-'}</td><td><button class="btn" style="padding:4px 10px;font-size:0.8rem;color:var(--danger);background:#fee2e2;" data-action="delete-label" data-label-id="${label.id}">Xoa</button></td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center; color:var(--text-secondary);">Chua co nhan</td></tr>';
    }

    async function createLabel() {
        const name = document.getElementById('label-name').value.trim();
        if (!name) {
            context.ui.showAlert('Vui long nhap ten nhan!', '⚠️');
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
            context.ui.showAlert('Loi.', '❌');
            return;
        }

        context.ui.showAlert('Da them nhan!', '✅');
        closeModal('label-modal');
        await fetchLabels();
    }

    async function deleteLabel(id) {
        if (!await context.ui.showConfirm('Xoa nhan nay?')) return;
        await context.api.delete(`/api/admin/labels/${id}`);
        await fetchLabels();
    }

    async function fetchRules() {
        const response = await context.api.get('/api/admin/rules');
        if (!response.ok) return;
        const rules = await response.json();
        document.getElementById('rules-body').innerHTML = rules.map((rule) => `<tr><td style="font-weight:600;">${rule.keyword}</td><td>${rule.labelId || '-'}</td><td>${rule.defaultDeadlineDays || '-'} ngay</td><td><button class="btn" style="padding:4px 10px;font-size:0.8rem;color:var(--danger);background:#fee2e2;" data-action="delete-rule" data-rule-id="${rule.id}">Xoa</button></td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">Chua co rule</td></tr>';
    }

    async function createRule() {
        const keyword = document.getElementById('rule-keyword').value.trim();
        if (!keyword) {
            context.ui.showAlert('Vui long nhap tu khoa!', '⚠️');
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
            context.ui.showAlert('Loi.', '❌');
            return;
        }

        context.ui.showAlert('Da them rule!', '✅');
        closeModal('rule-modal');
        await fetchRules();
    }

    async function deleteRule(id) {
        if (!await context.ui.showConfirm('Xoa rule nay?')) return;
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
            context.ui.showAlert('Da tai xuong file backup CSV!', '✅');
        } catch (error) {
            context.ui.showAlert('Loi xuat du lieu.', '❌');
        }
    }

    return {
        init,
        activateSection
    };
}
