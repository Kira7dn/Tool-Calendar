export function createNotificationsFeature(context) {
    let notifications = [];
    let isDropdownOpen = false;
    let currentFilter = 'all'; // 'all' hoặc 'unread'

    function init() {
        // Lắng nghe sự kiện click toàn cục
        document.addEventListener('click', (event) => {
            const action = event.target.closest('[data-action]');
            const filterTab = event.target.closest('.notif-tab');
            const mobileFilterTab = event.target.closest('.mobile-notif-tab');

            // === MOBILE NOTIF PANEL ===
            // Mở panel mobile khi click nút thông báo dưới bottom nav
            const btn = event.target.closest('#mobile-notif-btn') || event.target.closest('[data-action="open-mobile-notif"]');
            if (btn) {
                openMobilePanel();
                return;
            }

            // Đóng panel mobile khi click nút Back
            if (event.target.closest('#mobile-notif-back')) {
                closeMobilePanel();
                return;
            }

            // Tab lọc trên mobile panel
            if (mobileFilterTab) {
                const filter = mobileFilterTab.dataset.filter;
                setMobileFilter(filter);
                return;
            }

            // === DESKTOP DROPDOWN ===
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

                // Đánh dấu đã đọc
                markAsRead(notifId);

                // Đóng desktop dropdown ngay lập tức
                toggleDropdown(false);

                // Đóng mobile panel (có animation 360ms)
                closeMobilePanel();

                // Mở trang chi tiết sau khi panel đã bắt đầu đóng
                // 50ms đủ để browser process sự kiện, animation panel chạy nền
                if (docId) {
                    // Trên mobile mặc định mở tab 'content' để xem các trang văn bản
                    const initialTab = window.innerWidth <= 768 ? 'content' : 'view';
                    setTimeout(() => openDocDetail(docId, initialTab), 50);
                }
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
            renderMobileNotifications();

            // Hiển thị Toast thông báo nổi ngay lập tức
            if (context.ui && context.ui.showToast) {
                context.ui.showToast(data.title, 'info');
            }
        });

        // Lắng nghe Service Worker gửi tin nhắn
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'PUSH_RECEIVED') {
                    console.log('[Notifications] Push received from SW, fetching new data...');
                    fetchNotifications();
                    ringBell();
                }
            });

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

    let isMobilePanelOpen = false;
    let mobilePanelFilter = 'all';

    function openMobilePanel() {
        const panel = document.getElementById('mobile-notif-panel');
        const overlay = document.getElementById('mobile-notif-overlay');
        if (!panel) return;

        panel.style.display = 'flex';
        // Trigger animation after setting display
        setTimeout(() => {
            panel.classList.add('active');
            if (overlay) overlay.classList.add('active');
        }, 10);

        isMobilePanelOpen = true;
        clearBadge();
        renderMobileNotifications();
        if (window.lucide) window.lucide.createIcons();
    }

    function closeMobilePanel() {
        const panel = document.getElementById('mobile-notif-panel');
        const overlay = document.getElementById('mobile-notif-overlay');
        if (!panel) return;

        panel.classList.remove('active');
        if (overlay) overlay.classList.remove('active');

        // Hide after animation
        setTimeout(() => {
            if (!panel.classList.contains('active')) {
                panel.style.display = 'none';
            }
        }, 300);
        isMobilePanelOpen = false;
    }

    function setMobileFilter(filter) {
        mobilePanelFilter = filter;
        document.querySelectorAll('.mobile-notif-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });
        renderMobileNotifications();
    }

    function renderMobileNotifications() {
        const list = document.getElementById('mobile-notif-list');
        if (!list) return;

        const filtered = mobilePanelFilter === 'unread'
            ? notifications.filter(n => n.unread)
            : notifications;

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="padding:60px 20px; text-align:center; color:#65676b;">
                    <div style="font-size:3rem; margin-bottom:12px;">🔔</div>
                    <p style="font-weight:600;">${mobilePanelFilter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}</p>
                </div>`;
            return;
        }

        list.innerHTML = filtered.map((n, i) => `
            <div class="mobile-notif-item ${n.unread ? 'unread' : ''}" 
                 data-action="view-notif-doc" data-doc-id="${n.docId}" data-notif-id="${n.id}">
                <div class="mobile-notif-avatar">${n.unread ? '🔔' : '📄'}</div>
                <div class="mobile-notif-content">
                    <div class="mobile-notif-text">${n.title}</div>
                    <div class="mobile-notif-time">${n.time}</div>
                </div>
                ${n.unread ? '<div class="mobile-notif-dot"></div>' : ''}
            </div>
        `).join('');
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
            renderMobileNotifications();
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
