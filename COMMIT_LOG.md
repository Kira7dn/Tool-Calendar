# Nhật ký Thay đổi Mã Nguồn (Commit Log)

Tệp này lưu trữ lịch sử các thay đổi và tính năng mới được thêm vào hệ thống để AI có thể nhanh chóng nắm bắt ngữ cảnh mà không cần quét lại toàn bộ mã nguồn.

## Lịch sử

### [2026-07-03 16:27] Sửa lỗi phông chữ khi xuất file CSV
- **Mô tả**: Sửa chuỗi tiêu đề CSV trong `DocumentRepository.cs` bị lỗi hiển thị phông chữ (mojibake) thành chuẩn tiếng Việt có dấu.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(data): correct mojibake font encoding issue in CSV export headers"`

### [2026-07-01 16:30] Sửa lỗi click vào thẻ KPI (Đang xử lý / Quá hạn / Hạn hôm nay) không filter đúng
- **Mô tả**: Bug: khi chuyển tab hoặc click nhiều lần vào cùng một thẻ KPI, filters không cập nhật do React không phát hiện sự thay đổi (object reference không đổi). Fix: thêm `_ts: Date.now()` vào `tabFilters` để luôn tạo ra object mới. Bonus: thêm logic tự động sort `deadline_asc` khi lọc `overdue`/`today` thay vì `newest` mặc định để ưu tiên hiển thị công văn cần xử lý nhất.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/shell/AppShell.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/pages/Documents.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(ui): ensure KPI card clicks always re-apply filters with correct sort order"`

### [2026-07-01 08:55] Thay thế alert bằng Modal cảnh báo khi hết hạn phiên đăng nhập
- **Mô tả**: Khi người dùng không hoạt động (idle timeout), thay vì dùng `alert()` mặc định của trình duyệt web gây gián đoạn và giao diện không thân thiện, ứng dụng sẽ hiển thị một `SessionExpiredModal` (tương tự như màn hình bị đá tài khoản). Modal này nhắc nhở người dùng bằng giao diện đẹp mắt (Tailwind CSS) và tự động khoá luồng công việc để bảo vệ dữ liệu.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/main.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(auth): replace default browser alert with custom modal for session timeout"`

### [2026-06-30 19:25] Làm động (dynamic) tab Lịch sử quy trình xử lý văn bản
- **Mô tả**: Thay thế giao diện fix cứng (hardcode) trong tab Lịch sử (`DocDetail.jsx`) bằng dữ liệu động được trích xuất từ cây luân chuyển (`routings`). Giờ đây mọi hành động Chuyển xử lý đều được phẳng hóa (flatten) và sắp xếp theo trình tự thời gian cùng với thời điểm tiếp nhận và hoàn thành.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/pages/DocDetail.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(ui): make document history tab dynamic based on routings"`

### [2026-06-30 18:45] Sửa lỗi crash "Loader2 is not defined" khi nhấn Chuyển xử lý
- **Mô tả**: Bổ sung import `Loader2` bị thiếu trong `ForwardDocumentModal.jsx`. Việc thiếu import này khiến ứng dụng React bị sập (crash màn hình báo lỗi) ngay khoảnh khắc người dùng bấm nút gửi do gọi Component hiển thị hiệu ứng xoay (loading) không tồn tại.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/components/ForwardDocumentModal.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(ui): import missing Loader2 component to prevent crash on submit"`

### [2026-06-30 18:25] Sửa lỗi không nhận được thông báo khi có người chuyển công văn
- **Mô tả**: Bổ sung hàm `ToolCalendar.Data.DatabaseService.InsertNotification` vào `CreateRouting` (`DocumentRoutingsController.cs`) để thông báo thực sự được lưu vào DB, giúp người nhận thấy được thông báo khi click vào icon chuông. Sửa lỗi lấy `senderId` bị sai claim type (`"uid"` thay vì `"id"`).
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Controllers/DocumentRoutingsController.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(api): insert notification to db on forward document and fix senderId claim"`

### [2026-06-30 18:15] Sửa lỗi màn hình trắng / ErrorBoundary do parse dữ liệu luân chuyển
- **Mô tả**: Bổ sung `Array.isArray` vào `isUserInRoutings` (trong `DocDetail.jsx`) và Component `DocumentRoutingTree` để chống lỗi "map is not a function" hoặc "is not iterable" nếu kết quả từ server trả về hoặc bị interceptor bọc không đúng định dạng mảng sau khi nhấn "Chuyển xử lý".
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/pages/DocDetail.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/components/DocumentRoutingTree.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(ui): add Array.isArray safety checks for routings to prevent frontend crash"`

### [2026-06-30 17:35] Thêm tính năng tìm kiếm người nhận trong modal Chuyển xử lý
- **Mô tả**: Thay thế thẻ `select` mặc định bằng một dropdown tùy chỉnh có tích hợp ô tìm kiếm. Giúp người dùng dễ dàng tìm kiếm cán bộ theo tên hoặc tài khoản (username) khi danh sách người dùng dài.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/components/ForwardDocumentModal.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(ui): add searchable dropdown for recipient in ForwardDocumentModal"`

### [2026-06-30 17:00] Sửa lỗi build do thiếu using directive ở DocumentsController.cs
- **Mô tả**: Bổ sung `using ToolCalendar.Data.Repositories;` trong `DocumentsController.cs` để nhận diện interface `IDocumentRoutingRepository`, sửa lỗi biên dịch CS0246 khi build Docker.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(build): add missing namespace import to DocumentsController"`

### [2026-06-30 16:55] Cho phép người nhận chuyển xử lý tiếp nhận và nộp kết quả công văn
- **Mô tả**:
  1. Khi công văn được chuyển xử lý (routing) sang cán bộ khác, cán bộ nhận không thấy nút "Tiếp nhận" hay "Nộp kết quả" trên trang chi tiết vì hệ thống chỉ check `doc.AssignedTo`.
  2. Đã viết thêm helper `isUserInRoutings` ở frontend và cập nhật điều kiện hiển thị nút "Tiếp nhận" và "Nộp kết quả".
  3. Cập nhật backend: khi cán bộ nộp kết quả (`SubmitEvidence`) hoặc chuyển trạng thái sang `Đang xử lý`, hệ thống sẽ tự động cập nhật trạng thái của dòng luân chuyển (routing) tương ứng của cán bộ đó thành "Đã xử lý" hoặc "Đang xử lý".
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRoutingRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/pages/DocDetail.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(tasks): allow routed users to accept and submit evidence; auto-update routing statuses"`

### [2026-06-30 16:15] Sửa lỗi không hiển thị công việc được chuyển xử lý (routing)
- **Mô tả**:
  1. Khi dùng chức năng "Chuyển xử lý", hệ thống tạo record trong bảng `DocumentRoutings` nhưng query lấy danh sách "Việc của tôi" (`GetTasksByUserIdAsync`) lại quên không JOIN với bảng này, dẫn đến người nhận không thấy công việc trong danh sách.
  2. Đã thêm mệnh đề `EXISTS` vào query để kiểm tra xem user có phải là `ReceiverId` trong bảng `DocumentRoutings` hay không.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(tasks): include routed documents from DocumentRoutings in GetTasksByUserIdAsync"`

### [2026-06-30 11:20] Sửa lỗi My Tasks sai + thêm thông báo real-time khi được chuyển công văn
- **Mô tả**:
  1. **FIX lỗi nghiêm trọng**: `GetTasksByUserIdAsync` dùng `LIKE '%userId%'` gây false-positive (userId=31 match nhầm 131, 310...) → người dùng thấy hàng trăm công việc sai. Đã sửa thành 4 pattern chính xác khớp JSON array: `[31]`, `[31,x]`, `[x,31]`, `[x,31,y]`.
  2. **Thêm SignalR notification**: Khi lãnh đạo chuyển công văn (`POST /api/documents/{id}/routings`), backend gửi sự kiện `NewTask` qua SignalR đến `User_<ReceiverId>`. Frontend bắt sự kiện, hiển thị toast "Bạn có công văn mới" kèm nút "Xem ngay" và refresh chuông thông báo.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/DocumentRoutingsController.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/lib/signalr.js` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/shell/AppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(tasks): sửa false-positive LIKE query; feat(notification): push NewTask khi chuyển công văn"`

### [2026-06-30 09:22] Thêm nút "Hệ thống chính" vào header Cabinet
- **Mô tả**: Nút "Về hệ thống chính" chỉ xuất hiện khi sidebar mở (tab Lịch họp, Phòng họp). Ở Trang chủ không có sidebar nên không có nút quay về. Đã thêm nút trực tiếp vào thanh header (góc phải) để luôn hiển thị ở mọi tab.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): add 'Hệ thống chính' button to header"`

### [2026-06-25 11:32] Thêm nút Lịch công tác vào Sidebar
- **Mô tả**: Thêm menu chuyển hướng đến trang `/campha` (Lịch công tác công khai) trên thanh menu điều hướng chính của hệ thống.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/shell/Sidebar.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(frontend): add Lịch công tác link to sidebar"`
### [2026-06-25 08:30] Nâng cấp hệ thống Auto Logout & Bảo mật Cookie chuẩn Enterprise
- **Mô tả**: Nâng cấp cơ chế Idle Timeout ở `main.jsx` bằng cách sử dụng `localStorage` để đồng bộ trạng thái giữa nhiều tab và dùng kỹ thuật Throttling (2s/lần) cho DOM events để giảm tải CPU. Ở phía Backend `AuthController.cs`, nâng cấp bảo mật bằng cách cấu hình `SameSiteMode.Strict` cho Cookie chứa JWT để phòng chống tấn công CSRF.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/main.jsx` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/AuthController.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(security): upgrade auto logout to enterprise multi-tab sync and enable strict samesite cookie"`

### [2026-06-25 07:49] Bổ sung tính năng Idle Timeout (Auto Logout)
- **Mô tả**: Khi người dùng không có tương tác (chuột, bàn phím, cuộn chuột) trong 30 phút, hệ thống sẽ tự động đăng xuất để bảo mật. Kỹ thuật này được triển khai ở `main.jsx` bằng việc lắng nghe DOM events và đặt lại bộ đếm `setTimeout`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/main.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(security): add 30 mins idle timeout auto logout"`

### [2026-06-24 17:38] Việt hóa các nút trên FullCalendar
- **Mô tả**: Dịch các nút "month", "week", "day", "today" sang tiếng Việt ("Tháng", "Tuần", "Ngày", "Hôm nay") bằng cấu hình `buttonText`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(frontend): việt hóa các nút của FullCalendar"`

### [2026-06-24 17:25] Sửa lỗi thiếu package @fullcalendar/core
- **Mô tả**: Bổ sung `@fullcalendar/core` vào `package.json` do frontend dùng tính năng Lịch nhưng thiếu package gốc gây lỗi build trên Docker.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/package.json` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(frontend): add missing @fullcalendar/core package"`

### [2026-06-24 17:15] Cập nhật CSDL và định dạng mã nguồn (Cabinet)
- **Mô tả**: Tự động tạo bảng CSDL cho phân hệ phòng họp (`Rooms`, `Meetings`, `MeetingParticipants`, `Questionnaires`) trong `DatabaseService.cs`. Fix lỗi duplicate import trong `vite.config.js` để vượt qua ESLint. Đồng thời áp dụng chuẩn định dạng code (Prettier) cho toàn bộ file frontend (`src/*`).
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/DatabaseService.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/vite.config.js` (Sửa đổi)
  - Tất cả các file trong `ToolCalendar.Api/ClientApp/src/` (Sửa đổi định dạng)
- **Lệnh git commit**: `git commit -m "style(cabinet): định dạng code frontend và khởi tạo bảng CSDL"`

### [2026-06-24 16:15] Triển khai phân hệ Phòng họp không giấy tờ (iCPV Cabinet)
- **Mô tả**: Dựng khung giao diện và API cơ bản cho phân hệ Phòng họp không giấy tờ theo kiến trúc Modular Monolith. Đã cấu hình các model, repository (ADO.NET), controllers, tách biệt giao diện AppShell riêng nhưng chạy chung một ứng dụng và thêm menu điều hướng. Thư viện FullCalendar được dùng để làm chức năng Lịch họp.
- **Tệp thay đổi**:
  - `seed_db.sql` (Sửa đổi)
  - `ToolCalendar.Core/Models/Room.cs` (Mới)
  - `ToolCalendar.Core/Models/Meeting.cs` (Mới)
  - `ToolCalendar.Core/Models/Questionnaire.cs` (Mới)
  - `ToolCalendar.Core/Data/Repositories/RoomRepository.cs` (Mới)
  - `ToolCalendar.Core/Data/Repositories/MeetingRepository.cs` (Mới)
  - `ToolCalendar.Core/Data/Repositories/QuestionnaireRepository.cs` (Mới)
  - `ToolCalendar.Api/Program.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/Cabinet/RoomsController.cs` (Mới)
  - `ToolCalendar.Api/Controllers/Cabinet/MeetingsController.cs` (Mới)
  - `ToolCalendar.Api/Controllers/Cabinet/QuestionnairesController.cs` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/main.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/shell/Sidebar.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/package.json` (Sửa đổi)
  - `.githooks/pre-commit` (Sửa đổi đường dẫn config của ESLint)
- **Lệnh git commit**: `git commit -m "feat(cabinet): triển khai phân hệ phòng họp không giấy tờ theo kiến trúc modular monolith"`

### [2026-06-23 16:00] Sửa lỗi Stale Closure ở chức năng Tìm kiếm
- **Mô tả**: Khi người dùng paste dữ liệu vào ô tìm kiếm, hàm `fetchDocuments` lấy nhầm state cũ (chuỗi rỗng) do hiện tượng Stale Closure của `setTimeout`. Đã refactor lại theo chuẩn React: sử dụng state `debouncedSearch` và `useEffect` riêng biệt để đảm bảo gọi API với dữ liệu chính xác.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/pages/Documents.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(frontend): sửa lỗi stale closure khi paste dữ liệu vào ô tìm kiếm"`

### [2026-06-23 00:18] Sửa lỗi cú pháp OcrTextProcessingService
- **Mô tả**: Sửa lỗi dư dấu ngoặc nhọn ở cuối tệp `OcrTextProcessingService.cs` gây lỗi biên dịch khi build Docker.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Services/OcrTextProcessingService.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix: remove extra braces in OcrTextProcessingService.cs"`

### [2026-06-23 00:09] Chuẩn hóa 4 IN-clause query sang Parameterized hoàn toàn
- **Mô tả**: Phát hiện 4 chỗ trong `DocumentRepository.cs` dùng `string.Join(",", ids)` để ghép trực tiếp vào IN clause thay vì dùng parameterized `@p0, @p1, ...`. Mặc dù input là `List<int>` (rủi ro SQL Injection thực tế là 0), pattern này vi phạm kiến trúc ADO.NET chuẩn của dự án. Đã fix tất cả sang pattern `ids.Select((_, i) => $"@p{i}")` để đảm bảo tính nhất quán kiến trúc.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi — 4 methods: GetReactionsForCommentsAsync, GetFilePathsByIdsAsync, BulkUpdateStatusAsync, BulkDeleteAsync)
- **Lệnh git commit**: `git commit -m "security(db): chuẩn hóa IN-clause sang fully parameterized trong DocumentRepository"`

### [2026-06-22 23:54] Thiết lập bộ Rule Agent hoàn chỉnh (Agent Constitution)
- **Mô tả**: Xây dựng bộ quy tắc chuyên nghiệp đầy đủ cho dự án, dựa trên kiến trúc SourceCodeLeos nhưng điều chỉnh 100% cho Tech Stack của Tool-Calendar (ASP.NET Core + ADO.NET + React 19 + Tailwind v4). Bao gồm Constitution chính, 5 rules chuyên biệt, 2 workflows chuẩn hóa, và 2 skills debug thực tế.
- **Tệp thay đổi**:
  - `.agents/AGENTS.md` (Viết lại hoàn toàn — Agent Constitution v2.0)
  - `.agents/rules/tc-rule-commit-log.md` (Mới — Bắt buộc cập nhật COMMIT_LOG)
  - `.agents/rules/tc-rule-conventional-commits.md` (Mới — Chuẩn commit message)
  - `.agents/rules/tc-rule-backend-architecture.md` (Mới — ADO.NET, ApiResponse<T>)
  - `.agents/rules/tc-rule-frontend-architecture.md` (Mới — React, Fetch Interceptor, Tailwind v4)
  - `.agents/rules/tc-rule-secret-management.md` (Mới — Zero-tolerance secrets policy)
  - `.agents/rules/tc-rule-quality-gate.md` (Mới — 5 chốt chặn chất lượng)
  - `.agents/rules/tc-rule-database-schema.md` (Mới — Schema chuẩn và ADO.NET patterns)
  - `.agents/workflows/tc-workflow-git-push.md` (Mới — Quy trình commit/push chuẩn)
  - `.agents/workflows/tc-workflow-new-feature.md` (Mới — Quy trình thêm tính năng mới)
  - `.agents/skills/tc-skill-ocr-debug.md` (Mới — Debug luồng OCR pipeline)
  - `.agents/skills/tc-skill-docker-setup.md` (Mới — Setup và debug Docker)
- **Lệnh git commit**: `git commit -m "docs(agents): thiết lập bộ rule agent hoàn chỉnh cho dự án"`

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


### [2026-06-27 22:20] Fix lỗi không đăng nhập được với dữ liệu mẫu
- **Mô tả**: Khi nạp dữ liệu mẫu từ `seed_db.sql`, cột `NormalizedUserName` bị bỏ trống. Điều này khiến hàm `FindByNameAsync` trong Identity (so khớp theo `NormalizedUserName` in hoa) không tìm thấy tài khoản, gây ra lỗi đăng nhập (trả về 401). Đã bổ sung cột `NormalizedUserName` vào câu lệnh INSERT và chạy script cập nhật trực tiếp trên CSDL để fix lỗi.
- **Tệp thay đổi**:
  - `seed_db.sql` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(auth): bổ sung NormalizedUserName cho users trong seed data để fix lỗi login"`

### [2026-06-27 22:38] Redesign giao diện CabinetAppShell (Phòng họp không giấy tờ)
- **Mô tả**: Thiết kế lại toàn bộ giao diện AppShell của phân hệ Phòng họp không giấy tờ theo mã nguồn mới được cung cấp (sử dụng theme đỏ `#c8102e`, bổ sung top navigation bar, sidebar mới). Tích hợp ngược lại thư viện `FullCalendar` và API fetch dữ liệu động vào thiết kế mới để thay thế cho custom calendar tĩnh, đồng thời ẩn thanh công cụ mặc định của FullCalendar để dùng custom buttons.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "style(cabinet): redesign giao diện AppShell và tích hợp FullCalendar"`

### [2026-06-27 22:52] Sprint 1 — Xây dựng 4 trang chính phân hệ Phòng họp không giấy tờ
- **Mô tả**: Triển khai Sprint 1 cho phân hệ iCPV Cabinet: tạo 4 trang UI hoàn chỉnh gồm Trang chủ Dashboard, Lịch họp (3 chế độ: cá nhân/lãnh đạo/đơn vị), Quản lý phòng họp và Quản lý phiếu lấy ý kiến. Thiết kế bám sát ảnh mẫu hệ thống hopkhonggiay.dcs.vn. CabinetAppShell được refactor thành router điều phối các trang con, hỗ trợ sidebar ngữ cảnh động theo từng tab.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi - refactor thành router)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetHome.jsx` (Mới - Trang chủ Dashboard)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetSchedule.jsx` (Mới - Lịch họp 3 chế độ + FullCalendar)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetRooms.jsx` (Mới - Quản lý phòng họp + phân trang)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetQuestionnaire.jsx` (Mới - Phiếu lấy ý kiến + 4 tab)
- **Lệnh git commit**: `git commit -m "feat(cabinet): Sprint 1 - Trang chủ, Lịch họp, Quản lý phòng họp, Phiếu lấy ý kiến"`

### [2026-06-27 23:10] feat(cabinet/rooms): Tính năng Thêm/Sửa/Xóa phòng họp + Toggle trạng thái
- **Mô tả**: Triển khai đầy đủ tính năng CRUD phòng họp. Backend: thêm UpdateAsync, DeleteAsync vào RoomRepository; mở rộng RoomsController với các endpoint PUT/{id}, DELETE/{id}, GET/departments. Frontend: viết lại CabinetRooms.jsx với modal Thêm/Sửa (có dropdown đơn vị từ DB), hộp thoại xác nhận xóa, toggle trạng thái inline, toast thông báo — tất cả dùng dữ liệu thật từ API.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/RoomRepository.cs` (Sửa đổi - thêm UpdateAsync, DeleteAsync)
  - `ToolCalendar.Api/Controllers/Cabinet/RoomsController.cs` (Sửa đổi - thêm PUT/{id}, DELETE/{id}, GET/departments)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetRooms.jsx` (Sửa đổi - full CRUD UI với modal)
- **Lệnh git commit**: `git commit -m "feat(cabinet/rooms): CRUD phòng họp - modal thêm/sửa, xóa, toggle trạng thái"`

### [2026-06-28 08:01] feat(cabinet/meetings): Tính năng Tạo/Sửa phiên họp với nội dung chi tiết
- **Mô tả**: Triển khai đầy đủ tính năng CRUD phiên họp với đầy đủ nội dung như thông báo họp thực tế (địa điểm, người chủ trì, đơn vị chuẩn bị tài liệu, nội dung chương trình, ghi chú). Áp dụng migration thêm 7 cột mới vào bảng Meetings. Cập nhật Model, Repository (CreateAsync có transaction + quản lý participant), Controller với đầy đủ CRUD. Frontend: component MeetingModal 3 tab (Thông tin cơ bản / Nội dung họp / Danh sách tham dự), click sự kiện trên calendar để sửa.
- **Tệp thay đổi**:
  - `data_dump/migrate_meetings_v2.sql` (Mới - migration thêm 7 cột: Location, Presider, PreparingUnit, Content, Notes, OrganizingUnit, ExpectedAttendees)
  - `ToolCalendar.Core/Models/Meeting.cs` (Sửa đổi - thêm các trường mới + DTO CreateMeetingRequest)
  - `ToolCalendar.Core/Data/Repositories/MeetingRepository.cs` (Sửa đổi - full CRUD với transaction)
  - `ToolCalendar.Api/Controllers/Cabinet/MeetingsController.cs` (Sửa đổi - POST, PUT, DELETE, cancel)
  - `ToolCalendar.Api/ClientApp/src/cabinet/components/MeetingModal.jsx` (Mới - modal 3 tab tạo/sửa phiên họp)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetSchedule.jsx` (Sửa đổi - kết nối modal, click event)
- **Lệnh git commit**: `git commit -m "feat(cabinet/meetings): CRUD phiên họp - modal 3 tab, nội dung chi tiết, danh sách tham dự"`

### [2026-06-28 21:35] fix(core/ui): Khắc phục lỗi 500 phân quyền phòng họp, React crash màn hình trắng và UI chuông thông báo
- **Mô tả**: Sửa nhiều lỗi cản trở trải nghiệm người dùng: (1) Thêm policy `RequireAdminOrLanhDao` vào `AppPolicies.cs` để sửa lỗi 500 khi API phòng họp check quyền. (2) Sửa lỗi crash trắng trang khi tìm kiếm phòng họp có `departmentName = null`. (3) Xử lý logic đọc dữ liệu JSON bị lặp do Global Fetch Interceptor. (4) Bọc `<ErrorBoundary>` trong `main.jsx` để bảo vệ app khỏi crash trắng màn hình. (5) Sửa icon chuông bị ẩn (`size-0`) trên mobile ở `AppShell.jsx`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Policies/AppPolicies.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetRooms.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/main.jsx` (Sửa đổi - thêm ErrorBoundary)
  - `ToolCalendar.Api/ClientApp/src/shell/AppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(core/ui): sửa 500 auth rooms, chống crash trắng màn hình, sửa UI chuông"`

### [2026-07-04 10:36] feat(auth): Thêm tính năng ghi log IP đăng nhập ra file txt
- **Mô tả**: Bổ sung tính năng tự động trích xuất địa chỉ IP của client (thông qua `X-Forwarded-For` hoặc `RemoteIpAddress`) và ghi log vào file `login_ips.txt` kèm theo mốc thời gian và tên tài khoản mỗi khi có người dùng gọi API `/api/auth/login`. Tính năng được bọc trong khối `try-catch` để không làm gián đoạn luồng đăng nhập nếu gặp lỗi ghi file.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Controllers/AuthController.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(auth): thêm tính năng ghi log IP đăng nhập ra file txt"`

