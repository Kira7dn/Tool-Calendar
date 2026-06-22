# Nhật ký Thay đổi Mã Nguồn (Commit Log)

Tệp này lưu trữ lịch sử các thay đổi và tính năng mới được thêm vào hệ thống để AI có thể nhanh chóng nắm bắt ngữ cảnh mà không cần quét lại toàn bộ mã nguồn.

## Lịch sử

### [2026-06-22 23:45] Hoàn tất commit và chuẩn hóa cấu trúc
- **Mô tả**: Commit toàn bộ các phần code đã chuẩn hóa ApiResponse, Global Exception Middleware, Global Fetch Interceptor, Git Hooks kiểm soát chất lượng (Quality Gates) cùng các tệp cấu hình liên quan.
- **Tệp thay đổi**:
  - `.agents/AGENTS.md`
  - `.editorconfig`
  - `.githooks/commit-msg`
  - `.githooks/pre-commit`
  - `.gitignore`
  - `CODE_QUALITY.md`
  - `Dockerfile`
  - `SYSTEM_FEATURES.md`
  - `ToolCalendar.Api/ClientApp/.prettierignore`
  - `ToolCalendar.Api/ClientApp/.prettierrc`
  - `ToolCalendar.Api/ClientApp/eslint.config.js`
  - `ToolCalendar.Api/ClientApp/package.json`
  - `ToolCalendar.Api/ClientApp/src/main.jsx`
  - `ToolCalendar.Api/ClientApp/src/pages/Upload.jsx`
  - `ToolCalendar.Api/Controllers/AdminController.cs`
  - `ToolCalendar.Api/Controllers/AuthController.cs`
  - `ToolCalendar.Api/Controllers/BackupController.cs`
  - `ToolCalendar.Api/Controllers/DocumentRoutingsController.cs`
  - `ToolCalendar.Api/Controllers/DocumentsController.cs`
  - `ToolCalendar.Api/Controllers/NotificationController.cs`
  - `ToolCalendar.Api/Controllers/StatsController.cs`
  - `ToolCalendar.Api/Controllers/UsersController.cs`
  - `ToolCalendar.Api/Middleware/GlobalExceptionMiddleware.cs`
  - `ToolCalendar.Core/Data/Repositories/UserRepository.cs`
  - `ToolCalendar.Core/Models/ApiResponse.cs`
- **Lệnh git commit**: `git commit -m "feat(api): standardize api response, exception handling and quality gates"`

### [2026-06-22 23:30] Tái cấu trúc DocumentExtractorService và thêm Unit Tests
- **Mô tả**: Tái cấu trúc `DocumentExtractorService` thành Facade pattern. Tách logic xử lý Text OCR và Image OCR (Pdf/Word) sang 2 service riêng biệt `OcrTextProcessingService` và `OcrImageProcessingService` để tuân thủ nguyên lý SOLID, giúp code dễ đọc và dễ bảo trì hơn. Thêm dự án Unit Tests và tạo các bài test cho Ocr Text Regex và Password Hash.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Services/DocumentExtractorService.cs` (Sửa đổi thành Facade)
  - `ToolCalendar.Core/Services/OcrTextProcessingService.cs` (Mới)
  - `ToolCalendar.Core/Services/IOcrTextProcessingService.cs` (Mới)
  - `ToolCalendar.Core/Services/OcrImageProcessingService.cs` (Mới)
  - `ToolCalendar.Core/Services/IOcrImageProcessingService.cs` (Mới)
  - `ToolCalendar.Api/Program.cs` (Đăng ký Dependency Injection)
  - `ToolCalendar.Tests/OcrTextRegexTests.cs` (Mới)
  - `ToolCalendar.Tests/AuthPasswordHashTests.cs` (Mới)
- **Lệnh git commit**: `git commit -m "refactor: restructure DocumentExtractorService and add unit tests"`

### [2026-06-22 17:40] Chuẩn hóa API Response & Global Error Handling và Global Fetch Interceptor
- **Mô tả**: Chuẩn hóa toàn bộ API Response & Global Error Handling ở backend bằng lớp `ApiResponse<T>` đồng thời cập nhật xử lý ở frontend qua Global Fetch Interceptor trong `main.jsx` để tự động unwrap dữ liệu và xử lý các lỗi tương thích hoàn toàn.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Models/ApiResponse.cs` (thêm generic Ok<T>)
  - `ToolCalendar.Api/Controllers/AuthController.cs` (chuẩn hóa login, logout, change password)
  - `ToolCalendar.Api/Controllers/UsersController.cs` (chuẩn hóa quản lý user)
  - `ToolCalendar.Api/Controllers/AdminController.cs` (chuẩn hóa phòng ban, nhãn, luật, audit logs)
  - `ToolCalendar.Api/Controllers/BackupController.cs` (chuẩn hóa backup)
  - `ToolCalendar.Api/Controllers/DocumentRoutingsController.cs` (chuẩn hóa luân chuyển văn bản)
  - `ToolCalendar.Api/Controllers/NotificationController.cs` (chuẩn hóa đăng ký, gửi thông báo đẩy)
  - `ToolCalendar.Api/Controllers/StatsController.cs` (chuẩn hóa biểu đồ dashboard, cài đặt)
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (chuẩn hóa toàn diện quản lý văn bản, bình luận, reaction, công khai)
  - `ToolCalendar.Api/ClientApp/src/main.jsx` (thêm Global Fetch Interceptor)
- **Lệnh git commit**: `git commit -m "feat(api): standardize api response and global exception handling with global fetch interceptor"`


### [2026-06-22 15:22] Thiết lập Cổng kiểm duyệt chất lượng code (Quality Gates)
- **Mô tả**: Thiết lập hệ thống 5 chốt chặn bắt buộc cho mọi lần commit: (1) COMMIT_LOG.md bắt buộc cập nhật, (2) Quét Secrets/Hardcoded Passwords (OWASP A02), (3) ESLint kiểm tra chất lượng React, (4) Prettier kiểm tra định dạng code, (5) dotnet format kiểm tra chuẩn C#. Đồng thời, thiết lập chuẩn commit message Conventional Commits.
- **Tệp thay đổi**:
  - `.githooks/pre-commit` (cập nhật hook với 5 chốt kiểm duyệt)
  - `.githooks/commit-msg` (hook kiểm tra Conventional Commits)
  - `.editorconfig` (chuẩn định dạng toàn dự án)
  - `ToolCalendar.Api/ClientApp/eslint.config.js` (cấu hình ESLint)
  - `ToolCalendar.Api/ClientApp/.prettierrc` (cấu hình Prettier)
  - `ToolCalendar.Api/ClientApp/package.json` (thêm devDependencies)
  - `CODE_QUALITY.md` (tài liệu mô tả quy tắc chất lượng)

### [2026-06-22 08:11] Sửa lỗi mã hóa mật khẩu & Cập nhật Password Hash
- **Mô tả**: Sửa lỗi nghiêm trọng khiến hệ thống ghi đè một mật khẩu rỗng vào cơ sở dữ liệu khi cập nhật thông tin người dùng. Gỡ bỏ trạng thái khóa (Lockout) cho tất cả người dùng và tự động đặt lại mật khẩu của toàn bộ 42 tài khoản thành `CamPha@2026!`. Thêm tính năng tự động nâng cấp mã băm (hash) PBKDF2/BCrypt trong lần đăng nhập đầu tiên.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/UserRepository.cs`
  - `ToolCalendar.Api/Controllers/UsersController.cs`

