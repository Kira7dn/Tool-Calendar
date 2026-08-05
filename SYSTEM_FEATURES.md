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
4. Extractor convert PDF thành Img -> Gọi Python PaddleOCR qua HTTP -> Lấy full text.
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

---

## 5. Phân hệ: Phòng họp không giấy tờ (Cabinet Module)

> ⚠️ **Quan trọng cho AI**: Đây là phân hệ độc lập, có prefix route riêng `api/phonghopkhonggiayto/`. Mọi Controller, Repository, Model đều nằm trong namespace/folder riêng và **KHÔNG** được trộn với phân hệ văn bản công vụ.

### 5.1. Kiến trúc Frontend

- **AppShell**: `CabinetAppShell.jsx` — layout chính với sidebar navigation, header (chuông thông báo, dropdown tài khoản, modal Giao diện/Phiên bản).
- **Tab routing**: Mỗi mục sidebar ánh xạ sang tab index, truyền `activeTab` xuống page component tương ứng.
- **Page index** (`CabinetMeetings.jsx`):
  - `tab 0` → `MeetingList` (Danh sách phiên họp)
  - `tab 1` → `CabinetProceedings` (Kỷ yếu phiên họp)
  - `tab 2` → `CabinetConclusions` (Tra cứu kết luận)
  - `tab 3` → `CabinetNotebook` (Quản lý sổ tay)

### 5.2. Database Schema — Bảng phòng họp

#### `Rooms` (Phòng họp)
- `Id`, `Name`, `Capacity`, `Location`, `Description`, `CreatedAt`

#### `Meetings` (Phiên họp)
- `Id`, `Title`, `StartTime`, `EndTime`, `RoomId` (FK → Rooms), `Status`
  - Status: `Sắp diễn ra` | `Đang diễn ra` | `Hoàn thành` | `Hủy`
- `CreatorId` (FK → Users), `CreatedAt`
- **Thông tin nội dung** (cột migration thêm sau):
  - `Location` — Địa điểm chi tiết (VD: Phòng họp tầng 4)
  - `Presider` — Người chủ trì (VD: Đ/c Nguyễn Đức Dương - Phó Chủ tịch UBND)
  - `PreparingUnit` — Đơn vị chuẩn bị tài liệu
  - `Content` — Nội dung/chương trình họp
  - `Notes` — Ghi chú thêm
  - `OrganizingUnit` — Đơn vị tổ chức
  - `ExpectedAttendees` — Số lượng đại biểu dự kiến (INTEGER)
  - `ExternalParticipants` — Khách mời ngoài cơ quan
  - `MeetingType` — Loại phiên họp (Thường kỳ, Chuyên đề...)
  - `OnlineMeetingUrl` — Link họp trực tuyến
  - `ProgramFilePaths` — File nội dung chương trình họp (JSON array)
  - `InvitationFilePaths` — File giấy mời/phiếu mời (JSON array)

#### `MeetingParticipants` (Thành phần tham dự)
- `MeetingId`, `UserId` (PRIMARY KEY kép)
- `AttendanceStatus`: `Chưa xác nhận` | `Có tham gia` | `Vắng mặt`

#### `Questionnaires` (Phiếu lấy ý kiến)
- `Id`, `MeetingId`, `Title`, `AssignedTo`, `Deadline`, `Status` (`Chưa trả lời` | `Đã trả lời`), `CreatedAt`

#### `MeetingProceedings` (Kỷ yếu phiên họp)
- `Id`, `Name` (NOT NULL), `Description`, `CreatorId`, `CreatedAt`
- Đây là nhóm/danh mục tổ chức các phiên họp theo chủ đề

#### `MeetingProceedingItems` (Liên kết Kỷ yếu ↔ Phiên họp)
- `ProceedingId`, `MeetingId` (PRIMARY KEY kép)
- Cho phép 1 kỷ yếu chứa nhiều phiên họp (many-to-many)

#### `MeetingConclusions` (Kết luận sau phiên họp)
- `Id`, `MeetingId` (FK → Meetings), `FileName`, `Status`, `LastHandlerId`, `Progress` (0-100), `UpdatedAt`
- Status: `Chưa xử lý` | `Đang xử lý` | `Đã xử lý`

#### `MeetingNotes` (Sổ tay ghi chú cá nhân)
- `Id`, `MeetingId` (FK → Meetings), `UserId` (FK → Users)
- `Content`, `AttachmentPaths` (JSON array of file paths), `CreatedAt`
- **Per-user**: Mỗi user chỉ thấy ghi chú của mình. Chỉ người tạo mới được xóa.

### 5.3. API Endpoints — Cabinet

> Tất cả đều có prefix `api/phonghopkhonggiayto/` và yêu cầu `Authorization: Bearer <token>`.

#### Phòng họp (`RoomsController`)
- `GET /rooms` — Danh sách phòng họp
- `POST /rooms` — Tạo phòng họp mới
- `PUT /rooms/{id}` — Cập nhật phòng họp
- `DELETE /rooms/{id}` — Xóa phòng họp

#### Phiên họp (`MeetingsController`)
- `GET /meetings/schedule` — **Tất cả** phiên họp (dùng cho admin/lãnh đạo)
- `GET /meetings/my-meetings` — Phiên họp mà **user hiện tại được mời** (kèm `AttendanceStatus` thực từ DB)
- `GET /meetings/dashboard` — Thống kê tổng quan (đang diễn ra, sắp tới, trong tháng, tỷ lệ tham dự thực)
- `GET /meetings/{id}` — Chi tiết 1 phiên họp (kèm danh sách thành phần)
- `POST /meetings` — Tạo phiên họp mới (body: `CreateMeetingRequest`)
- `PUT /meetings/{id}` — Cập nhật phiên họp
- `PUT /meetings/{id}/attendance` — Cập nhật trạng thái tham dự cá nhân (`{ Status: "Có tham gia" | "Vắng mặt" | "Chưa xác nhận" }`)
- `DELETE /meetings/{id}` — Hủy/xóa phiên họp

#### Kỷ yếu phiên họp (`MeetingProceedingsController`)
- `GET /proceedings` — Danh sách tất cả kỷ yếu (tên, ngày tạo, người tạo)
- `GET /proceedings/{id}` — Chi tiết kỷ yếu + danh sách phiên họp thuộc kỷ yếu đó
- `POST /proceedings` — Tạo kỷ yếu mới (`{ name, description, meetingIds[] }`)
- `POST /proceedings/{id}/meetings/{meetingId}` — Gắn thêm phiên họp vào kỷ yếu
- `DELETE /proceedings/{id}/meetings/{meetingId}` — Gỡ phiên họp khỏi kỷ yếu
- `DELETE /proceedings/{id}` — Xóa kỷ yếu (Admin/LanhDao only)

#### Kết luận sau phiên họp (`MeetingConclusionsController`)
- `GET /conclusions?search=&page=&pageSize=` — Danh sách kết luận (có phân trang, tìm kiếm theo tên phiên họp / tên file)
- `GET /conclusions/{id}` — Chi tiết kết luận
- `POST /conclusions` — Tạo kết luận mới (`{ meetingId, fileName, status, progress }`)
- `PUT /conclusions/{id}` — Cập nhật tiến độ/trạng thái (`{ status, progress, lastHandlerId }`)
- `DELETE /conclusions/{id}` — Xóa kết luận (Admin/LanhDao only)

#### Sổ tay ghi chú (`MeetingNotesController`)
- `GET /notes?search=` — Ghi chú của **user hiện tại** (lọc theo tên phiên họp / nội dung)
- `POST /notes` (multipart/form-data) — Tạo ghi chú mới với file đính kèm
  - Form fields: `meetingId` (int), `content` (string), `files[]` (IFormFile[])
  - File lưu tại: `Uploads/notes/<guid>_<filename>` trong ContentRoot
- `DELETE /notes/{id}` — Xóa ghi chú (chỉ người tạo mới được xóa)

#### Phiếu lấy ý kiến (`QuestionnairesController`)
- `GET /questionnaires` — Danh sách phiếu lấy ý kiến của user
- `POST /questionnaires` — Tạo phiếu lấy ý kiến mới

### 5.4. Frontend Pages — Cabinet

| File | Mô tả |
|---|---|
| `CabinetAppShell.jsx` | Layout tổng (sidebar, header, notification popover, modal giao diện/phiên bản) |
| `CabinetHome.jsx` | Dashboard: thống kê tháng, danh sách phiên họp đang/sắp diễn ra, phiếu ý kiến chưa trả lời |
| `CabinetSchedule.jsx` | Lịch họp cá nhân (FullCalendar view) |
| `CabinetUnitSchedule.jsx` | Lịch họp đơn vị (FullCalendar view) |
| `CabinetLeaderSchedule.jsx` | Lịch công tác lãnh đạo |
| `MeetingList.jsx` | Danh sách phiên họp (bảng, phân trang, bộ lọc, export) — fetch từ `/my-meetings` |
| `MeetingDetail.jsx` | Chi tiết phiên họp (thành phần, tài liệu, chương trình) |
| `MeetingProgress.jsx` | Diễn biến phiên họp (timeline, biên bản họp) |
| `CabinetProceedings.jsx` | Kỷ yếu phiên họp (sidebar danh sách kỷ yếu + panel phiên họp thuộc kỷ yếu) |
| `CabinetConclusions.jsx` | Tra cứu kết luận sau phiên họp (bảng có tìm kiếm, phân trang, tiến độ %) |
| `CabinetNotebook.jsx` | Quản lý sổ tay ghi chú cá nhân (có upload file đính kèm, xóa ghi chú) |
| `CabinetRooms.jsx` | Quản lý danh sách phòng họp (CRUD) |
| `CabinetQuestionnaire.jsx` | Quản lý phiếu lấy ý kiến |

### 5.5. Repositories — Cabinet

| Class | Interface | Mô tả |
|---|---|---|
| `MeetingRepository` | `IMeetingRepository` | CRUD phiên họp + `GetByParticipantAsync` + `UpdateAttendanceAsync` |
| `RoomRepository` | `IRoomRepository` | CRUD phòng họp |
| `QuestionnaireRepository` | `IQuestionnaireRepository` | CRUD phiếu lấy ý kiến |
| `MeetingProceedingRepository` | `IMeetingProceedingRepository` | CRUD kỷ yếu + quản lý liên kết phiên họp |
| `MeetingConclusionRepository` | `IMeetingConclusionRepository` | CRUD kết luận (có phân trang + search) |
| `MeetingNoteRepository` | `IMeetingNoteRepository` | CRUD ghi chú per-user (có upload file) |

### 5.6. Business Rules — Phòng họp

1. **Trạng thái tham dự**: Mặc định `Chưa xác nhận`. User phải chủ động xác nhận qua `PUT /meetings/{id}/attendance`. Chỉ người được mời (có trong `MeetingParticipants`) mới được cập nhật.
2. **Kỷ yếu**: Một kỷ yếu có thể chứa nhiều phiên họp (M:N qua `MeetingProceedingItems`). Một phiên họp có thể thuộc nhiều kỷ yếu.
3. **Ghi chú sổ tay**: Hoàn toàn private per-user. `DELETE` bị từ chối nếu `UserId` không khớp với người đăng nhập.
4. **Upload file ghi chú**: Lưu tại `Uploads/notes/` (không phải `Uploads/` chung của văn bản công vụ). Max 50MB, định dạng: `.doc`, `.docx`, `.xls`, `.xlsx`, `.txt`, `.ppt`, `.pptx`, `.pdf`.
5. **Dashboard stats**: Số liệu `Tham gia/Chưa xác nhận` là **dữ liệu thực** tính từ bảng `MeetingParticipants`. **Không được hardcode** giá trị.
6. **Chủ trì cuộc họp**: Hiển thị từ cột `Presider` trong bảng `Meetings`. **Không được hardcode** tên cứng.
