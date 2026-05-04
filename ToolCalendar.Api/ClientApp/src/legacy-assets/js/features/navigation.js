export function bindShellNavigation(actions) {
    const logo = document.getElementById('app-logo');
    if (logo) {
        logo.addEventListener('error', () => {
            logo.src = 'https://via.placeholder.com/32';
        }, { once: true });
    }
    document.addEventListener('click', async (event) => {
        // Toggle action menu dropdown (Global)
        const menuBtn = event.target.closest('.action-menu-btn');
        if (menuBtn) {
            console.log('[Navigation] Action menu clicked');
            event.preventDefault();
            event.stopPropagation();

            const dropdown = menuBtn.nextElementSibling;
            if (!dropdown) return;

            const isActive = dropdown.classList.contains('active');

            // Close all other active menus
            document.querySelectorAll('.action-menu-dropdown.active').forEach(d => d.classList.remove('active'));

            // Toggle current
            if (!isActive) {
                dropdown.classList.add('active');
            }
            return;
        }

        // Close all dropdowns if clicking outside
        if (!event.target.closest('.action-menu-container')) {
            document.querySelectorAll('.action-menu-dropdown.active').forEach(d => d.classList.remove('active'));
        }

        const tabTarget = event.target.closest('[data-tab]');
        if (tabTarget) {
            event.preventDefault();
            const tabId = tabTarget.dataset.tab;
            actions.showTab(tabId);

            const dropdown = document.getElementById('user-dropdown');
            if (dropdown) dropdown.style.display = 'none';

            // Close action menus on tab change
            document.querySelectorAll('.action-menu-dropdown.active').forEach(d => d.classList.remove('active'));

            // Đồng bộ class active cho Bottom Nav
            document.querySelectorAll('.bottom-nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.tab === tabId);
            });
            return;
        }

        const actionTarget = event.target.closest('[data-action]');
        if (!actionTarget) return;

        const shellAction = actionTarget.dataset.action;

        // Auto-close action menu after choosing an action
        const actionDropdown = actionTarget.closest('.action-menu-dropdown');
        if (actionDropdown) actionDropdown.classList.remove('active');

        if (shellAction === 'toggle-user-dropdown') {
            event.preventDefault();
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown) {
                const isOpen = dropdown.style.display === 'block';
                dropdown.style.display = isOpen ? 'none' : 'block';
                if (!isOpen) {
                    const name = localStorage.getItem('user_name') || 'Admin';
                    const nameEl = document.getElementById('dropdown-user-name');
                    if (nameEl) nameEl.innerText = name;
                }
            }
            return;
        }

        // Auto-close dropdown for any other shell action
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.style.display = 'none';

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
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.user-profile-container')) {
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown) dropdown.style.display = 'none';
        }
    });
}
