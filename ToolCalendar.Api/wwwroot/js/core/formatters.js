export function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

export function formatDateForTextInput(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return String(dateStr).trim();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

export function normalizeDateInputToIso(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    // 1. Trường hợp ISO sẵn (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
            return raw;
        }
        return null;
    }

    // 2. Trường hợp Ngày/Tháng/Năm (DD/MM/YYYY)
    const slashMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (slashMatch) {
        const [, dRaw, mRaw, yRaw] = slashMatch;
        const day = parseInt(dRaw, 10);
        const month = parseInt(mRaw, 10);
        const year = parseInt(yRaw, 10);

        // Kiểm tra tính hợp lệ của ngày tháng
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        return null;
    }

    // 3. Fallback dùng Date parse mặc định
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;

    const year = parsed.getFullYear();
    const month = parsed.getMonth() + 1;
    const day = parsed.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

import { getStatusConfig } from './constants.js';

export function getBadgeClass(statusValue, days) {
    if (statusValue === 'Đã hoàn thành') return 'badge-success';

    // Đảm bảo days là số để so sánh chính xác
    const d = Number(days);

    if (!Number.isNaN(d) && d !== 9999) {
        if (d < 0) return 'badge-danger';   // Quá hạn -> Đỏ
        if (d <= 7) return 'badge-warning'; // Sắp hết hạn -> Vàng
        return 'badge-success';             // Còn nhiều thời gian -> Xanh
    }

    // Nếu không có số ngày, lấy theo cấu hình trạng thái trong constants.js
    const config = getStatusConfig(statusValue);
    return config.badgeClass;
}

export function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
