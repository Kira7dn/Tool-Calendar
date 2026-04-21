function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let index = 0; index < rawData.length; index += 1) {
        outputArray[index] = rawData.charCodeAt(index);
    }
    return outputArray;
}

export function createNotificationsFeature(context) {
    function init() {
        initNotifications();
        checkBanner();
    }

    async function initNotifications() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push notifications not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            if (Notification.permission === 'denied') return;

            if (Notification.permission !== 'granted') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return;
            }

            const vapidResponse = await context.api.get('/api/notification/vapid-public-key');
            if (!vapidResponse.ok) return;
            const { publicKey } = await vapidResponse.json();

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            const data = subscription.toJSON();
            await context.api.post('/api/notification/subscribe', {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: data.endpoint,
                    p256dh: data.keys.p256dh,
                    auth: data.keys.auth
                })
            });
        } catch (error) {
            console.error('Push notification setup failed:', error);
        }
    }

    async function requestPermission() {
        const banner = document.getElementById('notif-banner');
        if (!('Notification' in window)) return;

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            if (banner) banner.style.display = 'none';
            await initNotifications();
            context.ui.showAlert('Thong bao day da duoc bat thanh cong!', '🔔');
        } else {
            context.ui.showAlert('Quyen thong bao bi tu choi.', '⚠️');
        }
    }

    function checkBanner() {
        const banner = document.getElementById('notif-banner');
        if (!banner) return;
        if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
        if (Notification.permission === 'default') {
            banner.style.display = 'inline-flex';
        }
    }

    return {
        init,
        requestPermission
    };
}
