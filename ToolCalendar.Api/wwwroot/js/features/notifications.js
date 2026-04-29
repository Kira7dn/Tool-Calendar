export function createNotificationsFeature(context) {
    let notifications = [];
    let isDropdownOpen = false;
    let currentFilter = 'all'; // 'all' hoặc 'unread'

    function init() {
        // Lắng nghe sự kiện click toàn cục
        document.addEventListener('click', (event) => {
            const action = event.target.closest('[data-action]');
            const filterTab = event.target.closest('.notif-tab');

            // Đóng dropdown nếu click ra ngoài
            if (isDropdownOpen && !event.target.closest('#notif-bell') && !event.target.closest('#notif-dropdown')) {
                toggleDropdown(false);
            }

            // Xử lý chuyển tab lọc (Tất cả / Chưa đọc)
            if (filterTab) {
                const filter = filterTab.dataset.filter;
                setFilter(filter);
                return;
            }

            if (!action) return;

            // Bật/Tắt dropdown thông báo
            if (action.dataset.action === 'toggle-notif-dropdown') {
                toggleDropdown(!isDropdownOpen);
            }

            // Đánh dấu tất cả là đã đọc
            if (action.dataset.action === 'mark-all-read') {
                markAllAsRead();
            }

            // Xem chi tiết văn bản từ thông báo
            if (action.dataset.action === 'view-notif-doc') {
                const docId = action.dataset.docId;
                const notifId = action.dataset.notifId;

                // Đánh dấu cái này là đã đọc
                markAsRead(notifId);

                if (docId) openDocDetail(docId);
                toggleDropdown(false);
            }
        });

        // Kiểm tra URL xem có docId không
        checkUrlParams();

        // Load thông báo ban đầu
        fetchNotifications();

        // Polling mỗi 5 phút
        setInterval(fetchNotifications, 5 * 60 * 1000);

        // Lắng nghe thông báo realtime từ SSE
        document.addEventListener('realtime:notification', (event) => {
            const data = event.detail;
            const docId = data.data?.docId;

            // Hiệu ứng rung chuông
            ringBell();

            // Thêm vào danh sách (đưa lên đầu)
            const newNotif = {
                id: 'rt_' + Date.now(),
                title: data.title,
                body: data.body,
                time: 'Vừa xong',
                unread: true,
                docId: docId
            };

            notifications.unshift(newNotif);
            renderNotifications();
        });

        // Đăng ký Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(reg => {
                console.log('[ServiceWorker] Registered');
            }).catch(err => console.error('[ServiceWorker] Error', err));
        }
    }

    function ringBell() {
        const bell = document.getElementById('notif-bell');
        if (bell) {
            bell.classList.remove('notif-ring');
            void bell.offsetWidth; // Trigger reflow
            bell.classList.add('notif-ring');
        }
    }

    function setFilter(filter) {
        currentFilter = filter;
        document.querySelectorAll('.notif-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });
        renderNotifications();
    }

    function toggleDropdown(show) {
        isDropdownOpen = show;
        const dropdown = document.getElementById('notif-dropdown');
        if (dropdown) {
            dropdown.style.display = show ? 'block' : 'none';

            // Khi mở chuông, xóa số lượng trên Badge (đã xem)
            if (show) {
                clearBadge();
            }
        }
    }

    function clearBadge() {
        const badge = document.getElementById('notif-badge');
        const badgeMobile = document.getElementById('notif-badge-mobile');
        if (badge) badge.style.display = 'none';
        if (badgeMobile) badgeMobile.style.display = 'none';
    }

    async function fetchNotifications() {
        try {
            const response = await context.api.get('/api/notification');
            if (!response.ok) return;

            const list = await response.json();
            notifications = list.map(n => ({
                id: n.id,
                title: n.title,
                body: n.body,
                time: formatRelativeTime(n.createdAt),
                unread: !n.isRead,
                docId: n.docId
            }));

            renderNotifications();
        } catch (error) {
            console.error('Fetch notifs error', error);
        }
    }

    function formatRelativeTime(dateStr) {
        // Đảm bảo dateStr được hiểu là UTC nếu không có múi giờ
        let date;
        if (dateStr.includes('T') || dateStr.includes('Z')) {
            date = new Date(dateStr);
        } else {
            // SQLite datetime('now') trả về yyyy-MM-dd HH:mm:ss (UTC)
            date = new Date(dateStr.replace(' ', 'T') + 'Z');
        }
        
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Vừa xong';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
        return date.toLocaleDateString('vi-VN');
    }

    function renderNotifications() {
        const badge = document.getElementById('notif-badge');
        const badgeMobile = document.getElementById('notif-badge-mobile');
        const list = document.getElementById('notif-list');

        if (!list) return;

        // Lọc danh sách theo tab
        const filtered = currentFilter === 'unread'
            ? notifications.filter(n => n.unread)
            : notifications;

        const unreadCount = notifications.filter(n => n.unread).length;

        // Cập nhật Badge (chỉ hiện nếu dropdown đang đóng)
        if (!isDropdownOpen) {
            if (badge) {
                badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
                badge.style.display = unreadCount > 0 ? 'flex' : 'none';
            }
            if (badgeMobile) {
                badgeMobile.innerText = unreadCount > 9 ? '9+' : unreadCount;
                badgeMobile.style.display = unreadCount > 0 ? 'flex' : 'none';
            }
        }

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="notif-empty-state" style="padding: 40px 20px; text-align: center; color: #65676b;">
                    <div class="empty-icon" style="font-size: 3rem; margin-bottom: 10px;">🔔</div>
                    <p>${currentFilter === 'unread' ? 'Bạn không có thông báo chưa đọc nào' : 'Bạn không có thông báo nào'}</p>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(n => `
            <div class="notif-item-new ${n.unread ? 'unread' : ''}" data-action="view-notif-doc" data-doc-id="${n.docId}" data-notif-id="${n.id}">
                <div class="notif-item-avatar">📄</div>
                <div class="notif-item-content">
                    <div class="notif-item-text" style="${n.unread ? 'font-weight: 600;' : ''}">${n.title}</div>
                    <div class="notif-item-time">${n.time}</div>
                </div>
                ${n.unread ? '<div class="notif-unread-dot"></div>' : ''}
            </div>
        `).join('');
    }

    async function markAsRead(notifId) {
        // Dùng == vì notifId từ dataset là string, còn n.id có thể là number
        const notif = notifications.find(n => n.id == notifId);
        if (notif) {
            notif.unread = false;
            renderNotifications();

            // Nếu id là số (từ DB) thì gọi API
            if (typeof notifId === 'number' || (typeof notifId === 'string' && !notifId.startsWith('rt_'))) {
                await context.api.post(`/api/notification/mark-read/${notifId}`);
            }
        }
    }

    async function markAllAsRead() {
        notifications.forEach(n => n.unread = false);
        renderNotifications();
        await context.api.post('/api/notification/mark-all-read');
    }

    function openDocDetail(docId) {
        if (context.services && context.services.openDocDetail) {
            context.services.openDocDetail(docId);
        }
    }

    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const docId = urlParams.get('docId');
        if (docId) {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            setTimeout(() => openDocDetail(docId), 1500);
        }
    }

    async function requestPermission() {
        if (!('Notification' in window)) return;
        const permission = await Notification.requestPermission();
        if (permission === 'granted') await subscribeUserToPush();
    }

    async function subscribeUserToPush() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const keyResponse = await context.api.get('/api/notification/vapid-public-key');
            if (!keyResponse.ok) return;
            const { publicKey } = await keyResponse.json();

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh'))));
            const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))));

            await context.api.post('/api/notification/subscribe', {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: subscription.endpoint, p256dh, auth })
            });
        } catch (error) { console.error('Push error', error); }
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    }

    return { init, requestPermission };
}
