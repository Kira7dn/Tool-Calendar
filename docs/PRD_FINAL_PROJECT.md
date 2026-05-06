# ĐẶC TẢ SẢN PHẨM HOÀN THIỆN (FINAL PRD)
## Dự án: Hệ Thống Điều Phối Công Văn (Document Coordination System)
**Phiên bản:** 1.1 (AI Intelligence Edition)  
**Ngày cập nhật:** 06/05/2026

---

## 1. TỔNG QUAN DỰ ÁN
Hệ thống Điều phối Công văn là một giải pháp quản trị văn bản nội bộ cấp đơn vị, được thiết kế để giải quyết bài toán chậm trễ trong xử lý công việc hành chính. Hệ thống tự động hóa luồng công việc từ khâu nạp văn bản (OCR), rà soát, điều phối đến giám sát tiến độ thời gian thực, tích hợp AI học máy cục bộ để tối ưu hóa quy trình phân loại.

### Giá trị cốt lõi:
- **Tối ưu thời gian**: Tự động bóc tách thông tin văn bản bằng OCR và gợi ý phân loại bằng AI.
- **Minh bạch tiến độ**: Giám sát deadline theo cơ chế 7-3-1 ngày.
- **Trải nghiệm cao cấp**: Giao diện hiện đại (React 19), mượt mà, hỗ trợ song ngữ Tiếng Anh - Tiếng Việt.
- **Bảo mật & Riêng tư**: Vận hành hoàn toàn Local-first, tích hợp AI offline không cần internet.

---

## 2. KIẾN TRÚC KỸ THUẬT (TECH STACK)
Hệ thống được xây dựng trên nền tảng công nghệ tiên tiến nhất, ưu tiên tính ổn định và tốc độ phản hồi.

- **Backend**: .NET 10 Web API (Hiệu năng cao, hỗ trợ AI Native).
- **AI Engine**: **ML.NET** (Xây dựng mô hình học máy cục bộ để tự động phân loại công văn).
- **Database**: SQLite (WAL Mode - Hỗ trợ truy cập đồng thời cao).
- **Frontend**: React 19, Vite, Tailwind CSS v4, shadcn/ui (Giao diện hiện đại, tối ưu hiệu năng).
- **Real-time**: SignalR (Đẩy thông báo tức thời).
- **OCR Engine**: Tesseract OCR Industrial Edition (Nhận diện chữ viết tiếng Việt chính xác cao).
- **Deployment**: Docker Compose (Microservices architecture), Nginx Reverse Proxy, ngrok Tunnel.

---

## 3. CÁC TÍNH NĂNG TRỌNG TÂM

### 3.1. Trí tuệ Nhân tạo Nội bộ (Local AI Intelligence)
- **Tự động phân loại (Classification)**: AI dựa trên nội dung OCR để tự động gợi ý Nhãn (Label) và Phòng ban xử lý phù hợp.
- **Cơ chế Human-in-the-loop (Quan trọng)**: AI không học trực tiếp từ file PDF gốc mà học từ **dữ liệu đã được người dùng rà soát và chỉnh sửa** trong Database. Điều này đảm bảo AI luôn học từ các mẫu dữ liệu chính xác nhất, loại bỏ các sai sót do OCR gây ra.
- **Vòng lặp tự học (Self-learning)**: Hệ thống tự động huấn luyện lại mô hình AI (Retraining) dựa trên các thao tác điều chỉnh của người dùng để ngày càng chính xác hơn.
- **Bảo mật dữ liệu**: Toàn bộ quá trình huấn luyện và dự báo diễn ra 100% offline trên máy chủ local.

### 3.2. Dashboard & Phân tích (Analytics)
- Biểu đồ Doughnut (Chart.js) hiển thị tỷ lệ hoàn thành, quá hạn và đang xử lý.
- Thẻ thống kê động: Tổng văn bản, Sắp hết hạn, Quá hạn, Đến hạn hôm nay.
- Danh sách "Xử lý gần đây" cập nhật tức thời qua SignalR.

### 3.3. Quy trình Xử lý Văn bản Thông minh
- **Hàng đợi OCR & AI**: Tự động bóc tách Số văn bản, Trích yêu và **Gợi ý phân loại** ngay khi upload.
- **Giao diện Rà soát Side-by-Side**: So sánh file PDF gốc và dữ liệu bóc tách trên cùng một màn hình.
- **Phân luồng tự động**: Tự động gán người xử lý dựa trên loại văn bản đã được AI nhận diện.

### 3.4. Điều phối & Giám sát (Workflow)
- **Phân vai trò (RBAC)**: Admin, Leader, Clerk, Officer.
- **Quản lý Minh chứng**: Officer nộp báo cáo kết quả kèm file đính kèm để hoàn thành nhiệm vụ.

### 3.5. Hệ thống Cảnh báo & Thông báo
- **Web Push Notification**: Thông báo ngay cả khi trình duyệt đang đóng.
- **Cơ chế 7-3-1**: Tự động nhắc việc thông minh qua thông báo đẩy và email nội bộ.

---

## 4. GIAO DIỆN & TRẢI NGHIỆM (UI/UX)
- **Thiết kế Premium**: Sử dụng Glassmorphism, Gradients và hệ thống Design System của shadcn/ui.
- **Bilingual Support**: Chuyển đổi ngôn ngữ Tiếng Anh/Tiếng Việt tức thì.
- **Dark/Light Mode**: Tự động thích ứng theo tùy chọn hệ thống.

---

## 5. CẤU TRÚC DỮ LIỆU CHI TIẾT (DATA DICTIONARY)

Hệ thống sử dụng SQLite làm cơ sở dữ liệu cốt lõi, được thiết kế theo mô hình quan hệ để đảm bảo tính toàn vẹn dữ liệu và hỗ trợ tốt cho việc huấn luyện AI.

### 5.1. Bảng `Documents` (Quản lý Công văn)
Lưu trữ thông tin metadata, kết quả OCR và dữ liệu đầu vào cho AI.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| **Id** | INTEGER | PK, Auto Inc | Khóa chính. |
| **SoVanBan** | TEXT | | Số hiệu công văn (Bóc tách từ OCR). |
| **TenCongVan** | TEXT | Not Null | Tiêu đề đầy đủ của văn bản. |
| **TrichYeu** | TEXT | | Nội dung tóm tắt nội dung văn bản. |
| **FullText** | TEXT | | **Văn bản thô từ OCR (Dữ liệu huấn luyện AI).** |
| **NgayBanHanh** | DATETIME | | Ngày ký/ban hành văn bản. |
| **ThoiHan** | DATETIME | | Hạn xử lý (Dùng để tính cảnh báo 7-3-1). |
| **FilePath** | TEXT | | Đường dẫn file PDF gốc trong folder `Uploads`. |
| **Status** | TEXT | Default 'Mới' | Trạng thái: Chưa xử lý, Đã rà soát, Đã hoàn thành. |
| **LabelId** | INTEGER | FK (Labels) | Phân loại công văn (Dự án, Môi trường, ...). |
| **DepartmentId**| INTEGER | FK (Depts) | Phòng ban chịu trách nhiệm chính. |
| **AssignedTo** | INTEGER | FK (Users) | Cán bộ trực tiếp xử lý văn bản. |

### 5.2. Bảng `Users` (Người dùng hệ thống)
Lưu trữ thông tin cán bộ và liên kết quyền hạn.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| **Id** | INTEGER | PK, Auto Inc | Khóa chính. |
| **Username** | TEXT | Unique | Tên đăng nhập. |
| **PasswordHash**| TEXT | | Mật khẩu đã mã hóa (BCrypt). |
| **FullName** | TEXT | | Họ tên đầy đủ của cán bộ. |
| **Role** | TEXT | | **Vai trò: Admin, Leader, Clerk, Officer.** |
| **DepartmentId**| INTEGER | FK (Depts) | Thuộc phòng ban quản lý nào. |

### 5.3. Bảng `Departments` & `Labels` (Danh mục)
- **Departments**: `Id (PK)`, `Name`, `Description`. (Danh sách phòng ban).
- **Labels**: `Id (PK)`, `Name`, `Color`. (Nhãn phân loại phục vụ AI và hiển thị).

### 5.4. Bảng `AutoRules` & AI Intelligence
- **AutoRules**: `Id (PK)`, `Keyword`, `LabelId`, `DepartmentId`. (Quy tắc bóc tách từ khóa).
- **AI Models**: Các file mô hình học máy (`.zip`) được lưu trữ tại thư mục `/data/intelligence` để phục vụ dự đoán offline.

---

## 6. LỘ TRÌNH PHÁT TRIỂN (ROADMAP)
1. **Giai đoạn 1**: Hoàn thiện Core System & OCR Tesseract (Đã thực hiện).
2. **Giai đoạn 2**: Tích hợp ML.NET Intelligence để tự động hóa phân loại (Hiện tại).
3. **Giai đoạn 3**: Mở rộng hệ thống Report chuyên sâu và Mobile Responsive Dashboard.
