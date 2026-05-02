# ĐẶC TẢ SẢN PHẨM HOÀN THIỆN (FINAL PRD)
## Dự án: Hệ Thống Điều Phối Công Văn (Document Coordination System)
**Phiên bản:** 1.0 (Bilingual Edition)  
**Ngày cập nhật:** 03/05/2026

---

## 1. TỔNG QUAN DỰ ÁN
Hệ thống Điều phối Công văn là một giải pháp quản trị văn bản nội bộ cấp đơn vị, được thiết kế để giải quyết bài toán chậm trễ trong xử lý công việc hành chính. Hệ thống tự động hóa luồng công việc từ khâu nạp văn bản (OCR), rà soát, điều phối đến giám sát tiến độ thời gian thực.

### Giá trị cốt lõi:
- **Tối ưu thời gian**: Tự động bóc tách thông tin văn bản bằng OCR.
- **Minh bạch tiến độ**: Giám sát deadline theo cơ chế 7-3-1 ngày.
- **Trải nghiệm cao cấp**: Giao diện hiện đại, mượt mà, hỗ trợ song ngữ Tiếng Anh - Tiếng Việt.
- **Bảo mật nội bộ**: Vận hành hoàn toàn trên mạng LAN (Local-first).

---

## 2. KIẾN TRÚC KỸ THUẬT (TECH STACK)
Hệ thống được xây dựng trên nền tảng công nghệ hiện đại, ưu tiên tính ổn định và tốc độ phản hồi.

- **Backend**: .NET Core 8 Web API.
- **Database**: SQLite (Gọn nhẹ, không cần cài đặt server DB phức tạp).
- **Frontend**: Vanilla Javascript (Module-based), CSS3 Custom Variables, HTML5 Semantic.
- **Real-time**: SignalR (Đẩy thông báo tức thời).
- **OCR Engine**: Tesseract OCR (Tự động nhận diện chữ viết từ PDF).
- **Xử lý PDF**: PDF.js (Xem file trực tiếp trên trình duyệt).
- **i18n Service**: Cơ chế đa ngôn ngữ tự xây dựng (Custom Logic) đảm bảo tốc độ nạp trang nhanh nhất.

---

## 3. CÁC TÍNH NĂNG TRỌNG TÂM

### 3.1. Dashboard & Phân tích (Analytics)
- Biểu đồ Doughnut (Chart.js) hiển thị tỷ lệ hoàn thành, quá hạn và đang xử lý.
- Thẻ thống kê động: Tổng văn bản, Sắp hết hạn, Quá hạn, Đến hạn hôm nay.
- Danh sách "Xử lý gần đây" cập nhật tức thời các biến động dữ liệu.

### 3.2. Quy trình Xử lý Văn bản Thông minh
- **Nạp dữ liệu hàng loạt**: Hỗ trợ Upload nhiều file PDF cùng lúc.
- **Hàng đợi OCR**: Tự động bóc tách Số văn bản, Trích yếu, Thời hạn xử lý dựa trên từ khóa.
- **Giao diện Rà soát Side-by-Side**: Cho phép so sánh file PDF gốc và dữ liệu bóc tách trên cùng một màn hình để chỉnh sửa chính xác 100%.

### 3.3. Điều phối & Giám sát (Workflow)
- **Phân vai trò (RBAC)**:
  - `Admin`: Quản trị toàn bộ hệ thống.
  - `Leader`: Giám sát tiến độ toàn đơn vị.
  - `Clerk`: Nhập liệu và điều phối văn bản.
  - `Officer`: Tiếp nhận và báo cáo kết quả xử lý (đính kèm bằng chứng).
- **Trạng thái linh hoạt**: Chưa xử lý -> Đang xử lý -> Đã rà soát -> Đã hoàn thành.

### 3.4. Hệ thống Cảnh báo & Thông báo
- **Web Push Notification**: Hiển thị thông báo ngay cả khi không mở ứng dụng.
- **Cơ chế 7-3-1**: Tự động nhắc việc khi còn 7 ngày, 3 ngày và 1 ngày trước deadline.
- **SignalR Alerts**: Thông báo tức thời khi có văn bản mới được gán.

### 3.5. Quản trị & Cấu hình Nâng cao
- **Quản lý Phòng ban**: Phân chia đơn vị xử lý chuyên sâu.
- **Nhãn & Rules (OCR Logic)**: Cho phép người dùng tự định nghĩa từ khóa nhận diện và số ngày xử lý mặc định cho từng loại văn bản.
- **Nhật ký Hệ thống (Audit Logs)**: Ghi lại 100% lịch sử thao tác của người dùng.
- **Sao lưu dữ liệu**: Xuất báo cáo/sao lưu toàn bộ hệ thống ra file CSV.

---

## 4. GIAO DIỆN & TRẢI NGHIỆM (UI/UX)
- **Thiết kế Premium**: Sử dụng Glassmorphism, Gradients và Typography hiện đại (Inter Font).
- **Bilingual Support**: Chuyển đổi ngôn ngữ Tiếng Anh/Tiếng Việt tức thì mà không cần nạp lại toàn bộ trang.
- **Responsive**: Hoạt động tốt trên nhiều kích thước màn hình.

---

## 5. MÔ HÌNH DỮ LIỆU CỐT LÕI
- **Documents**: Lưu trữ metadata văn bản, nội dung bóc tách và bằng chứng xử lý.
- **Users**: Thông tin cán bộ, vai trò và phòng ban.
- **Departments**: Danh mục các phòng ban trong cơ quan.
- **AutoRules**: Các quy tắc bóc tách dữ liệu OCR tự động.
- **AuditLogs**: Lịch sử hoạt động của hệ thống.
