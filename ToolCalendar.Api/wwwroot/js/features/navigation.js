export function bindShellNavigation(actions) {
    const logo = document.getElementById('app-logo');
    if (logo) {
        logo.addEventListener('error', () => {
            logo.src = 'https://via.placeholder.com/32';
        }, { once: true });
    }

    document.addEventListener('click', async (event) => {
        const tabTarget = event.target.closest('[data-tab]');
        if (tabTarget) {
            event.preventDefault();
            const tabId = tabTarget.dataset.tab;
            actions.showTab(tabId);

            // Đồng bộ class active cho Bottom Nav
            document.querySelectorAll('.bottom-nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.tab === tabId);
            });
            return;
        }

        const actionTarget = event.target.closest('[data-action]');
        if (!actionTarget) return;

        const shellAction = actionTarget.dataset.action;
        if (shellAction === 'open-sidebar') {
            event.preventDefault();
            actions.openSidebar();
            return;
        }

        if (shellAction === 'close-sidebar') {
            event.preventDefault();
            actions.closeSidebar();
            return;
        }

        if (shellAction === 'toggle-sidebar') {
            event.preventDefault();
            actions.toggleSidebar();
            return;
        }

        if (shellAction === 'logout') {
            event.preventDefault();
            actions.logout();
            return;
        }

        if (shellAction === 'request-notification-permission') {
            event.preventDefault();
            await actions.requestNotificationPermission();
            return;
        }

        if (shellAction === 'toggle-user-dropdown') {
            event.preventDefault();
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown) {
                const isOpen = dropdown.style.display === 'block';
                dropdown.style.display = isOpen ? 'none' : 'block';
                
                // Cập nhật tên trong dropdown
                if (!isOpen) {
                    const name = localStorage.getItem('user_name') || 'Admin';
                    const nameEl = document.getElementById('dropdown-user-name');
                    if (nameEl) nameEl.innerText = name;
                }
            }
            return;
        }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.user-profile-container')) {
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown) dropdown.style.display = 'none';
        }
    });
}
