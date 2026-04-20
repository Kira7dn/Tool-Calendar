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
    startSessionWatcher(); // Theo dõi phiên đăng nhập


    // Debounce search → call server
    const searchInput = document.getElementById('doc-search');
    if (searchInput) {
        let _searchTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(() => fetchDocPage(1), 350);
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

    // 2. Chỉ Admin và Văn thư mới thấy nút Thêm văn bản / Tab Upload / Cài đặt
    if (role !== 'Admin' && role !== 'VanThu') {
        document.querySelector('.header-actions').style.display = 'none';
        document.querySelector('[data-tab="upload"]').style.display = 'none';
        document.querySelector('[data-tab="settings"]').style.display = 'none';
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
    if (tabId === 'settings') fetchSettings();

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


// ======================================================
// DATA FETCHING - Server-side pagination
// ======================================================

// Holds only the CURRENT PAGE of documents (not all)
let _docTotalPages = 1;

async function fetchData() {
    const token = localStorage.getItem('auth_token');
    try {
        // Fetch stats and first page of docs in parallel
        const [statsRes] = await Promise.all([
            fetch('/api/stats', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (statsRes.status === 401) { logout(); return; }

        stats = await statsRes.json();

        updateStatsUI();
        renderRecentDocs(); // Dashboard "recent 5" still uses a lightweight approach
        renderChart();

        // Fetch first page for documents tab
        await fetchDocPage(1);

        // Prefetch settings for UI info
        fetchSettings();
    } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
    }
}

// Fetches documents from the server for the given page/search
async function fetchDocPage(page) {
    const token = localStorage.getItem('auth_token');
    const search = document.getElementById('doc-search')?.value?.trim() ?? '';
    const url = `/api/documents?page=${page}&size=${_docPageSize}&search=${encodeURIComponent(search)}`;

    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.status === 401) { logout(); return; }

        const result = await res.json();
        documents = result.data;        // Only current page items
        _docPage = result.page;
        _docTotalPages = result.totalPages || 1;

        renderDocsTable();
    } catch (err) {
        console.error('Lỗi tải danh sách văn bản:', err);
    }
}

// Dashboard "recent 5" - lightweight separate call
async function renderRecentDocs() {
    const token = localStorage.getItem('auth_token');
    const res = await fetch('/api/documents?page=1&size=5', { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const result = await res.json();
    const recentBody = document.querySelector('#recent-docs tbody');
    if (!recentBody) return;
    recentBody.innerHTML = (result.data || []).map(doc => `
        <tr>
            <td style="font-weight: 600;">${doc.soVanBan}</td>
            <td class="text-truncate" style="max-width: 300px;">${doc.trichYeu}</td>
            <td>${formatDate(doc.thoiHan)}</td>
            <td><span class="badge ${getBadgeClass(doc.soNgayConLai)}">${doc.trangThai}</span></td>
        </tr>
    `).join('');
}


function updateStatsUI() {
    document.getElementById('stat-total').innerText = stats.total || 0;
    document.getElementById('stat-urgent').innerText = stats.urgent || 0;
    document.getElementById('stat-overdue').innerText = stats.overdue || 0;
    document.getElementById('stat-today').innerText = stats.today || 0;
}

function renderDocsTable() {
    const role = localStorage.getItem('user_role');
    const allBody = document.querySelector('#all-docs-table tbody');
    if (!allBody) return;

    const offset = (_docPage - 1) * _docPageSize;
    allBody.innerHTML = documents.map((doc, idx) => `
        <tr style="cursor:pointer;" onclick="openDocDetailModal(${doc.id})">
            <td style="text-align:center; color:var(--text-secondary); font-size:0.82rem; font-weight:600; width:48px;">${offset + idx + 1}</td>
            <td style="font-weight: 600;">${doc.soVanBan || '—'}</td>
            <td>${formatDate(doc.ngayBanHanh)}</td>
            <td>${doc.trichYeu || ''}</td>
            <td>${doc.coQuanChuQuan || ''}</td>
            <td>${formatDate(doc.thoiHan)}</td>
            <td><span class="badge ${getBadgeClass(doc.soNgayConLai)}">${doc.trangThai || doc.status || ''}</span></td>
            <td onclick="event.stopPropagation();" style="white-space:nowrap;">
                <button class="btn btn-sm" style="background:rgba(55,114,255,0.12); color:var(--primary); padding:5px 12px; font-size:0.8rem;" onclick="openDocDetailModal(${doc.id})">👁️ Xem</button>
                ${(role === 'Admin' || role === 'VanThu') ? `<button class="btn btn-sm" style="margin-left:6px; background:rgba(16,185,129,0.12); color:var(--success); padding:5px 12px; font-size:0.8rem;" onclick="openDocDetailModal(${doc.id}, 'edit')">✏️ Sửa</button>` : ''}
                ${role === 'Admin' ? `<button class="btn btn-sm" style="margin-left:6px; color:var(--danger); background:rgba(239,68,68,0.1); padding:5px 12px; font-size:0.8rem;" onclick="deleteDocument(${doc.id})">🗑️ Xóa</button>` : ''}
            </td>
        </tr>
    `).join('');

    document.getElementById('docs-page-info').innerText = `Trang ${_docPage} / ${_docTotalPages}`;
    document.getElementById('btn-prev-docs').disabled = _docPage <= 1;
    document.getElementById('btn-next-docs').disabled = _docPage >= _docTotalPages;
}


async function prevDocPage() {
    if (_docPage > 1) await fetchDocPage(_docPage - 1);
}

async function nextDocPage() {
    if (_docPage < _docTotalPages) await fetchDocPage(_docPage + 1);
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

    const processingInfo = document.getElementById('processing-file-count');
    const progressBar = document.getElementById('upload-progress-bar');
    const fileNameText = document.getElementById('processing-filename');

    let successCount = 0;
    progressBar.style.width = '0%';
    processingInfo.innerText = `Tìm thấy ${fileArray.length} file PDF. Bắt đầu xử lý...`;

    for (let i = 0; i < fileArray.length; i++) {
        const progress = Math.round(((i) / fileArray.length) * 100);
        progressBar.style.width = `${progress}%`;
        processingInfo.innerText = `Đang xử lý file ${i + 1} / ${fileArray.length}`;
        fileNameText.innerText = fileArray[i].name;

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

    progressBar.style.width = '100%';
    processingInfo.innerText = `Hoàn tất xử lý ${successCount}/${fileArray.length} file.`;

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

function logout(kicked = false) {
    localStorage.clear();
    if (kicked) {
        sessionStorage.setItem('kicked_out', '1');
    }
    window.location.href = 'login.html';
}

// ====================================================
// SESSION WATCHER - Phát hiện bị đăng xuất từ xa
// ====================================================
let _sessionWatcherInterval = null;
let _kickCountdown = null;

function startSessionWatcher() {
    // Kiểm tra mỗi 30 giây
    _sessionWatcherInterval = setInterval(async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        try {
            const res = await fetch('/api/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                clearInterval(_sessionWatcherInterval);
                showKickedModal();
            }
        } catch (e) {
            // Bỏ qua lỗi mạng tạm thời
        }
    }, 30000);
}

function showKickedModal() {
    // Tạo overlay thông báo
    const overlay = document.createElement('div');
    overlay.id = 'kicked-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        animation: fadeIn 0.3s ease;
    `;

    let seconds = 10;
    overlay.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #1e293b, #0f172a);
            border: 1px solid rgba(239,68,68,0.4);
            border-radius: 20px;
            padding: 40px;
            max-width: 420px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.2);
            animation: slideUp 0.4s ease;
        ">
            <div style="
                width: 72px; height: 72px;
                background: rgba(239,68,68,0.15);
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                margin: 0 auto 20px;
                font-size: 2rem;
                border: 2px solid rgba(239,68,68,0.3);
            ">⚠️</div>
            <h2 style="color: #ef4444; font-size: 1.3rem; margin-bottom: 12px; font-weight: 700;">
                Phên Đăng Nhập Bị Chấm Dứt
            </h2>
            <p style="color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin-bottom: 8px;">
                Tài khoản của bạn đã đăng nhập từ một thiết bị khác.<br>
                Phîn làm việc hiện tại sẽ được đăng xuất tự động.
            </p>
            <div style="
                background: rgba(239,68,68,0.1);
                border-radius: 10px;
                padding: 12px;
                margin: 20px 0;
                border: 1px solid rgba(239,68,68,0.2);
            ">
                <span style="color: #94a3b8; font-size: 0.85rem;">Tự động đăng xuất sau </span>
                <span id="kick-countdown" style="color: #ef4444; font-size: 1.4rem; font-weight: 800; font-family: monospace;">${seconds}</span>
                <span style="color: #94a3b8; font-size: 0.85rem;"> giây</span>
            </div>
            <button onclick="logout(true)" style="
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 10px;
                padding: 12px 32px;
                font-size: 0.95rem;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                transition: background 0.2s;
            " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
                Đăng xuất ngay
            </button>
        </div>
    `;

    // Thêm animation CSS nếu chưa có
    if (!document.getElementById('kick-style')) {
        const style = document.createElement('style');
        style.id = 'kick-style';
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(30px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(overlay);

    // Đếm ngược
    _kickCountdown = setInterval(() => {
        seconds--;
        const el = document.getElementById('kick-countdown');
        if (el) el.innerText = seconds;
        if (seconds <= 0) {
            clearInterval(_kickCountdown);
            logout(true);
        }
    }, 1000);
}

// ====================================================
// DOCUMENT DETAIL MODAL
// ====================================================

let _currentDocId = null;
let _currentDocData = null;

async function openDocDetailModal(id, initialTab = 'view') {
    const token = localStorage.getItem('auth_token');
    const role = localStorage.getItem('user_role');
    _currentDocId = id;

    // Fetch full document
    try {
        const res = await fetch(`/api/documents/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        _currentDocData = await res.json();
    } catch (e) {
        console.error('Lỗi tải văn bản:', e);
        return;
    }

    const doc = _currentDocData;

    // Populate header
    document.getElementById('doc-modal-title').innerText = doc.soVanBan || 'Chi tiết văn bản';
    document.getElementById('doc-modal-subtitle').innerText = doc.trichYeu ? doc.trichYeu.substring(0, 80) + (doc.trichYeu.length > 80 ? '...' : '') : '';

    // View panel
    document.getElementById('dv-so').innerText = doc.soVanBan || '—';
    document.getElementById('dv-ngaybanhanh').innerText = formatDate(doc.ngayBanHanh);
    document.getElementById('dv-trichyeu').innerText = doc.trichYeu || '—';
    document.getElementById('dv-coquanbanhanh').innerText = doc.coQuanBanHanh || '—';
    document.getElementById('dv-coquanchuquan').innerText = doc.coQuanChuQuan || '—';
    document.getElementById('dv-thoihan').innerText = formatDate(doc.thoiHan);
    document.getElementById('dv-status').innerText = doc.status || '—';
    document.getElementById('dv-priority').innerText = doc.priority || '—';
    document.getElementById('dv-ngaythem').innerText = formatDate(doc.ngayThem);

    // Edit panel - pre-fill
    document.getElementById('de-so').value = doc.soVanBan || '';
    document.getElementById('de-ngaybanhanh').value = doc.ngayBanHanh ? doc.ngayBanHanh.split('T')[0] : '';
    document.getElementById('de-trichyeu').value = doc.trichYeu || '';
    document.getElementById('de-coquanbanhanh').value = doc.coQuanBanHanh || '';
    document.getElementById('de-coquanchuquan').value = doc.coQuanChuQuan || '';
    document.getElementById('de-thoihan').value = doc.thoiHan ? doc.thoiHan.split('T')[0] : '';
    document.getElementById('de-status').value = doc.status || 'Chưa xử lý';
    document.getElementById('de-priority').value = doc.priority || 'Thường';

    // Show/hide Edit tab based on role
    const editTab = document.getElementById('doc-tab-edit');
    if (role === 'Admin' || role === 'VanThu') {
        editTab.style.display = '';
    } else {
        editTab.style.display = 'none';
    }

    // Show modal
    document.getElementById('doc-detail-modal').style.display = 'flex';

    // Switch to requested tab and load comments
    switchDocTab(initialTab);
    await loadComments();
}

function closeDocDetailModal() {
    document.getElementById('doc-detail-modal').style.display = 'none';
    _currentDocId = null;
    _currentDocData = null;
}

function switchDocTab(tab) {
    const panels = ['view', 'edit', 'comments'];
    panels.forEach(p => {
        document.getElementById(`doc-panel-${p}`).style.display = p === tab ? 'block' : 'none';
        const tabBtn = document.getElementById(`doc-tab-${p}`);
        if (tabBtn) tabBtn.classList.toggle('doc-modal-tab-active', p === tab);
    });
}

async function saveDocDetail(btn) {
    if (!_currentDocId || !_currentDocData) return;

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Đang lưu...';

    const updated = {
        ..._currentDocData,
        soVanBan: document.getElementById('de-so').value,
        ngayBanHanh: document.getElementById('de-ngaybanhanh').value ? document.getElementById('de-ngaybanhanh').value + 'T00:00:00' : null,
        trichYeu: document.getElementById('de-trichyeu').value,
        coQuanBanHanh: document.getElementById('de-coquanbanhanh').value,
        coQuanChuQuan: document.getElementById('de-coquanchuquan').value,
        thoiHan: document.getElementById('de-thoihan').value ? document.getElementById('de-thoihan').value + 'T00:00:00' : null,
        status: document.getElementById('de-status').value,
        priority: document.getElementById('de-priority').value
    };

    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch(`/api/documents/${_currentDocId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(updated)
        });
        if (res.ok) {
            _currentDocData = updated;
            // Refresh view panel
            document.getElementById('dv-so').innerText = updated.soVanBan || '—';
            document.getElementById('dv-ngaybanhanh').innerText = formatDate(updated.ngayBanHanh);
            document.getElementById('dv-trichyeu').innerText = updated.trichYeu || '—';
            document.getElementById('dv-coquanbanhanh').innerText = updated.coQuanBanHanh || '—';
            document.getElementById('dv-coquanchuquan').innerText = updated.coQuanChuQuan || '—';
            document.getElementById('dv-thoihan').innerText = formatDate(updated.thoiHan);
            document.getElementById('dv-status').innerText = updated.status || '—';
            document.getElementById('dv-priority').innerText = updated.priority || '—';
            document.getElementById('doc-modal-title').innerText = updated.soVanBan || 'Chi tiết văn bản';
            switchDocTab('view');
            showAlert('Đã cập nhật văn bản thành công!', '✅');
            fetchData();
        } else {
            showAlert('Lỗi khi cập nhật văn bản.', '❌');
        }
    } catch (e) {
        showAlert('Lỗi kết nối.', '❌');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// ====================================================
// COMMENTS & REACTIONS
// ====================================================

let _commentsCache = [];

async function loadComments() {
    if (!_currentDocId) return;
    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch(`/api/documents/${_currentDocId}/comments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        _commentsCache = await res.json();
        renderComments(_commentsCache);
    } catch (e) {
        console.error('Lỗi tải comments:', e);
    }
}

function renderComments(comments) {
    const list = document.getElementById('comment-list');
    if (!list) return;

    // Update badge
    document.getElementById('comment-count-badge').innerText = comments.length;

    const currentUserId = parseInt(localStorage.getItem('user_id') || '0');
    const role = localStorage.getItem('user_role');

    if (comments.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-secondary);">
            <p style="font-size:2rem; margin-bottom:8px;">💭</p>
            <p>Chưa có bình luận nào. Hãy là người đầu tiên!</p>
        </div>`;
        return;
    }

    list.innerHTML = comments.map(c => {
        const reactions = c.reactions || {};
        const reactionTypes = [
            { type: 'like', emoji: '👍', label: 'Like' },
            { type: 'love', emoji: '❤️', label: 'Love' },
            { type: 'hate', emoji: '😡', label: 'Hate' },
            { type: 'dislike', emoji: '👎', label: 'Dislike' }
        ];

        // Determine which reaction the current user gave
        let userReaction = null;
        for (const rt of reactionTypes) {
            if (reactions[rt.type] && reactions[rt.type].users && reactions[rt.type].users.some(u => u === localStorage.getItem('user_name'))) {
                userReaction = rt.type;
                break;
            }
        }

        const reactionBtns = reactionTypes.map(rt => {
            const count = reactions[rt.type] ? reactions[rt.type].count : 0;
            const isActive = userReaction === rt.type;
            const users = reactions[rt.type] ? reactions[rt.type].users.join(', ') : '';
            return `<button class="reaction-btn ${isActive ? 'active-' + rt.type : ''}" 
                title="${users || rt.label}" 
                onclick="toggleReaction(${c.id}, '${rt.type}')">
                ${rt.emoji} <span class="reaction-count">${count > 0 ? count : ''}</span>
            </button>`;
        }).join('');

        const canDelete = (c.userId === currentUserId) || role === 'Admin';
        const deleteBtn = canDelete ? `<button class="comment-delete-btn" onclick="deleteComment(${c.id})" title="Xóa bình luận">🗑️</button>` : '';

        const date = new Date(c.createdAt);
        const timeStr = date.toLocaleString('vi-VN');

        return `<div class="comment-card" id="comment-card-${c.id}">
            <div class="comment-meta">
                <span class="comment-username">${c.username}</span>
                <div style="display:flex; align-items:center; gap:6px;">
                    <span class="comment-time">${timeStr}</span>
                    ${deleteBtn}
                </div>
            </div>
            <div class="comment-content">${escapeHtml(c.content)}</div>
            <div class="reaction-bar" id="reaction-bar-${c.id}">${reactionBtns}</div>
        </div>`;
    }).join('');
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function submitComment(btn) {
    const text = document.getElementById('new-comment-text').value.trim();
    if (!text) { showAlert('Vui lòng nhập nội dung bình luận!', '⚠️'); return; }

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Đang gửi...';

    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch(`/api/documents/${_currentDocId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ content: text })
        });
        if (res.ok) {
            document.getElementById('new-comment-text').value = '';
            await loadComments();
            // Scroll to bottom of comment list
            const list = document.getElementById('comment-list');
            list.scrollTop = list.scrollHeight;
        } else {
            showAlert('Lỗi khi gửi bình luận.', '❌');
        }
    } catch (e) {
        showAlert('Lỗi kết nối.', '❌');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function deleteComment(commentId) {
    const confirmed = await showConfirm('Xóa bình luận này?');
    if (!confirmed) return;

    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch(`/api/documents/${_currentDocId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            await loadComments();
        } else {
            showAlert('Lỗi khi xóa bình luận.', '❌');
        }
    } catch (e) {
        showAlert('Lỗi kết nối.', '❌');
    }
}

async function toggleReaction(commentId, reactionType) {
    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch(`/api/documents/${_currentDocId}/comments/${commentId}/react`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ reactionType })
        });
        if (res.ok) {
            const data = await res.json();
            // Update only the reaction bar of this comment (no full reload)
            updateReactionBar(commentId, data.reactions);
        }
    } catch (e) {
        console.error('Lỗi reaction:', e);
    }
}

function updateReactionBar(commentId, reactions) {
    const bar = document.getElementById(`reaction-bar-${commentId}`);
    if (!bar) return;

    const reactionTypes = [
        { type: 'like', emoji: '👍', label: 'Like' },
        { type: 'love', emoji: '❤️', label: 'Love' },
        { type: 'hate', emoji: '😡', label: 'Hate' },
        { type: 'dislike', emoji: '👎', label: 'Dislike' }
    ];

    const currentUsername = localStorage.getItem('user_name');
    let userReaction = null;
    for (const rt of reactionTypes) {
        if (reactions[rt.type] && reactions[rt.type].users && reactions[rt.type].users.includes(currentUsername)) {
            userReaction = rt.type;
            break;
        }
    }

    bar.innerHTML = reactionTypes.map(rt => {
        const count = reactions[rt.type] ? reactions[rt.type].count : 0;
        const isActive = userReaction === rt.type;
        const users = reactions[rt.type] ? reactions[rt.type].users.join(', ') : '';
        return `<button class="reaction-btn ${isActive ? 'active-' + rt.type : ''}" 
            title="${users || rt.label}" 
            onclick="toggleReaction(${commentId}, '${rt.type}')">
            ${rt.emoji} <span class="reaction-count">${count > 0 ? count : ''}</span>
        </button>`;
    }).join('');
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

// Settings Logic
async function fetchSettings() {
    const token = localStorage.getItem('auth_token');
    try {
        const res = await fetch('/api/stats/settings', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            const settings = await res.json();
            document.getElementById('setting-max-pages').value = settings.maxPagesToScan || 0;
            document.getElementById('setting-deadline-keywords').value = settings.deadlineKeywords || '';
        }
    } catch (e) { console.error('Lỗi tải cài đặt:', e); }
}

async function saveSettings(btn) {
    const maxPages = document.getElementById('setting-max-pages').value;
    const keywords = document.getElementById('setting-deadline-keywords').value;
    const token = localStorage.getItem('auth_token');

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Đang lưu...';

    try {
        const res = await fetch('/api/stats/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ maxPagesToScan: parseInt(maxPages), deadlineKeywords: keywords })
        });

        if (res.ok) {
            showAlert('Đã lưu cấu hình hệ thống!', '✅');
        } else {
            showAlert('Lỗi khi lưu cấu hình', '❌');
        }
    } catch (e) {
        showAlert('Lỗi kết nối', '❌');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}
