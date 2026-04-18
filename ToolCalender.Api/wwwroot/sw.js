self.addEventListener('push', function(event) {
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
        data: data.data || {}
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    // Open the application or a specific page
    event.waitUntil(
        clients.openWindow('/')
    );
});
