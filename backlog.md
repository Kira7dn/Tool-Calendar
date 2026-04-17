# 📝 BACKLOG: HỆ THỐNG ĐIỀU PHỐI CÔNG VĂN

## 🏁 GIAI ĐOẠN 1: HOÀN THIỆN NỀN TẢNG (98% - Sắp hoàn thành)
*Mục tiêu: Đưa hệ thống vào vận hành thực tế tại văn phòng.*

### 🔐 Bảo mật & Người dùng [HOÀN THÀNH]
- [x] Thiết kế trang **Login Dashboard** (Premium UI).
- [x] Triển khai cơ chế xác thực **JWT (Token)** cho Web API.
- [x] Hệ thống **RBAC 4 vai trò**: Lãnh đạo, Văn thư, Cán bộ, Admin.

### 📥 Nhập liệu & Kế thừa [Đang hoàn thiện]
- [x] **Nâng cấp OCR Chuyên sâu**: Làm sạch ảnh bằng SkiaSharp & Heuristics thông minh.
- [ ] Công cụ **Import Excel**: Nạp hàng loạt dữ liệu từ sổ tay/Excel cũ.
- [ ] Hoàn thiện **PDF Preview**: Nhúng trình xem file gốc ngay cạnh Form rà soát.
- [x] Nút **Download .ics**: Cho phép tải file lịch nhắc việc ngay từ giao diện Web.

### 🔔 Cảnh báo & Hiển thị
- [ ] Hệ thống **Toast Notification**: Cảnh báo 7-3-1 ngày trên Web Dashboard.
- [ ] **Phân bổ văn bản**: Gán đích danh Cán bộ chuyên môn xử lý từng công văn.

---

## 🚀 GIAI ĐOẠN 2: NÂNG CẤP & AI
- [ ] **AI Assistant**: Tự động nhận diện mức độ khẩn cấp và phân luồng hồ sơ.
- [ ] **Cloud Sync**: Sao lưu mã hóa cuối ngày.
- [ ] **Bottleneck Analytics**: Biểu đồ phân tích điểm nghẽn tiến độ.

---

## 🛠️ TECHNICAL TASKS
- [x] Chuyển đổi sang Tesseract OCR (Cross-platform).
- [x] Đóng gói Docker (Core + API + Core Library).
- [x] Tiền xử lý ảnh SkiaSharp (Grayscale/Contrast).
- [ ] Optimize PDF preview stream để xem file dung lượng lớn mượt mà hơn.
