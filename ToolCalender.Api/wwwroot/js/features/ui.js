export function createUiFeature() {
    let confirmResolver = null;

    function init() {
        document.getElementById('custom-alert')?.addEventListener('click', (event) => {
            if (event.target.closest('[data-action="close-alert"]')) {
                closeAlert();
            }
        });

        document.getElementById('custom-confirm')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action="confirm-resolve"]');
            if (!button) return;
            resolveConfirm(button.dataset.confirmValue === 'true');
        });
    }

    function showAlert(message, icon = '🔔') {
        const modal = document.getElementById('custom-alert');
        if (!modal) return;

        document.getElementById('alert-message').innerText = message;
        document.getElementById('alert-icon').innerText = icon;
        modal.style.display = 'flex';
    }

    function closeAlert() {
        const modal = document.getElementById('custom-alert');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function showConfirm(message) {
        const modal = document.getElementById('custom-confirm');
        if (!modal) {
            return Promise.resolve(false);
        }

        document.getElementById('confirm-message').innerText = message;
        modal.style.display = 'flex';

        return new Promise((resolve) => {
            confirmResolver = resolve;
        });
    }

    function resolveConfirm(value) {
        const modal = document.getElementById('custom-confirm');
        if (modal) {
            modal.style.display = 'none';
        }

        if (confirmResolver) {
            confirmResolver(value);
            confirmResolver = null;
        }
    }

    return {
        init,
        showAlert,
        closeAlert,
        showConfirm
    };
}
