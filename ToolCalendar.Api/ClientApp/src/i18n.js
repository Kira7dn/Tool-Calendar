import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  vi: {
    translation: {
      "dashboard": "Bảng điều khiển",
      "documents": "Văn bản",
      "my_tasks": "Nhiệm vụ của tôi",
      "upload": "Số hóa",
      "users": "Người dùng",
      "settings": "Cấu hình",
      "logout": "Đăng xuất",
      "total_docs": "Tổng văn bản",
      "urgent_docs": "Sắp hết hạn",
      "overdue_docs": "Đã quá hạn",
      "today_docs": "Hạn hôm nay",
      "recent_activity": "Xử lý mới nhất",
      "view_all": "Tất cả",
      "performance": "Hiệu suất",
      "completion_rate": "Hoàn thành",
      "search_placeholder": "Tìm số hiệu, nội dung...",
      "all_status": "Tất cả trạng thái",
      "new_doc": "Thêm mới",
      "actions": "Thao tác",
      "view_detail": "Chi tiết",
      "edit": "Chỉnh sửa",
      "delete": "Xóa",
      "view_pdf": "Xem PDF",
      "confirm_delete": "Bạn có chắc chắn muốn xóa?",
      "status_overdue": "Quá hạn",
      "status_urgent": "Sắp hết hạn",
      "status_today": "Hôm nay",
      "overdue": "Quá hạn",
      "nearly_due": "Sắp hết hạn",
      "processing": "Đang xử lý",
      "status_pending": "Chưa xử lý",
      "status_processing": "Đang xử lý",
      "status_reviewed": "Đã rà soát",
      "status_completed": "Đã hoàn thành",
      "status_error_ocr": "Lỗi OCR"
    }
  },
  en: {
    translation: {
      "dashboard": "Dashboard",
      "documents": "Documents",
      "my_tasks": "My Tasks",
      "upload": "Digitize",
      "users": "Users",
      "settings": "Settings",
      "logout": "Logout",
      "total_docs": "Total Documents",
      "urgent_docs": "Urgent",
      "overdue_docs": "Overdue",
      "today_docs": "Due Today",
      "recent_activity": "Recent Activity",
      "view_all": "View All",
      "performance": "Performance",
      "completion_rate": "Completion",
      "search_placeholder": "Search number, content...",
      "all_status": "All Statuses",
      "new_doc": "Add New",
      "actions": "Actions",
      "view_detail": "Details",
      "edit": "Edit",
      "delete": "Delete",
      "view_pdf": "View PDF",
      "confirm_delete": "Are you sure you want to delete?",
      "status_overdue": "Overdue",
      "status_urgent": "Urgent",
      "status_today": "Today",
      "overdue": "Overdue",
      "nearly_due": "Nearly Due",
      "processing": "Processing",
      "status_pending": "Pending",
      "status_processing": "Processing",
      "status_reviewed": "Reviewed",
      "status_completed": "Completed",
      "status_error_ocr": "OCR Error"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
