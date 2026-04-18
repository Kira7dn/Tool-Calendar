# Tài liệu Bàn giao Hạ tầng Backend (Giai đoạn 1)

Dự án **ToolCalendar** đã hoàn thành thiết lập toàn bộ lõi Backend chuyên sâu, đảm bảo hiệu suất và tính bảo mật theo yêu cầu nghiệp vụ.

## 1. Kiến trúc Tổng quan

- **Framework**: .NET 10 (Web API).
- **Cơ sở dữ liệu**: SQLite (`documents.db`) - Chạy local 100%, tự động khởi tạo Schema và Seed dữ liệu khi chạy lần đầu.
- **Mô hình Dữ liệu**: Được thiết kế theo chuẩn quan hệ với các bảng `Users`, `Documents`, `Departments`, `Labels`, `AutoRules`, `AppSettings`, và `AuditLogs`.

## 2. Hệ thống Dịch vụ Cốt lõi

### 🔐 Auth Service (Bảo mật & Phân quyền)

- **Token**: JWT (JSON Web Token).
- **Phân quyền**: RBAC (Role-Based Access Control) với 4 vai trò: `Admin`, `VanThu`, `LanhDao`, `CanBo`.
- **Logic**: Kiểm tra quyền hạn trên từng Endpoint của API.

### 👁️ OCR Service (Số hóa Văn bản)

- **Engine**: Tesseract OCR.
- **Hàng đợi**: Sử dụng `System.Threading.Channels` để xử lý file PDF chạy ngầm, tránh treo hệ thống khi upload nhiều file.
- **Bóc tách**: Tự động nhận diện Tên văn bản, Trích yếu, Mức độ khẩn bằng Regex và Phân tích văn bản.

### 📋 Document Service (Luồng Nghiệp vụ)

- **Điều phối**: Văn thư/Admin gán việc cho Phòng ban hoặc Cán bộ.
- **Bằng chứng**: Hỗ trợ cán bộ upload đa file bằng chứng kết quả.
- **Trạng thái**: Tự động luân chuyển trạng thái (Chưa xử lý -> Đang xử lý -> Đã hoàn thành).

### ⏰ Notification Service (Nhắc việc Tự động)

- **Background Worker**: `DeadlineWorker` chạy vào 08:30 hàng ngày.
- **Logic**: Quét văn bản còn hạn 7, 3, 1 ngày.
- **Kênh**: Ghi nhật ký hệ thống (AuditLog) và gửi Email (Stub).

### 📊 Admin & Stats Service (Quản trị & Báo cáo)

- **Quản trị**: CRUD đầy đủ cho Phòng ban, Nhãn, Quy tắc tự động.
- **Sao lưu**: Xuất toàn bộ dữ liệu ra file CSV chuẩn UTF-8 BOM (mở trực tiếp bằng Excel).
- **Báo cáo**: API thống kê Dashboard tổng hợp theo Trạng thái, Phòng ban và Độ khẩn.

## 3. Danh sách Endpoints Chính

| Module             | Route                                        | Quyền           | Ghi chú                  |
| :----------------- | :------------------------------------------- | :--------------- | :------------------------ |
| **Auth**     | `POST /api/auth/login`                     | Công khai       | Đăng nhập nhận JWT    |
| **Document** | `GET /api/documents`                       | All              | Lấy danh sách văn bản |
| **Upload**   | `POST /api/documents/upload`               | Admin, Văn thư | Upload PDF & OCR nền     |
| **Workflow** | `POST /api/documents/{id}/assign`          | Admin, Văn thư | Điều phối văn bản    |
| **Evidence** | `POST /api/documents/{id}/submit-evidence` | Admin, Cán bộ  | Nộp báo cáo kết quả  |
| **Admin**    | `GET /api/admin/departments`               | Admin            | Quản lý phòng ban      |
| **Backup**   | `GET /api/backup/export`                   | Admin            | Tải file CSV sao lưu    |
| **Stats**    | `GET /api/stats/summary`                   | All              | Dữ liệu Dashboard       |

## 4. Hướng dẫn thiết lập tiếp theo

- **Database**: Nếu cần xóa trắng dữ liệu, chỉ cần xóa file `documents.db` trong project root.
- **Uploads**: Toàn bộ file PDF và ảnh bằng chứng được lưu tại thư mục `Uploads/` trong API.

---

> [!TIP]
> Bước tiếp theo của dự án sẽ tập trung vào việc viết **Integration Tests** để đảm bảo 100% luồng nghiệp vụ chạy đúng trước khi bàn giao cho team UI/UX.
>
