// State Management
let currentTab = 'dashboard';
let documents = [];
let stats = {};
let _docPage = 1;
const _docPageSize = 10;

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

    const searchInput = document.getElementById('doc-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            _docPage = 1;
            renderTables();
        });
    }
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
    // Remove active from all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active-tab');
        tab.style.display = '';
    });

    // Activate the clicked tab
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add('active-tab');

    // Update nav state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });

    currentTab = tabId;
    if (tabId === 'users') fetchUsers();

    // Close sidebar on mobile after navigation
    closeSidebar();
}

function openSidebar() {
    document.querySelector('.sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('active');
}

function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
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
    const searchVal = document.getElementById('doc-search').value.toLowerCase();
    const filteredDocs = documents.filter(doc =>
        (doc.soVanBan && doc.soVanBan.toLowerCase().includes(searchVal)) ||
        (doc.trichYeu && doc.trichYeu.toLowerCase().includes(searchVal)) ||
        (doc.coQuanChuQuan && doc.coQuanChuQuan.toLowerCase().includes(searchVal))
    );

    const totalDocPages = Math.ceil(filteredDocs.length / _docPageSize) || 1;
    if (_docPage > totalDocPages) _docPage = totalDocPages;
    if (_docPage < 1) _docPage = 1;

    document.getElementById('docs-page-info').innerText = `Trang ${_docPage} / ${totalDocPages}`;
    document.getElementById('btn-prev-docs').disabled = _docPage === 1;
    document.getElementById('btn-next-docs').disabled = _docPage === totalDocPages;

    const start = (_docPage - 1) * _docPageSize;
    const end = start + _docPageSize;
    const pageItems = filteredDocs.slice(start, end);

    const role = localStorage.getItem('user_role');
    const allBody = document.querySelector('#all-docs-table tbody');
    allBody.innerHTML = pageItems.map(doc => `
        <tr>
            <td style="font-weight: 600;">${doc.soVanBan}</td>
            <td>${formatDate(doc.ngayBanHanh)}</td>
            <td>${doc.trichYeu}</td>
            <td>${doc.coQuanChuQuan || ''}</td>
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

function prevDocPage() {
    if (_docPage > 1) {
        _docPage--;
        renderTables();
    }
}

function nextDocPage() {
    const searchVal = document.getElementById('doc-search').value.toLowerCase();
    const filteredDocs = documents.filter(doc =>
        (doc.soVanBan && doc.soVanBan.toLowerCase().includes(searchVal)) ||
        (doc.trichYeu && doc.trichYeu.toLowerCase().includes(searchVal)) ||
        (doc.coQuanChuQuan && doc.coQuanChuQuan.toLowerCase().includes(searchVal))
    );
    const totalPages = Math.ceil(filteredDocs.length / _docPageSize);
    if (_docPage < totalPages) {
        _docPage++;
        renderTables();
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
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleFiles(fileInput.files);
    });

    const folderInput = document.getElementById('folder-input');
    if (folderInput) {
        folderInput.addEventListener('change', () => {
            if (folderInput.files.length) {
                handleFiles(folderInput.files);
                folderInput.value = ''; // Reset to allow picking same folder again
            }
        });
    }
}

window._sessionUploads = [];
let _batchPage = 1;
const _batchPageSize = 5;

async function handleFiles(files) {
    document.getElementById('upload-processing').style.display = 'block';
    document.getElementById('upload-actions').style.display = 'none';
    document.getElementById('batch-upload-result').style.display = 'none';

    // Convert to array and filter out non-pdfs if needed
    const fileArray = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));

    if (fileArray.length === 0) {
        showAlert("Không tìm thấy file PDF nào hợp lệ để upload.");
        document.getElementById('upload-processing').style.display = 'none';
        document.getElementById('upload-actions').style.display = 'flex';
        return;
    }

    const processingText = document.querySelector('#upload-processing p');
    let successCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
        processingText.innerText = `Đang xử lý ${i + 1}/${fileArray.length}: ${fileArray[i].name}...`;

        const formData = new FormData();
        formData.append('file', fileArray[i]);

        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/documents/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (res.status === 401) { logout(); return; }
            if (res.ok) {
                const result = await res.json();
                window._sessionUploads.push(result);
                successCount++;
            }
        } catch (error) {
            console.error(`Lỗi xử lý ${fileArray[i].name}:`, error);
        }
    }

    document.getElementById('upload-processing').style.display = 'none';
    document.getElementById('upload-actions').style.display = 'flex';

    if (successCount === 0 && fileArray.length > 0) {
        showAlert("Không thể upload bất kỳ file nào. Vui lòng kiểm tra lại kết nối hoặc định dạng file.", "❌");
    }

    if (successCount > 0) {
        _batchPage = 1;
        document.getElementById('batch-upload-result').style.display = 'block';
        renderBatchTable();
        // Also refresh global docs table in background
        fetchData();
        showAlert(`Bóc tách hoàn tất ${successCount}/${fileArray.length} file.`, '✅');
    }
}

function renderBatchTable() {
    const tbody = document.querySelector('#batch-table tbody');
    tbody.innerHTML = '';

    const totalPages = Math.ceil(window._sessionUploads.length / _batchPageSize) || 1;
    if (_batchPage > totalPages) _batchPage = totalPages;
    if (_batchPage < 1) _batchPage = 1;

    document.getElementById('batch-page-info').innerText = `Trang ${_batchPage} / ${totalPages}`;
    document.getElementById('btn-prev-batch').disabled = _batchPage === 1;
    document.getElementById('btn-next-batch').disabled = _batchPage === totalPages;

    const start = (_batchPage - 1) * _batchPageSize;
    const end = start + _batchPageSize;
    const pageItems = window._sessionUploads.slice(start, end);

    pageItems.forEach(doc => {
        const thoiHan = doc.thoiHan ? formatDate(doc.thoiHan) : 'Không có';
        const tr = document.createElement('tr');
        // Extract original file name from path if possible
        const fullPath = doc.filePath || '';
        const fileName = fullPath.split('_').slice(1).join('_') || 'File đính kèm';

        tr.innerHTML = `
            <td style="font-size: 0.85rem; color: var(--text-secondary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${fileName}">${fileName}</td>
            <td style="font-weight: 600;">${doc.soVanBan || 'Chưa xác định'}</td>
            <td>${doc.coQuanChuQuan || ''}</td>
            <td>${thoiHan}</td>
            <td><span class="status bg-warning" style="font-size: 0.75rem;">${doc.status}</span></td>
            <td>
                <button class="btn" style="padding: 4px 8px; font-size: 0.8rem; background: rgba(255,255,255,0.1); color: white;" onclick="openEditModal(${doc.id})">Sửa</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function clearBatch() {
    if (!window._sessionUploads || window._sessionUploads.length === 0) {
        document.getElementById('batch-upload-result').style.display = 'none';
        return;
    }

    const confirmed = await showConfirm('Bạn có chắc chắn muốn HỦY đợt bóc tách này? Thao tác này sẽ XÓA VĨNH VIỄN các văn bản này khỏi hệ thống database.');
    if (!confirmed) return;

    const ids = window._sessionUploads.map(d => d.id);
    const token = localStorage.getItem('auth_token');

    try {
        const res = await fetch('/api/documents/bulk-delete', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ids)
        });

        if (res.status === 401) { logout(); return; }
        if (res.ok) {
            showAlert(`Đã hủy và xóa sạch ${ids.length} văn bản khỏi hệ thống.`, '✅');
            window._sessionUploads = [];
            document.getElementById('batch-upload-result').style.display = 'none';
            _batchPage = 1;
            fetchData(); // Cập nhật lại danh sách chính bên dưới
        } else {
            const err = await res.text();
            showAlert('Lỗi khi xóa: ' + err, '❌');
        }
    } catch (error) {
        console.error('Lỗi bulk delete:', error);
        showAlert('Lỗi kết nối khi thực hiện xóa.', '❌');
    }
}

async function confirmAllBatch() {
    if (!window._sessionUploads || window._sessionUploads.length === 0) return;

    const confirmed = await showConfirm(`Xác nhận lưu toàn bộ ${window._sessionUploads.length} văn bản vào hệ thống và chuyển trạng thái thành "Đã rà soát"?`);
    if (!confirmed) return;

    const ids = window._sessionUploads.map(d => d.id);
    const token = localStorage.getItem('auth_token');

    try {
        const res = await fetch('/api/documents/bulk-confirm', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ids)
        });

        if (res.status === 401) { logout(); return; }
        if (res.ok) {
            showAlert(`Đã xác nhận và lưu toàn bộ ${ids.length} văn bản thành công!`, '✅');
            window._sessionUploads = [];
            document.getElementById('batch-upload-result').style.display = 'none';
            _batchPage = 1;
            // Làm mới danh sách chính phía sau
            fetchData();
        } else {
            const err = await res.text();
            showAlert('Lỗi khi xác nhận: ' + err, '❌');
        }
    } catch (error) {
        console.error('Lỗi bulk confirm:', error);
        showAlert('Lỗi kết nối khi xác nhận.', '❌');
    }
}

function prevBatchPage() {
    if (_batchPage > 1) {
        _batchPage--;
        renderBatchTable();
    }
}

function nextBatchPage() {
    const totalPages = Math.ceil(window._sessionUploads.length / _batchPageSize);
    if (_batchPage < totalPages) {
        _batchPage++;
        renderBatchTable();
    }
}

let _editingDocId = null;

function openEditModal(id) {
    const doc = window._sessionUploads.find(d => d.id === id);
    if (!doc) return;
    _editingDocId = id;

    document.getElementById('ocr-so').value = doc.soVanBan || '';
    document.getElementById('ocr-trichyeu').value = doc.trichYeu || '';
    document.getElementById('ocr-coquan').value = doc.coQuanChuQuan || '';
    if (doc.thoiHan) {
        document.getElementById('ocr-han').value = doc.thoiHan.split('T')[0];
    } else {
        document.getElementById('ocr-han').value = '';
    }

    document.getElementById('edit-ocr-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-ocr-modal').style.display = 'none';
    _editingDocId = null;
}

window._isSaving = false;

async function saveEdit(btn) {
    if (window._isSaving || !_editingDocId) return;
    const docIndex = window._sessionUploads.findIndex(d => d.id === _editingDocId);
    if (docIndex === -1) return;

    window._isSaving = true;
    const originalText = btn ? btn.innerText : 'Cập nhật';
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Đang lưu...';
    }

    const doc = window._sessionUploads[docIndex];
    const data = {
        ...doc,
        soVanBan: document.getElementById('ocr-so').value,
        trichYeu: document.getElementById('ocr-trichyeu').value,
        coQuanChuQuan: document.getElementById('ocr-coquan').value,
        thoiHan: document.getElementById('ocr-han').value ? document.getElementById('ocr-han').value + "T00:00:00" : null
    };

    try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/documents/${data.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (res.status === 401) { logout(); return; }
        if (res.ok) {
            window._sessionUploads[docIndex] = data; // Update local cache
            closeEditModal();
            renderBatchTable(); // Refresh table
            fetchData(); // Refresh global data
        } else {
            throw new Error('Lỗi từ máy chủ');
        }
    } catch (error) {
        showAlert('Lỗi khi lưu: ' + error.message, '❌');
    } finally {
        window._isSaving = false;
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Custom Alert Logic
function showAlert(message, icon = '🔔') {
    document.getElementById('alert-message').innerText = message;
    document.getElementById('alert-icon').innerText = icon;
    document.getElementById('custom-alert').style.display = 'flex';
}

function closeAlert() {
    document.getElementById('custom-alert').style.display = 'none';
}

let _confirmRes = null;
function showConfirm(message) {
    document.getElementById('confirm-message').innerText = message;
    document.getElementById('custom-confirm').style.display = 'flex';
    return new Promise((resolve) => {
        _confirmRes = resolve;
    });
}

function _confirmResolve(val) {
    document.getElementById('custom-confirm').style.display = 'none';
    if (_confirmRes) _confirmRes(val);
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

    if (!username || !password) { showAlert('Vui lòng nhập đủ thông tin!', '⚠️'); return; }

    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ username, password, role })
        });
        if (res.ok) {
            showAlert('Tạo người dùng thành công!', '✅');
            closeUserModal();
            fetchUsers();
        } else {
            const err = await res.json();
            showAlert(err.message || 'Lỗi khi tạo người dùng', '❌');
        }
    } catch (e) { showAlert('Lỗi kết nối', '📡'); }
}

async function deleteUser(id) {
    const confirmed = await showConfirm('Bạn có chắc chắn muốn xóa người dùng này?');
    if (!confirmed) return;
    const token = localStorage.getItem('auth_token');
    try {
        await fetch(`/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        fetchUsers();
    } catch (e) { showAlert('Lỗi khi xóa', '❌'); }
}

async function deleteDocument(id) {
    const confirmed = await showConfirm('Xóa văn bản này?');
    if (!confirmed) return;
    const token = localStorage.getItem('auth_token');
    try {
        await fetch(`/api/documents/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        fetchData();
    } catch (e) { showAlert('Lỗi khi xóa', '❌'); }
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
