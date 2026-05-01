/**
 * Quản lý các hằng số và cấu hình dùng chung cho toàn bộ hệ thống
 */
export const DOC_STATUS = {
    CHUA_XU_LY: {
        value: "Chưa xử lý",
        label: "Chưa xử lý",
        icon: "⏳",
        badgeClass: "badge-dept"
    },
    DANG_XU_LY: {
        value: "Đang xử lý",
        label: "Đang xử lý",
        icon: "⚙️",
        badgeClass: "badge-warning"
    },
    DA_RA_SOAT: {
        value: "Đã rà soát",
        label: "Đã rà soát",
        icon: "🔍",
        badgeClass: "badge-primary"
    },
    DA_HOAN_THANH: {
        value: "Đã hoàn thành",
        label: "Đã hoàn thành",
        icon: "✅",
        badgeClass: "badge-success"
    },
    LOI_OCR: {
        value: "Lỗi OCR",
        label: "Lỗi OCR",
        icon: "⚠️",
        badgeClass: "badge-danger"
    }
};

export const DOC_PRIORITY = {
    THUONG: "Thường",
    KHAN: "Khẩn",
    HOA_TOC: "Hỏa tốc",
    THUONG_KHAN: "Thượng khẩn"
};

/**
 * Lấy cấu hình trạng thái dựa trên giá trị chuỗi (Hỗ trợ nhận diện thông minh)
 */
export function getStatusConfig(statusValue) {
    if (!statusValue) return { icon: "⏳", badgeClass: "badge-dept" };

    // 1. Nếu là trạng thái Quá hạn
    if (statusValue.includes("Quá hạn")) {
        return { icon: "🛑", badgeClass: "badge-danger" };
    }

    // 2. Tìm trong danh sách chuẩn
    const standard = Object.values(DOC_STATUS).find(s => s.value === statusValue);
    if (standard) return standard;

    // 3. Nhận diện thông minh cho trạng thái Tùy chỉnh (Custom)
    const val = statusValue.toLowerCase();
    if (val.includes("hoàn thành") || val.includes("xong") || val.includes("thành công") || val.includes("đã ký")) {
        return { icon: "✅", badgeClass: "badge-success" };
    }
    if (val.includes("lỗi") || val.includes("hỏng") || val.includes("sai")) {
        return { icon: "⚠️", badgeClass: "badge-danger" };
    }
    if (val.includes("đang") || val.includes("chờ") || val.includes("tạm")) {
        return { icon: "⚙️", badgeClass: "badge-warning" };
    }

    // Mặc định cho các trường hợp khác
    return {
        icon: "📄",
        badgeClass: "badge-dept"
    };
}
