import { escapeAttribute } from '../core/dom.js';
import { formatDate, getBadgeClass } from '../core/formatters.js';

export function createDashboardFeature(context) {
    let chart = null;

    // ─────────────────────────────────────────────────────────────
    // Skeleton helpers — hiện ngay lập tức (0ms) khi bắt đầu load
    // ─────────────────────────────────────────────────────────────
    function showStatSkeletons() {
        document.querySelectorAll('.stat-card').forEach(card => card.classList.add('sk-loading'));
    }

    function hideStatSkeletons() {
        document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('sk-loading'));
    }

    function showTableSkeleton() {
        const tbody = document.querySelector('#recent-docs tbody');
        if (!tbody) return;
        tbody.innerHTML = Array.from({ length: 5 }, () => `
            <tr class="sk-row">
                <td><span class="sk-cell" style="width:80px;display:inline-block"></span></td>
                <td><span class="sk-cell" style="width:60%;display:inline-block"></span></td>
                <td><span class="sk-cell" style="width:70px;display:inline-block"></span></td>
                <td><span class="sk-cell" style="width:80px;display:inline-block"></span></td>
            </tr>`).join('');
    }

    function showChartSkeleton() {
        const canvas = document.getElementById('statChart');
        if (!canvas) return;
        canvas.style.display = 'none';
        if (!document.getElementById('sk-chart')) {
            const ph = document.createElement('div');
            ph.id = 'sk-chart';
            ph.className = 'sk-chart-placeholder';
            canvas.parentNode.insertBefore(ph, canvas);
        }
    }

    function hideChartSkeleton() {
        const ph = document.getElementById('sk-chart');
        if (ph) ph.remove();
        const canvas = document.getElementById('statChart');
        if (canvas) canvas.style.display = '';
    }

    // ─────────────────────────────────────────────────────────────
    // Init — gắn sự kiện
    // ─────────────────────────────────────────────────────────────
    function init() {
        // Click vào bảng văn bản gần đây → mở chi tiết
        document.addEventListener('click', async (event) => {
            const row = event.target.closest('#recent-docs tr[data-doc-id]');
            if (!row) return;
            const docId = parseInt(row.dataset.docId, 10);
            if (docId) await context.services.openDocDetail(docId);
        });

        // Click stat card → chuyển sang tab Văn bản với bộ lọc tương ứng
        const statsContainer = document.querySelector('.stats-grid');
        if (statsContainer) {
            statsContainer.addEventListener('click', (event) => {
                const card = event.target.closest('.stat-card');
                if (!card) return;

                const label = card.querySelector('.stat-label')?.innerText ?? '';
                context.shell.showTab('documents');

                setTimeout(() => {
                    const filterSelect = document.getElementById('doc-status-filter');
                    const sortSelect   = document.getElementById('doc-sort-filter');
                    if (!filterSelect) return;

                    const clean = label.toLowerCase().trim();
                    if (clean.includes('quá hạn'))          { filterSelect.value = 'overdue'; }
                    else if (clean.includes('sắp hết hạn')) { filterSelect.value = 'urgent'; }
                    else if (clean.includes('hôm nay'))     { filterSelect.value = 'today'; }
                    else                                     { filterSelect.value = ''; }

                    if (sortSelect) sortSelect.value = 'deadline_asc';
                    filterSelect.dispatchEvent(new Event('change'));
                    if (sortSelect) sortSelect.dispatchEvent(new Event('change'));
                }, 300);
            });
        }

        // Sau khi document thay đổi → invalidate server cache rồi refresh
        document.addEventListener('realtime:document_updated', () => {
            context.api.post('/api/stats/invalidate-cache').catch(() => {});
            refresh();
        });
    }

    // ─────────────────────────────────────────────────────────────
    // ✅ Refresh — PARALLEL fetch (Promise.all) thay vì waterfall
    // Trước: stats → chờ → docs → chờ → render = ~400ms
    // Sau:   stats ─┬─ song song ─┬─ render = ~max(30ms)
    //        docs  ─┤             │
    //        series─┘             │
    // ─────────────────────────────────────────────────────────────
    async function refresh() {
        // Bước 1: Hiện skeleton ngay (0ms)
        showStatSkeletons();
        showTableSkeleton();
        showChartSkeleton();

        try {
            // Bước 2: Gọi tất cả APIs cùng một lúc
            const [statsRes, docsRes, seriesRes] = await Promise.all([
                context.api.get('/api/stats'),
                context.api.get('/api/documents?page=1&size=5'),
                context.api.get('/api/stats/deadline-series?days=14')
            ]);

            // Bước 3: Parse song song
            const [stats, docsResult] = await Promise.all([
                statsRes.ok  ? statsRes.json()  : Promise.resolve({}),
                docsRes.ok   ? docsRes.json()   : Promise.resolve({ data: [] }),
                seriesRes.ok ? seriesRes.json() : Promise.resolve([]) // reserved for future bar chart
            ]);

            // Bước 4: Ẩn skeleton + render tất cả
            hideStatSkeletons();
            hideChartSkeleton();

            updateStats(stats);
            renderRecentDocs(docsResult);
            renderChart(stats);

        } catch (error) {
            console.error('[Dashboard] Load error:', error);
            hideStatSkeletons();
            hideChartSkeleton();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Render functions
    // ─────────────────────────────────────────────────────────────
    function updateStats(stats) {
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val ?? 0;
        };
        set('stat-total',   stats.total);
        set('stat-urgent',  stats.urgent);
        set('stat-overdue', stats.overdue);
        set('stat-today',   stats.today);
    }

    function renderRecentDocs(result) {
        const tbody = document.querySelector('#recent-docs tbody');
        if (!tbody) return;

        const statusMap = {
            'Chưa xử lý':   'status_pending',
            'Đang xử lý':   'status_processing',
            'Đã rà soát':   'status_reviewed',
            'Đã hoàn thành': 'status_completed',
            'Lỗi OCR':      'status_error_ocr'
        };

        const docs = result.data || [];
        if (docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted,#94a3b8)">Không có dữ liệu</td></tr>';
            return;
        }

        tbody.innerHTML = docs.map(doc => `
            <tr style="cursor:pointer;" data-doc-id="${doc.id}">
                <td style="font-weight:700;color:var(--sidebar-bg)">${doc.soVanBan || '-'}</td>
                <td ${doc.trichYeu ? `class="text-truncate-2" title="${escapeAttribute(doc.trichYeu)}"` : ''}>${doc.trichYeu || '-'}</td>
                <td>${formatDate(doc.thoiHan)}</td>
                <td><span class="badge ${getBadgeClass(doc.status, doc.soNgayConLai)}">${context.i18n.t(statusMap[doc.trangThai || doc.status] || (doc.trangThai || doc.status || ''))}</span></td>
            </tr>`).join('');
    }

    function renderChart(stats) {
        const canvas = document.getElementById('statChart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (chart) { chart.destroy(); chart = null; }

        const labels = [
            context.i18n.t('overdue'),
            context.i18n.t('nearly_due'),
            context.i18n.t('processing')
        ];

        const processing = Math.max(
            (stats.total || 0) - (stats.overdue || 0) - (stats.urgent || 0), 0
        );

        chart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: [stats.overdue || 0, stats.urgent || 0, processing],
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
                    borderWidth: 0,
                    offset: 10
                }]
            },
            options: {
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', font: { family: 'Inter, sans-serif', size: 12 } }
                    }
                },
                cutout: '70%',
                responsive: true,
                animation: { duration: 400 }
            }
        });
    }

    return { init, refresh, activate() {} };
}
