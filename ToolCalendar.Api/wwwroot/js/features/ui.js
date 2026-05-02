export function createUiFeature() {
    let confirmResolver = null;
    let toastContainer = null;

    function init() {
        // Create toast container
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);

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

    function showAlert(message, icon = '🔔', onClick = null) {
        // Determine type based on icon
        let type = 'info';
        if (icon === '✅') type = 'success';
        if (icon === '❌' || icon === '🚫') type = 'error';
        if (icon === '⚠️') type = 'warning';

        showToast(message, type, icon);

        if (onClick) {
            // If there's a callback, we might still want the modal or just run it on toast click
            // For simplicity, we'll keep the toast simple.
        }
    }

    function showToast(message, type = 'info', icon = '🔔') {
        if (!toastContainer) {
            toastContainer = document.querySelector('.toast-container') || document.createElement('div');
            if (!toastContainer.parentElement) {
                toastContainer.className = 'toast-container';
                document.body.appendChild(toastContainer);
            }
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const title = type === 'success' ? 'Thành công' :
            type === 'error' ? 'Lỗi' :
                type === 'warning' ? 'Cảnh báo' : 'Thông báo';

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">✕</button>
        `;

        toastContainer.appendChild(toast);

        // Trigger reflow for animation
        setTimeout(() => toast.classList.add('show'), 10);

        const closeBtn = toast.querySelector('.toast-close');
        const closeToast = () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        };

        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closeToast();
        };

        toast.onclick = closeToast;

        // Auto hide after 4s
        setTimeout(closeToast, 4000);
    }

    function closeAlert() {
        const modal = document.getElementById('custom-alert');
        if (modal) modal.style.display = 'none';
    }

    function showConfirm(message) {
        const modal = document.getElementById('custom-confirm');
        if (!modal) return Promise.resolve(false);

        document.getElementById('confirm-message').innerText = message;
        modal.style.display = 'flex';

        return new Promise((resolve) => {
            confirmResolver = resolve;
        });
    }

    function resolveConfirm(value) {
        const modal = document.getElementById('custom-confirm');
        if (modal) modal.style.display = 'none';

        if (confirmResolver) {
            confirmResolver(value);
            confirmResolver = null;
        }
    }

    return {
        init,
        showAlert,
        closeAlert,
        showConfirm,
        showToast
    };
}
