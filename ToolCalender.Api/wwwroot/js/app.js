// State Management
let currentTab = 'dashboard';
let documents = [];
let stats = {};

// Constant Elements
const statsIds = ['stat-total', 'stat-urgent', 'stat-overdue', 'stat-today'];

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // 0. Kiểm tra xác thực
    if (!localStorage.getItem('auth_token')) {
        window.location.href = 'login.html';
        return;
    }
    
    // Hiển thị thông tin người dùng
    const username = localStorage.getItem('user_name') || 'User';
    const role = localStorage.getItem('user_role') || 'CanBo';
    document.querySelector('.user-pill p:last-child').innerText = `${username} (${role})`;

    applyRoleRestrictions(role);
    initNav();
    fetchData();
    initUpload();
    initNotifications();
});

async function initNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications not supported');
        return;
    }

    try {
        // Register Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW Registered');

        // Check for permission
        if (Notification.permission === 'denied') return;
        
        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
        }

        // Get VAPID public key
        const token = localStorage.getItem('auth_token');
        const vapidRes = await fetch('/api/notification/vapid-public-key', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { publicKey } = await vapidRes.json();

        // Subscribe
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // Send to backend
        const subData = subscription.toJSON();
        await fetch('/api/notification/subscribe', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                endpoint: subData.endpoint,
                p256dh: subData.keys.p256dh,
                auth: subData.keys.auth
            })
        });

        console.log('Push subscription successful');
    } catch (error) {
        console.error('Push notification setup failed:', error);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function applyRoleRestrictions(role) {
    // 1. Chỉ Admin mới thấy Tab Nhân sự
    if (role === 'Admin') {
        document.getElementById('nav-users').style.display = 'flex';
    }

    // 2. Chỉ Admin và Văn thư mới thấy nút Thêm văn bản / Tab Upload
    if (role !== 'Admin' && role !== 'VanThu') {
        document.querySelector('.header-actions').style.display = 'none';
        document.querySelector('[data-tab="upload"]').style.display = 'none';
    }
}

// Navigation logic
function initNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            showTab(tabId);
        });
    });
}

function showTab(tabId) {
    // UI Update
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById(`tab-${tabId}`).style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });

    currentTab = tabId;
    if (tabId === 'users') fetchUsers();
}

// Data Fetching
async function fetchData() {
    const token = localStorage.getItem('auth_token');
    try {
        const [docsRes, statsRes] = await Promise.all([
            fetch('/api/documents', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('/api/stats', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (docsRes.status === 401 || statsRes.status === 401) {
            logout();
            return;
        }

        documents = await docsRes.json();
        stats = await statsRes.json();

        updateStatsUI();
        renderTables();
        renderChart();
    } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
    }
}

function updateStatsUI() {
    document.getElementById('stat-total').innerText = stats.total || 0;
    document.getElementById('stat-urgent').innerText = stats.urgent || 0;
    document.getElementById('stat-overdue').innerText = stats.overdue || 0;
    document.getElementById('stat-today').innerText = stats.today || 0;
}

function renderTables() {
    // Recent Table (Limit to 5)
    const recentBody = document.querySelector('#recent-docs tbody');
    recentBody.innerHTML = documents.slice(0, 5).map(doc => `
        <tr>
            <td style="font-weight: 600;">${doc.soVanBan}</td>
            <td class="text-truncate" style="max-width: 300px;">${doc.trichYeu}</td>
            <td>${formatDate(doc.thoiHan)}</td>
            <td><span class="badge ${getBadgeClass(doc.soNgayConLai)}">${doc.trangThai}</span></td>
        </tr>
    `).join('');

    // Full Table
    const role = localStorage.getItem('user_role');
    const allBody = document.querySelector('#all-docs-table tbody');
    allBody.innerHTML = documents.map(doc => `
        <tr>
            <td style="font-weight: 600;">${doc.soVanBan}</td>
            <td>${formatDate(doc.ngayBanHanh)}</td>
            <td>${doc.trichYeu}</td>
            <td>${doc.coQuanChuQuan}</td>
            <td>${formatDate(doc.thoiHan)}</td>
            <td><span class="badge ${getBadgeClass(doc.soNgayConLai)}">${doc.trangThai}</span></td>
            ${role === 'Admin' ? `<td><button class="btn btn-sm" style="color: var(--danger); background: rgba(239, 68, 68, 0.1);" onclick="deleteDocument(${doc.id})">🗑️ Xóa</button></td>` : ''}
        </tr>
    `).join('');

    // Update Header if Admin
    if (role === 'Admin' && !document.getElementById('header-action-col')) {
        const headerRow = document.querySelector('#all-docs-table thead tr');
        const th = document.createElement('th');
        th.id = 'header-action-col';
        th.innerText = 'Thao tác';
        headerRow.appendChild(th);
    }
}

let myChart;
function renderChart() {
    const ctx = document.getElementById('statChart').getContext('2d');
    
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Quá hạn', 'Sắp hết hạn', 'Đúng hạn'],
            datasets: [{
                data: [stats.overdue, stats.urgent, stats.total - stats.overdue - stats.urgent],
                backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
                borderWidth: 0,
                offset: 10
            }]
        },
        options: {
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8' } }
            },
            cutout: '70%',
            responsive: true
        }
    });
}

// Upload Handling
function initUpload() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = 'rgba(55, 114, 255, 0.05)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = 'rgba(255, 255, 255, 0.02)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = 'rgba(255, 255, 255, 0.02)';
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleFile(fileInput.files[0]);
    });
}

async function handleFile(file) {
    document.getElementById('upload-processing').style.display = 'block';
    document.getElementById('ocr-result').style.display = 'none';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (res.status === 401) { logout(); return; }
        if (!res.ok) throw new Error('OCR Failed');

        const result = await res.json();
        
        // Populate Result Form
        document.getElementById('ocr-so').value = result.soVanBan || '';
        document.getElementById('ocr-trichyeu').value = result.trichYeu || '';
        if (result.thoiHan) {
            document.getElementById('ocr-han').value = result.thoiHan.split('T')[0];
        }

        document.getElementById('upload-processing').style.display = 'none';
        document.getElementById('ocr-result').style.display = 'block';
        window._currentTempData = result; // Store for saving

    } catch (error) {
        alert('Lỗi xử lý OCR: ' + error.message);
        document.getElementById('upload-processing').style.display = 'none';
    }
}

async function saveDocument() {
    const data = {
        ...window._currentTempData,
        soVanBan: document.getElementById('ocr-so').value,
        trichYeu: document.getElementById('ocr-trichyeu').value,
        thoiHan: document.getElementById('ocr-han').value ? document.getElementById('ocr-han').value + "T00:00:00" : null
    };

    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/documents', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (res.status === 401) { logout(); return; }
        if (res.ok) {
            alert('Lưu văn bản thành công!');
            showTab('dashboard');
            fetchData();
        }
    } catch (error) {
        alert('Lỗi khi lưu: ' + error.message);
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

function cancelUpload() {
    document.getElementById('ocr-result').style.display = 'none';
    window._currentTempData = null;
}

// User Management Logic
async function fetchUsers() {
    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.status === 401) { logout(); return; }
        const users = await res.json();
        renderUsers(users);
    } catch (e) { console.error(e); }
}

function renderUsers(users) {
    const body = document.querySelector('#users-table tbody');
    body.innerHTML = users.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${u.username}</td>
            <td><span class="badge badge-success">${u.role}</span></td>
            <td>
                ${u.username !== 'admin' ? `<button class="btn btn-sm" style="color: var(--danger)" onclick="deleteUser(${u.id})">Xóa</button>` : '—'}
            </td>
        </tr>
    `).join('');
}

function openUserModal() { document.getElementById('user-modal').style.display = 'flex'; }
function closeUserModal() { document.getElementById('user-modal').style.display = 'none'; }

async function createUser() {
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;

    if (!username || !password) { alert('Vui lòng nhập đủ tin!'); return; }

    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ username, password, role })
        });
        if (res.ok) {
            alert('Tạo user thành công!');
            closeUserModal();
            fetchUsers();
        } else {
            const err = await res.json();
            alert(err.message || 'Lỗi khi tạo user');
        }
    } catch (e) { alert('Lỗi kết nối'); }
}

async function deleteUser(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return;
    const token = localStorage.getItem('auth_token');
    try {
        await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        fetchUsers();
    } catch (e) { alert('Lỗi khi xóa'); }
}

async function deleteDocument(id) {
    if (!confirm('Xóa văn bản này?')) return;
    const token = localStorage.getItem('auth_token');
    try {
        await fetch(`/api/documents/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        fetchData();
    } catch (e) { alert('Lỗi khi xóa'); }
}

// Helpers
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN');
}

function getBadgeClass(days) {
    if (days < 0) return 'badge-danger';
    if (days <= 7) return 'badge-warning';
    return 'badge-success';
}
