/* eslint-disable no-undef, no-unused-vars */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    if (event.data) {
      data = event.data.json()
    }
  } catch (e) {
    data = { title: 'Thông báo', body: event.data ? event.data.text() : 'Bạn có thông báo mới' }
  }

  const title = data.title || 'Hệ thống điều phối'
  const options = {
    body: data.body || 'Bạn có thông báo mới',
    icon: '/assets/logo.png',
    badge: '/assets/logo.png',
    data: data.data || {},
  }

  // Gửi message tới trình duyệt đang mở để cập nhật UI (vd: chuông thông báo)
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'PUSH_RECEIVED', payload: data })
    })
  })

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Chuyển hướng người dùng khi click vào thông báo (nếu có URL)
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        // If so, just focus it.
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      // If not, then open the target URL in a new window/tab.
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
    })
  )
})
