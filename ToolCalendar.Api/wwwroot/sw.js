// Version: 1.0.2 (2026-04-29)
self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
    let data = { title: 'Thông báo mới', body: 'Bạn có thông báo mới từ ToolCalendar' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/assets/logo.png',
        badge: '/assets/logo.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/',
            ...data.data
        }
    };

    event.waitUntil(
        Promise.all([
            self.registration.showNotification(data.title, options),
            // Broadcast to all clients
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'PUSH_RECEIVED',
                        data: data
                    });
                });
            })
        ])
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    let urlToOpen = event.notification.data.url || '/';
    // Nếu là đường dẫn tương đối (chỉ có query string), trỏ về index.html
    if (urlToOpen.startsWith('?')) {
        urlToOpen = '/index.html' + urlToOpen;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url.indexOf(urlToOpen) !== -1 && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
