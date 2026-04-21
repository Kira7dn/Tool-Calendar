import { formatDate, getBadgeClass } from '../core/formatters.js';

export function createDashboardFeature(context) {
    let stats = {};
    let chart = null;

    function init() {}

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

        recentBody.innerHTML = (result.data || []).map((doc) => `
            <tr>
                <td style="font-weight: 600;">${doc.soVanBan}</td>
                <td class="text-truncate" style="max-width: 300px;">${doc.trichYeu}</td>
                <td>${formatDate(doc.thoiHan)}</td>
                <td><span class="badge ${getBadgeClass(doc.soNgayConLai)}">${doc.trangThai}</span></td>
            </tr>
        `).join('');
    }

    function renderChart() {
        const canvas = document.getElementById('statChart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (chart) {
            chart.destroy();
        }

        chart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Qua han', 'Sap het han', 'Dung han'],
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
                    legend: { position: 'bottom', labels: { color: '#94a3b8' } }
                },
                cutout: '70%',
                responsive: true
            }
        });
    }

    return {
        init,
        refresh,
        activate() {}
    };
}
