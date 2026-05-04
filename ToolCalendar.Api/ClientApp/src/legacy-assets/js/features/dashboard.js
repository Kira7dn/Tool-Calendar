import { escapeAttribute } from '../core/dom.js';
import { formatDate, getBadgeClass } from '../core/formatters.js';

export function createDashboardFeature(context) {
    let stats = {};
    let chart = null;

    function init() {
        // 1. Gắn sự kiện click cho bảng văn bản gần đây
        document.addEventListener('click', async (event) => {
            const row = event.target.closest('#recent-docs tr[data-doc-id]');
            if (!row) return;

            const docId = parseInt(row.dataset.docId, 10);
            if (docId) {
                await context.services.openDocDetail(docId);
            }
        });

        // 2. Gắn sự kiện click cho các thẻ thống kê (Actionable Stats)
        const statsContainer = document.querySelector('.stats-grid');
        if (statsContainer) {
            statsContainer.addEventListener('click', (event) => {
                const card = event.target.closest('.stat-card');
                if (!card) return;

                const label = card.querySelector('.stat-label')?.innerText;

                // Chuyển sang tab Văn bản
                context.shell.showTab('documents');

                // Tự động kích hoạt bộ lọc và sắp xếp dựa trên thẻ được click
                setTimeout(() => {
                    const filterSelect = document.getElementById('doc-status-filter');
                    const sortSelect = document.getElementById('doc-sort-filter');
                    
                    if (!filterSelect) return;

                    const cleanLabel = label.toLowerCase().trim();
                    console.log('Dashboard click label:', cleanLabel);

                    if (cleanLabel.includes('quá hạn')) {
                        filterSelect.value = 'overdue';
                        if (sortSelect) sortSelect.value = 'deadline_asc';
                    } else if (cleanLabel.includes('sắp hết hạn')) {
                        filterSelect.value = 'urgent'; 
                        if (sortSelect) sortSelect.value = 'deadline_asc';
                    } else if (cleanLabel.includes('hôm nay')) {
                        filterSelect.value = 'today'; 
                        if (sortSelect) sortSelect.value = 'deadline_asc';
                    } else {
                        filterSelect.value = ''; 
                    }

                    // Kích hoạt sự kiện change để bảng tự load lại
                    filterSelect.dispatchEvent(new Event('change'));
                    if (sortSelect) sortSelect.dispatchEvent(new Event('change'));
                }, 500); 
            });
        }

        // 3. Lắng nghe cập nhật realtime
        document.addEventListener('realtime:document_updated', () => {
            refresh();
        });
    }

    async function refresh() {
        try {
            const response = await context.api.get('/api/stats');
            if (!response.ok) return;

            stats = await response.json();
            updateStats();
            await renderRecentDocs();
            renderChart();
        } catch (error) {
            console.error('Dashboard load error:', error);
        }
    }

    function updateStats() {
        document.getElementById('stat-total').innerText = stats.total || 0;
        document.getElementById('stat-urgent').innerText = stats.urgent || 0;
        document.getElementById('stat-overdue').innerText = stats.overdue || 0;
        document.getElementById('stat-today').innerText = stats.today || 0;
    }

    async function renderRecentDocs() {
        const response = await context.api.get('/api/documents?page=1&size=5');
        if (!response.ok) return;

        const result = await response.json();
        const recentBody = document.querySelector('#recent-docs tbody');
        if (!recentBody) return;

        const statusMap = {
            'Chưa xử lý': 'status_pending',
            'Đang xử lý': 'status_processing',
            'Đã rà soát': 'status_reviewed',
            'Đã hoàn thành': 'status_completed',
            'Lỗi OCR': 'status_error_ocr'
        };

        recentBody.innerHTML = (result.data || []).map((doc) => `
            <tr style="cursor:pointer;" data-doc-id="${doc.id}">
                <td style="font-weight: 700; color: var(--sidebar-bg);">${doc.soVanBan}</td>
                <td ${doc.trichYeu ? `class="text-truncate-2" title="${escapeAttribute(doc.trichYeu)}"` : ''}>${doc.trichYeu || '-'}</td>
                <td>${formatDate(doc.thoiHan)}</td>
                <td><span class="badge ${getBadgeClass(doc.status, doc.soNgayConLai)}">${context.i18n.t(statusMap[doc.trangThai || doc.status] || (doc.trangThai || doc.status || ''))}</span></td>
            </tr>
        `).join('');
    }

    function renderChart() {
        const canvas = document.getElementById('statChart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (chart) {
            chart.destroy();
        }

        const labels = [
            context.i18n.t('overdue'),
            context.i18n.t('nearly_due'),
            context.i18n.t('processing')
        ];

        chart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: [
                        stats.overdue || 0,
                        stats.urgent || 0,
                        Math.max((stats.total || 0) - (stats.overdue || 0) - (stats.urgent || 0), 0)
                    ],
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
                    borderWidth: 0,
                    offset: 10
                }]
            },
            options: {
                plugins: {
                    legend: { 
                        position: 'bottom', 
                        labels: { 
                            color: '#94a3b8',
                            font: { family: 'Inter, sans-serif', size: 12 }
                        } 
                    }
                },
                cutout: '70%',
                responsive: true
            }
        });
    }

    return {
        init,
        refresh,
        activate() {
            // Dashboard refresh logic
        }
    };
}
