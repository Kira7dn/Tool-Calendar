export function createUsersFeature(context) {
    let departments = [];

    function init() {
        document.getElementById('tab-users')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'open-user-modal') {
                openModal();
            }

            if (action.dataset.action === 'edit-user') {
                await openModal(parseInt(action.dataset.userId, 10), action);
            }

            if (action.dataset.action === 'delete-user') {
                await deleteUser(parseInt(action.dataset.userId, 10));
            }
        });

        document.getElementById('user-modal')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'close-user-modal') {
                closeModal();
            }

            if (action.dataset.action === 'save-user') {
                const id = document.getElementById('edit-user-id').value;
                if (id) {
                    await updateUser(parseInt(id, 10));
                } else {
                    await createUser();
                }
            }
        });
    }

    async function activate() {
        await fetchDepartments();
        await refresh();
    }

    async function fetchDepartments() {
        try {
            const response = await context.api.get('/api/admin/departments');
            if (response.ok) {
                departments = await response.json();
                const select = document.getElementById('new-department');
                if (select) {
                    select.innerHTML = '<option value="">-- Chọn phòng ban --</option>' + 
                        departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
                }
            }
        } catch (error) {
            console.error('Dept load error:', error);
        }
    }

    async function refresh() {
        try {
            const response = await context.api.get('/api/users');
            if (!response.ok) return;
            render(await response.json());
        } catch (error) {
            console.error('User load error:', error);
        }
    }

    function getRoleBadgeClass(role) {
        switch (role) {
            case 'Admin': return 'badge-danger';
            case 'LanhDao': return 'badge-primary';
            case 'VanThu': return 'badge-warning';
            case 'CanBo': return 'badge-success';
            default: return 'badge-secondary';
        }
    }

    function render(users) {
        const body = document.querySelector('#users-table tbody');
        if (!body) return;

        body.innerHTML = users.map((user) => `
            <tr>
                <td class="col-id">${user.id}</td>
                <td class="col-name"><strong>${user.fullName || user.FullName || '-'}</strong></td>
                <td class="col-username">${user.username || user.Username}</td>
                <td class="col-email">${user.email || user.Email || '-'}</td>
                <td class="col-phone">${user.phoneNumber || user.PhoneNumber || '-'}</td>
                <td class="col-dept"><span class="badge badge-dept">${user.departmentName || user.DepartmentName || 'Chưa gán'}</span></td>
                <td class="col-role"><span class="badge ${getRoleBadgeClass(user.role || user.Role)}">${user.role || user.Role}</span></td>
                <td style="white-space: nowrap;" class="col-actions">
                    <button class="btn btn-sm" style="color: var(--primary); padding: 6px;" 
                        title="Sửa"
                        data-action="edit-user" 
                        data-user-id="${user.id}"
                        data-fullname="${user.fullName || user.FullName || ''}"
                        data-email="${user.email || user.Email || ''}"
                        data-phone="${user.phoneNumber || user.PhoneNumber || ''}"
                        data-role="${user.role || user.Role}"
                        data-dept-id="${user.departmentId || user.DepartmentId || ''}">
                        <i data-lucide="pencil" style="width: 16px; height: 16px;"></i>
                    </button>
                    ${user.username !== 'admin' ? `
                    <button class="btn btn-sm" style="color: var(--danger); padding: 6px;" 
                        title="Xóa"
                        data-action="delete-user" 
                        data-user-id="${user.id}">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                    </button>` : ''}
                </td>
            </tr>
        `).join('');

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    async function openModal(userId = null, button = null) {
        const modal = document.getElementById('user-modal');
        const title = document.getElementById('user-modal-title');
        const idInput = document.getElementById('edit-user-id');
        const userGroup = document.getElementById('username-group');
        const passGroup = document.getElementById('password-group');

        // Reset form
        idInput.value = userId || '';
        document.getElementById('new-username').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('new-fullname').value = '';
        document.getElementById('new-email').value = '';
        document.getElementById('new-phone').value = '';
        document.getElementById('new-role').value = 'CanBo';
        document.getElementById('new-department').value = '';

        if (userId) {
            title.innerText = 'Chỉnh sửa tài khoản';
            userGroup.style.display = 'none';
            passGroup.style.display = 'none';

            if (button) {
                // Populate from button attributes immediately
                document.getElementById('new-fullname').value = button.dataset.fullname || '';
                document.getElementById('new-email').value = button.dataset.email || '';
                document.getElementById('new-phone').value = button.dataset.phone || '';
                document.getElementById('new-role').value = button.dataset.role || 'CanBo';
                document.getElementById('new-department').value = button.dataset.deptId || '';
            } else {
                // Fallback to API
                try {
                    const response = await context.api.get(`/api/users/${userId}`);
                    if (response.ok) {
                        const user = await response.json();
                        document.getElementById('new-fullname').value = user.fullName || user.FullName || '';
                        document.getElementById('new-email').value = user.email || user.Email || '';
                        document.getElementById('new-phone').value = user.phoneNumber || user.PhoneNumber || '';
                        document.getElementById('new-role').value = user.role || user.Role;
                        document.getElementById('new-department').value = user.departmentId || user.DepartmentId || '';
                    }
                } catch (error) {
                    console.error('Load user for edit failed:', error);
                }
            }
        } else {
            title.innerText = 'Tạo tài khoản mới';
            userGroup.style.display = 'block';
            passGroup.style.display = 'block';
        }

        modal.style.display = 'flex';
    }

    function closeModal() {
        document.getElementById('user-modal').style.display = 'none';
    }

    async function createUser() {
        const username = document.getElementById('new-username').value;
        const passwordHash = document.getElementById('new-password').value; // In the model it's PasswordHash
        const fullName = document.getElementById('new-fullname').value;
        const email = document.getElementById('new-email').value;
        const phoneNumber = document.getElementById('new-phone').value;
        const role = document.getElementById('new-role').value;
        const departmentId = document.getElementById('new-department').value;

        if (!username || !passwordHash) {
            context.ui.showAlert('Vui lòng nhập Username và Mật khẩu!', '⚠️');
            return;
        }

        try {
            const response = await context.api.post('/api/users', {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    passwordHash, 
                    fullName, 
                    email, 
                    phoneNumber, 
                    role, 
                    departmentId: departmentId ? parseInt(departmentId, 10) : null 
                })
            });

            if (!response.ok) {
                const error = await response.json();
                context.ui.showAlert(error.message || 'Lỗi khi tạo người dùng', '❌');
                return;
            }

            context.ui.showAlert('Tạo người dùng thành công!', '✅');
            closeModal();
            await refresh();
        } catch (error) {
            context.ui.showAlert('Lỗi kết nối', '📡');
        }
    }

    async function updateUser(id) {
        const fullName = document.getElementById('new-fullname').value;
        const email = document.getElementById('new-email').value;
        const phoneNumber = document.getElementById('new-phone').value;
        const role = document.getElementById('new-role').value;
        const departmentId = document.getElementById('new-department').value;

        try {
            const response = await context.api.put(`/api/users/${id}`, {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    fullName, 
                    email, 
                    phoneNumber, 
                    role, 
                    departmentId: departmentId ? parseInt(departmentId, 10) : null 
                })
            });

            if (!response.ok) {
                context.ui.showAlert('Lỗi khi cập nhật', '❌');
                return;
            }

            context.ui.showAlert('Cập nhật thành công!', '✅');
            closeModal();
            await refresh();
        } catch (error) {
            context.ui.showAlert('Lỗi kết nối', '📡');
        }
    }

    async function deleteUser(id) {
        const confirmed = await context.ui.showConfirm('Bạn có chắc chắn muốn xóa người dùng này?');
        if (!confirmed) return;

        try {
            await context.api.delete(`/api/users/${id}`);
            await refresh();
        } catch (error) {
            context.ui.showAlert('Lỗi khi xóa', '❌');
        }
    }

    return {
        init,
        activate
    };
}
