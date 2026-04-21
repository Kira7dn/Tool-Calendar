export function createUsersFeature(context) {
    function init() {
        document.getElementById('tab-users')?.addEventListener('click', async (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;

            if (action.dataset.action === 'open-user-modal') {
                openModal();
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

            if (action.dataset.action === 'create-user') {
                await createUser();
            }
        });
    }

    async function activate() {
        await refresh();
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

    function render(users) {
        const body = document.querySelector('#users-table tbody');
        if (!body) return;

        body.innerHTML = users.map((user) => `
            <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td><span class="badge badge-success">${user.role}</span></td>
                <td>${user.username !== 'admin' ? `<button class="btn btn-sm" style="color: var(--danger)" data-action="delete-user" data-user-id="${user.id}">Xoa</button>` : '-'}</td>
            </tr>
        `).join('');
    }

    function openModal() {
        document.getElementById('user-modal').style.display = 'flex';
    }

    function closeModal() {
        document.getElementById('user-modal').style.display = 'none';
    }

    async function createUser() {
        const username = document.getElementById('new-username').value;
        const password = document.getElementById('new-password').value;
        const role = document.getElementById('new-role').value;

        if (!username || !password) {
            context.ui.showAlert('Vui long nhap du thong tin!', '⚠️');
            return;
        }

        try {
            const response = await context.api.post('/api/users', {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });

            if (!response.ok) {
                const error = await response.json();
                context.ui.showAlert(error.message || 'Loi khi tao nguoi dung', '❌');
                return;
            }

            context.ui.showAlert('Tao nguoi dung thanh cong!', '✅');
            closeModal();
            await refresh();
        } catch (error) {
            context.ui.showAlert('Loi ket noi', '📡');
        }
    }

    async function deleteUser(id) {
        const confirmed = await context.ui.showConfirm('Ban co chac chan muon xoa nguoi dung nay?');
        if (!confirmed) return;

        try {
            await context.api.delete(`/api/users/${id}`);
            await refresh();
        } catch (error) {
            context.ui.showAlert('Loi khi xoa', '❌');
        }
    }

    return {
        init,
        activate
    };
}
