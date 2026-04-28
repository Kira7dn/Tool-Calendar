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
            actions.showTab(tabTarget.dataset.tab);
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
        }
    });
}
