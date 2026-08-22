# Tài Liệu Hệ Thống Điều Phối Công Văn (Dành cho AI & Developer)

Tài liệu này là "Bộ não" của hệ thống, chứa các thông tin thiết yếu nhất về kiến trúc, cơ sở dữ liệu, API và các luật nghiệp vụ (Business Rules). **AI phải đọc tài liệu này trước khi chỉnh sửa code để tránh phá vỡ logic cũ.**

---

## 1. Kiến Trúc Hệ Thống (Architecture)
- **Mô hình**: Client-Server phân tách hoàn toàn (Frontend build ra static file nạp vào wwwroot).
- **Frontend**: React 19, Vite, Tailwind CSS v4, shadcn/ui. Call API bằng `fetch`.
- **Backend**: ASP.NET Core 10.0 (Minimal/MVC APIs), C#.
- **Database**: SQLite (Sử dụng ADO.NET/SqliteDataReader thủ công, **KHÔNG dùng Entity Framework**). File DB nằm tại `/app/data/documents.db` (trong Docker) hoặc `data_dump/documents.db` (trên máy Host).
- **Background Jobs**: RabbitMQ cho hàng đợi OCR (Trích xuất văn bản), SignalR cho thông báo thời gian thực (Push/WebSockets).
- **Bảo mật**: JWT Token, ClamAV (quét file upload), BCrypt/PBKDF2 (Mật khẩu), Nginx Reverse Proxy.

---

## 2. Database Schema (Bảng Dữ Liệu)
*(Vì dùng ADO.NET thô, cấu trúc bảng cực kỳ quan trọng)*

### `Users` (Người dùng)
- `Id`, `Username`, `PasswordHash`, `FullName`, `Email`, `PhoneNumber`, `Role` (Admin, LanhDao, VanThu, CanBo), `DepartmentId`.
- Cột Identity: `SecurityStamp`, `NormalizedUserName`, `LockoutEnabled`, `AccessFailedCount`, `LockoutEnd`, `FailedLoginCount`, `LockoutUntil`.

### `Documents` (Công văn)
- `Id`, `SoVanBan`, `TenCongVan`, `TrichYeu`, `FullText` (Nội dung OCR).
- `NgayBanHanh`, `CoQuanBanHanh`, `CoQuanChuQuan`, `ThoiHan` (Deadline), `DonViChiDao`.
- `Status` (Chưa xử lý, Đang xử lý, Hoàn thành, Lỗi OCR), `Priority` (Thường, Khẩn, Hỏa tốc).
- `FilePath`, `ContentHash` (Chống trùng lặp file).
- `DepartmentId`, `AssignedTo`, `AssignedUserIds`, `AssignedDepartmentIds` (Dạng chuỗi JSON, ví dụ `[1, 2]`).
- `EvidencePaths`, `EvidenceNotes`, `CompletionDate`.

### `DocumentRoutings` (Luân chuyển công văn)
- `Id`, `DocumentId`, `SenderId`, `ReceiverId`, `ParentRoutingId`.
- `Role` (Chủ trì, Phối hợp), `ForwardDate`, `Deadline`, `Status` (Chưa xử lý, Đang xử lý, Hoàn thành, Từ chối).

### `Comments` & `CommentReactions` (Bình luận & Thả tim)
- `Comments`: `Id`, `DocumentId`, `UserId`, `Username`, `Content`, `AttachmentPaths`.
- `CommentReactions`: `ReactionType` (like, love, haha, vv).

### Các bảng phụ khác
- `Departments` (Phòng ban), `Labels` (Nhãn), `AutoRules` (Luật tự động gán nhãn/người).
- `PushSubscriptions` (Đăng ký Web Push), `Notifications` (Thông báo in-app).
- `AuditLogs` & `LoginAuditLog` (Nhật ký hệ thống/đăng nhập).

---

## 3. Các API Endpoints Chính

Tất cả API có prefix `/api/`. Đa số yêu cầu Header `Authorization: Bearer <token>`.

### Auth (`AuthController`)
- `POST /api/auth/login`: `{ username, password }` -> Trả về JWT Token. (Rate limit: 5 lần/phút).
- `POST /api/auth/change-password`: `{ oldPassword, newPassword }`.
- `GET /api/auth/me`: Lấy thông tin user hiện tại.

### Users (`UsersController`)
- `GET /api/users`: Lấy ds user (Bảo mật: Đã filter bỏ PasswordHash).
- `POST /api/users` / `PUT /api/users/{id}`: Thêm/Sửa user.

### Documents (`DocumentsController`)
- `GET /api/documents`: Phân trang, lọc theo status, ngày, phòng ban.
- `POST /api/documents/upload`: Upload multipart/form-data. Trả về Id. (Gọi RabbitMQ OCR ngầm).
- `GET /api/documents/{id}`: Lấy chi tiết.
- `PUT /api/documents/{id}/status`: Cập nhật trạng thái.
- `POST /api/documents/{id}/complete`: Nộp minh chứng hoàn thành.
- `POST /api/documents/{id}/comments`: Thêm bình luận.

### Routing (`DocumentRoutingsController`)
- `POST /api/routings`: Chuyển xử lý văn bản (Tạo bản ghi Routing mới).
- `PUT /api/routings/{id}/status`: Cập nhật trạng thái luồng.

### Dashboard/Stats (`StatsController`)
- `GET /api/stats/dashboard`: Số liệu tổng quan 7-3-1 (Đến hạn hôm nay, Sắp hạn, Quá hạn).
- `GET /api/stats/monthly-report`: Báo cáo tháng.

---

## 4. Các Business Rules Trọng Yếu (Nghiệp vụ cốt lõi)

### 4.1. Thuật toán 7-3-1 (Dashboard & Thông báo)
Hệ thống giám sát hạn chót (`ThoiHan`) của công văn và phân loại:
- **Đến hạn hôm nay (1 ngày)**: `ThoiHan` bằng ngày hiện tại.
- **Sắp đến hạn (3-7 ngày)**: `ThoiHan` còn trong khoảng 1 đến 7 ngày tới.
- **Quá hạn**: `ThoiHan` nhỏ hơn ngày hiện tại và `Status != 'Hoàn thành'`.
- Job Background tự động quét lúc **08:30 sáng** mỗi ngày để đẩy thông báo.

### 4.2. Luồng OCR (Nhận dạng ký tự quang học)
1. User upload file (PDF/Img) -> `DocumentsController`.
2. Controller lưu file, lưu DB với `Status = 'Đang xử lý OCR'`, bắn message vào **RabbitMQ**.
3. `OcrQueueService` (BackgroundService) nhận message -> Gọi `DocumentExtractorService`.
4. Gửi file sang Python AI Service qua HTTP -> Python dùng `pypdfium2` (cho PDF chuẩn) hoặc `Docling` (để OCR file ảnh/scan) -> Lấy full text.
5. Chạy Regex bóc tách: *Số hiệu, Trích yếu, Ngày tháng, Đơn vị ban hành*.
6. Cập nhật DB, đổi Status thành `Chưa xử lý` -> Bắn SignalR báo cho Client.

### 4.3. Quản lý Mật khẩu & Đăng nhập
- Backend hỗ trợ 2 loại hash: Legacy Plain-text và Identity BCrypt/PBKDF2.
- Nếu User đăng nhập bằng Plain-text đúng -> Hệ thống **tự động nâng cấp (rehash)** sang BCrypt.
- Có cơ chế Rate Limiting (chặn IP 60s nếu spam login 5 lần).
- Có cơ chế Lockout của Identity (Khóa tài khoản 15 phút nếu sai mật khẩu 5 lần).

### 4.4. Quản lý Luân chuyển
- Văn bản có thể giao cho 1 Phòng ban (DepartmentId) hoặc giao trực tiếp cho Cán bộ (AssignedTo / AssignedUserIds).
- Bảng `DocumentRoutings` lưu lịch sử chuyển giao: Ai giao cho Ai, vai trò Chủ trì hay Phối hợp.

