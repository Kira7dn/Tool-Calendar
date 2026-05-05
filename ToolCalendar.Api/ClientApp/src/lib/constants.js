export const DOC_STATUS = {
    CHUA_XU_LY: {
        value: "Chưa xử lý",
        label: "Chưa xử lý",
        icon: "⏳",
        variant: "info"
    },
    DANG_XU_LY: {
        value: "Đang xử lý",
        label: "Đang xử lý",
        icon: "⚙️",
        variant: "warning"
    },
    DA_RA_SOAT: {
        value: "Đã rà soát",
        label: "Đã rà soát",
        icon: "🔍",
        variant: "info"
    },
    DA_HOAN_THANH: {
        value: "Đã hoàn thành",
        label: "Đã hoàn thành",
        icon: "✅",
        variant: "success"
    },
    LOI_OCR: {
        value: "Lỗi OCR",
        label: "Lỗi OCR",
        icon: "⚠️",
        variant: "destructive"
    }
};

export const DOC_PRIORITY = {
    THUONG: "Thường",
    KHAN: "Khẩn",
    HOA_TOC: "Hỏa tốc",
    THUONG_KHAN: "Thượng khẩn"
};

export function getStatusConfig(statusValue, daysLeft) {
    if (statusValue === 'overdue' || daysLeft < 0 || (statusValue && statusValue.includes("Quá hạn"))) {
        return { label: statusValue === 'overdue' ? 'Đã quá hạn' : statusValue, icon: "🛑", variant: "destructive" };
    }
    
    if (statusValue === 'urgent' || (daysLeft >= 0 && daysLeft <= 3)) {
        return { label: statusValue === 'urgent' ? 'Sắp hết hạn' : statusValue, icon: "🕒", variant: "warning" };
    }

    if (statusValue === 'today') {
        return { label: 'Hạn hôm nay', icon: "📅", variant: "success" };
    }

    const standard = Object.values(DOC_STATUS).find(s => s.value === statusValue);
    if (standard) return standard;

    const val = (statusValue || "").toLowerCase();
    if (val.includes("hoàn thành") || val.includes("xong") || val.includes("thành công") || val.includes("đã ký")) {
        return { label: statusValue, icon: "✅", variant: "success" };
    }
    if (val.includes("lỗi") || val.includes("hỏng") || val.includes("sai")) {
        return { label: statusValue, icon: "⚠️", variant: "destructive" };
    }
    if (val.includes("đang") || val.includes("chờ") || val.includes("tạm")) {
        return { label: statusValue, icon: "⚙️", variant: "warning" };
    }

    return {
        label: statusValue || "Chưa xử lý",
        icon: "📄",
        variant: "outline"
    };
}
