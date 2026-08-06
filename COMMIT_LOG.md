### [2026-08-07 01:51] Fix lỗi "Cannot read properties of undefined (reading 'length')" khi mở văn bản
- **Mô tả**: Khi mở trang chi tiết văn bản, API trả về dữ liệu không đúng format (không phải array) trong một số trường hợp, khiến `users`, `comments`, `routings` bị set thành object thay vì array, dẫn đến crash khi gọi `.length`. Thêm `Array.isArray()` guard cho tất cả các hàm fetch trong `useDocDetail.js`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/hooks/useDocDetail.js` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(docs): guard Array.isArray cho users/comments/routings tránh lỗi .length undefined"`

### [2026-08-07 01:45] Tối ưu cấu hình OCR tiếng Việt
- **Mô tả**:
  - Tăng `RenderDpi` từ 300 → 400 (ảnh PDF render sắc nét hơn 33%, cải thiện nhận diện chữ nhỏ).
  - Bật `EnableOsd=true` (phát hiện và xoay đúng hướng văn bản bị nghiêng/lộn ngược).
  - Mở rộng từ điển `latin_dict.txt` từ 185 → ~270 ký tự, bổ sung toàn bộ bộ chữ tiếng Việt có dấu (ắ, ặ, ẳ, ẵ, ằ, ấ, ậ, ẩ, ẫ, ầ, ế, ệ, ể, ễ, ề, ố, ộ, ổ, ỗ, ồ, ớ, ợ, ở, ỡ, ờ, ứ, ự, ử, ữ, ừ,...) giúp recognition module nhận ra chính xác hơn.
- **Tệp thay đổi**:
  - `docker-compose.yml` (Sửa đổi — RenderDpi=400, EnableOsd=true)
  - `ToolCalendar.Core/Models/PaddleOCR/rec/latin_dict.txt` (Sửa đổi — mở rộng ký tự tiếng Việt)
- **Lệnh git commit**: `git commit -m "perf(ocr): tăng dpi 400 và mở rộng dict tiếng Việt để cải thiện nhận diện"`

### [2026-08-07 01:38] Cập nhật hạ tầng Nginx và quy tắc AI Agent
- **Mô tả**: 
  - Cấu hình Nginx proxy cho hệ thống Lịch công tác và Cabinet thông qua port 443 (phân giải theo tên miền).
  - Khắc phục lỗi hiển thị trang DocOverviewTab do `currentUser` bị null.
  - Cập nhật quy tắc AI Agent (`tc-rule-no-temporary-files.md`), bổ sung yêu cầu tự động dọn rác.
- **Tệp thay đổi**:
  - `nginx/conf.d/default.conf` (Sửa đổi)
  - `docker-compose.yml` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocOverviewTab.jsx` (Sửa đổi)
  - `.agents/AGENTS.md` (Sửa đổi)
  - `.agents/rules/tc-rule-no-temporary-files.md` (Mới)
- **Lệnh git commit**: `git commit -m "chore(infra): cấu hình nginx proxy và cập nhật rule dọn dẹp AI Agent"`

### [2026-08-05 22:50] Nâng cấp bảo mật Session lên chuẩn Enterprise (Refresh Token & Heartbeat)
- **Mô tả**:
  - Chuyển đổi từ Access Token 24h sang kiến trúc bảo mật chuẩn: Access Token 15 phút + Refresh Token 7 ngày.
  - Sửa đổi Database schema thủ công, thêm cột `RefreshToken` và `RefreshTokenExpiryTime` cho bảng `Users`. Cập nhật `UserRepository` và `UserModels` để làm việc với Refresh Token.
  - Cập nhật `/api/auth/login` cấp cả hai token. Thêm endpoint mới `/api/auth/refresh` để refresh JWT token.
  - Cập nhật Fetch Interceptor ở Frontend (`main.jsx`) để bắt lỗi `401 Unauthorized` và tự động thực hiện tiến trình "silent refresh", tự động replay lại request bị lỗi.
  - Bổ sung logic "Heartbeat" theo ngữ cảnh vào Frontend để chống văng (kicked out) cho người dùng trong Phân hệ Cabinet (Phòng họp không giấy tờ): tự động làm mới `lastActivity` khi người dùng ở trong `/phonghopkhonggiayto` và màn hình đang active (tránh 30 phút idle timeout).
- **Tệp thay đổi**:
  - `data_dump/documents.db` (Sửa đổi schema DB)
  - `ToolCalendar.Core/Models/UserModels.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Interfaces/IUserRepository.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/UserRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/AuthController.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/main.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/pages/Login.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(auth): nâng cấp chuẩn Enterprise với refresh token và cabinet heartbeat"`

### [2026-08-05 20:45] Tích hợp PWA và Realtime cho Công văn
- **Mô tả**:
  - Cấu hình PWA (Progressive Web App) sử dụng `vite-plugin-pwa` để hỗ trợ cài đặt ứng dụng vào điện thoại/desktop, đồng thời thêm thẻ meta `theme-color` và `apple-touch-icon`.
  - Tích hợp SignalR Realtime cho chức năng quản lý Công văn: `DocumentsController.cs` phát sự kiện `DocumentUpdated` khi Upload, BulkConfirm, BulkDeleteBatch, Create, Delete, Assign. `signalr.js` bắt sự kiện và phát tín hiệu cho DOM. `Documents.jsx` gọi lại `fetchDocuments()` để cập nhật trang ngay lập tức.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/vite.config.js` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/package.json` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/index.html` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/Documents/DocumentsController.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/lib/signalr.js` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(documents): thêm PWA và realtime cập nhật danh sách công văn"`

### [2026-08-05 20:39] Tích hợp SignalR Realtime cập nhật danh sách phiên họp
- **Mô tả**: Sử dụng SignalR để phát sự kiện `MeetingUpdated` khi Admin (hoặc người dùng khác) tạo, sửa, xóa hoặc hủy phiên họp ở `MeetingsController.cs`. Trên Frontend, thêm event listener vào `signalr.js` để phát sự kiện `realtime:meeting_updated` ra DOM, và `MeetingList.jsx` sẽ lắng nghe để gọi lại `fetchMeetings()` tự động mà không cần tải lại trang.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Controllers/Cabinet/MeetingsController.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/lib/signalr.js` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): realtime cập nhật danh sách phiên họp qua SignalR"`

### [2026-08-05 17:45] Cập nhật giao diện Nội dung họp (Bước 3)
- **Mô tả**: Bổ sung giao diện chức năng "Nội dung họp" ở Bước 3 của Wizard tạo phiên họp mới. Giao diện hỗ trợ thêm nhiều nội dung (tabs Nội dung 1, 2...), thông tin thời gian, người chuẩn bị/duyệt, tài liệu đính kèm (Upload zone), và bảng danh sách vấn đề cần biểu quyết.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetMeetingCreate.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): cập nhật giao diện nội dung họp bước 3"`

### [2026-08-05 17:59] Thay thế dữ liệu mẫu bằng dữ liệu thật từ bảng Users
- **Mô tả**: Xóa `mockTableData` ở Tab Nhóm thành viên trong Bước 2 tạo phiên họp, thay bằng danh sách `users` từ API và đơn giản hóa các cột hiển thị (Tên, Username, Vai trò).
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetMeetingCreate.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): tích hợp dữ liệu người dùng thật vào danh sách thành viên"`

### [2026-08-05 17:52] Cấu trúc lại mã nguồn theo hướng Modular Monolith
- **Mô tả**: Tách riêng thư mục của hai phân hệ Phòng họp (Cabinet) và Điều phối công văn (Documents) ở cả Backend (API) và Frontend (React) để dễ dàng quản lý code.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (Chuyển vào `Controllers/Documents/`)
  - `ToolCalendar.Api/Controllers/DocumentRoutingsController.cs` (Chuyển vào `Controllers/Documents/`)
  - Các tệp UI của điều phối công văn (Chuyển vào `ClientApp/src/documents/pages/`)
  - `ToolCalendar.Api/ClientApp/src/shell/AppShell.jsx` (Sửa lại đường dẫn import)
- **Lệnh git commit**: `git commit -m "refactor(api,docs): cấu trúc lại thư mục tách biệt phân hệ Cabinet và Documents"`

### [2026-08-05 17:41] Cập nhật giao diện Thành phần tham dự phiên họp
- **Mô tả**: Bổ sung giao diện chức năng "Thành phần tham dự" ở Bước 2 của Wizard tạo phiên họp mới. Giao diện bao gồm tabs đơn vị/cá nhân/nhóm/khách mời, bộ lọc tìm kiếm và bảng danh sách đại biểu.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetMeetingCreate.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): cập nhật giao diện chọn thành phần tham dự phiên họp"`

### [2026-08-05 17:35] Cập nhật giao diện Tạo Phiên Họp mới (Wizard) và Schema DB
- **Mô tả**: Bổ sung giao diện Wizard đa bước để tạo phiên họp mới dựa trên mockup. Thêm các trường dữ liệu `MeetingType`, `OnlineMeetingUrl`, `ProgramFilePaths`, `InvitationFilePaths` vào bảng `Meetings`. Cập nhật `MeetingsController` hỗ trợ upload file qua `[FromForm]`.
- **Tệp thay đổi**:
  - `.agents/rules/tc-rule-database-schema.md` (Sửa đổi)
  - `SYSTEM_FEATURES.md` (Sửa đổi)
  - `migrate_db_meetings.py` (Mới)
  - `ToolCalendar.Core/Models/Meeting.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/MeetingRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/Cabinet/MeetingsController.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetMeetingCreate.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): cập nhật giao diện tạo phiên họp mới dạng wizard và bổ sung trường db"`


- **Mô tả**: Tách biệt thư mục lưu trữ file của hệ thống Điều phối công văn và Phòng họp không giấy tờ thành 2 nhánh: `Uploads/Documents` và `Uploads/Cabinet`. Đã chạy script migration để di chuyển các file vật lý cũ và cập nhật đường dẫn tương ứng trong Database (`Documents`, `Comments`, `Questionnaires`, `MeetingNotes`).
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Services/DocumentUploadService.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/Cabinet/QuestionnairesController.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/Cabinet/MeetingNotesController.cs` (Sửa đổi)
  - `migrate_uploads.py` (Mới - script di chuyển file)
- **Lệnh git commit**: `git commit -m "refactor(api): tái cấu trúc thư mục lưu trữ uploads tách biệt 2 hệ thống"`

### [2026-08-05 16:55] Thêm tính năng Thêm mới Phiếu lấy ý kiến và Upload PDF
- **Mô tả**: Bổ sung tính năng tạo mới Phiếu lấy ý kiến thông qua giao diện đa bước (wizard). Cập nhật model và DB schema để hỗ trợ lưu file đính kèm (pdf, doc, v.v.), parse nội dung json và phân công chuyên viên. Backend lưu các file vào thư mục `/Uploads/questionnaires`.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Models/Questionnaire.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/QuestionnaireRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/Cabinet/QuestionnairesController.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetQuestionnaireCreate.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetQuestionnaire.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): thêm tính năng thêm mới phiếu lấy ý kiến và upload pdf"`

### [2026-08-05 16:35] Thêm tính năng Quản lý mẫu phiếu lấy ý kiến
- **Mô tả**: Bổ sung tính năng quản lý Mẫu phiếu lấy ý kiến không hard-code cho module Cabinet. Bao gồm việc tạo mới bảng `QuestionnaireTemplates`, viết các backend repo/controller tương ứng và tích hợp UI vào trang `CabinetQuestionnaire`.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/DatabaseService.cs` (Sửa đổi)
  - `ToolCalendar.Core/Models/QuestionnaireTemplate.cs` (Mới)
  - `ToolCalendar.Core/Data/Repositories/QuestionnaireTemplateRepository.cs` (Mới)
  - `ToolCalendar.Api/Controllers/Cabinet/QuestionnaireTemplatesController.cs` (Mới)
  - `ToolCalendar.Api/Program.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetQuestionnaireTemplates.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetQuestionnaire.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): thêm tính năng quản lý mẫu phiếu lấy ý kiến"`

### [2026-08-04 16:03] Thêm runtime packages cho linux x64 và resolve merge conflict
- **Mô tả**: Sửa merge conflict tại `DocumentsController.cs`. Cập nhật `docker-compose.yml` thêm network host và thêm package NuGet Sdcb cho Linux x64 để phục vụ OCR trên Docker. Định dạng lại `DocDetail.jsx`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/pages/DocDetail.jsx` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (Sửa đổi)
  - `ToolCalendar.Core/ToolCalendar.Core.csproj` (Sửa đổi)
  - `docker-compose.yml` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(ocr): thêm runtime packages cho linux x64 và resolve merge conflict"`

### [2026-07-26 17:35] Add Meeting Check-in Modal & Fix Meeting Visibility
- **Mô tả**: 
  1. Bổ sung modal Điểm danh (Check-in) khi người dùng bấm "Vào họp" ở `CabinetHome.jsx`.
  2. Sửa lỗi người tạo cuộc họp không thấy cuộc họp ở trang Quản lý bằng cách thay đổi câu SQL trong `GetByParticipantAsync` ở `MeetingRepository.cs`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetHome.jsx` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/MeetingRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): add check-in modal and fix creator meeting visibility"`

### [2026-08-04 16:25] Cập nhật giao diện nút quay lại hệ thống chính
- **Mô tả**: Thay đổi UI nút mũi tên quay lại thành nút có chứa text "Quay lại hệ thống chính" trong thanh điều hướng trên cùng của CabinetAppShell để người dùng dễ dàng nhận diện chức năng hơn (chỉ hiện text trên màn hình tablet/desktop).
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "style(cabinet): thêm text cho nút quay lại hệ thống chính trong header"`

### [2026-07-26 16:05] Fix fake notifications (99+) in iCPV Cabinet
- **Mô tả**: Thay thế mục thông báo bị hardcode (luôn hiển thị 99+ và dữ liệu giả về Phiếu lấy ý kiến) trong `CabinetAppShell.jsx` bằng dữ liệu thật. Tích hợp API `/api/notification` để lấy danh sách thông báo và số lượng chưa đọc thực tế, tương tự như `AppShell.jsx`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(ui): remove hardcoded notifications and fetch real data in cabinet"`

### [2026-07-25 16:51] Refactor loại bỏ Silent Compat và tối ưu hóa LOC
- **Mô tả**: Tối ưu hóa code backend theo luật AI Behavior mới:
  1. Loại bỏ logic dọn dẹp emoji của trạng thái công văn cũ (Silent Compat) để bắt buộc luồng dữ liệu chuẩn từ Frontend.
  2. Gom logic tải file từ các endpoints trong Controller về chung một hàm helper `ServePhysicalFileSecured`.
  3. Gọn gàng hóa `BulkDeleteAsync` trong Repository bằng vòng lặp mảng truy vấn.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "refactor(docs): tối ưu loc và loại bỏ silent compat cho status"`

### [2026-07-25 09:43] Bổ sung luật hành vi AI cấp độ Enterprise (Học từ OpenClaw)
- **Mô tả**: Dựa trên tư duy của dự án OpenClaw, hệ thống đã được nâng cấp "hiến pháp" AI Agent lên phiên bản 2.1. Đã bổ sung file luật mới quy định chặt chẽ về cách AI xử lý mã nguồn: yêu cầu phải kiểm tra hàm gọi (callers/callees) trước khi review (Evidence-based), tối ưu hóa dòng code (LOC ROI), tuyệt đối không viết code tương thích ngược kiểu chắp vá (No silent compat), và giao tiếp súc tích (Telegraph style).
- **Tệp thay đổi**:
  - `.agents/rules/tc-rule-ai-behavior.md` (Mới)
  - `.agents/AGENTS.md` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "docs(agents): bổ sung luật tc-rule-ai-behavior.md để nâng cao chất lượng ai agent"`

### [2026-07-25 09:23] Refactor giao dịch (transactions) sang đồng bộ để tránh lỗi khóa tệp SQLite
- **Mô tả**: Theo Best Practice của SQLite, giao dịch nên được thực thi một cách đồng bộ để tối ưu hiệu suất đọc/ghi đa luồng và tránh lỗi `SQLITE_BUSY`. Đã refactor các phương thức có sử dụng `BeginTransaction` bằng cách xóa các từ khóa `await` trong khối giao dịch và thay thế các phương thức bất đồng bộ (như `ExecuteNonQueryAsync`) thành đồng bộ (như `ExecuteNonQuery`). Các repo bị ảnh hưởng bao gồm: DocumentRepository, RoomRepository, MeetingProceedingRepository, MeetingRepository. Đã thêm ràng buộc này vào `tc-rule-backend-architecture.md`.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/RoomRepository.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/MeetingProceedingRepository.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/MeetingRepository.cs` (Sửa đổi)
  - `.agents/rules/tc-rule-backend-architecture.md` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "refactor(db): chuyển các lệnh thực thi giao dịch sang đồng bộ để tránh lỗi sqlite_busy"`

### [2026-07-22 17:16] Fix lỗi thiếu nút đóng màn hình xem PDF toàn màn hình trên Mobile
- **Mô tả**: Thêm trạng thái `isFullscreenPdf` cho màn hình `DocDetail.jsx`. Thay vì dùng `window.open` (không có nút quay lại rõ ràng trên một số trình duyệt di động), ứng dụng sẽ hiển thị một modal toàn màn hình có chứa thẻ `iframe` hiển thị PDF cùng với nút `X` để đóng, cải thiện trải nghiệm trên thiết bị di động (kích thước màn hình < 768px).
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/pages/DocDetail.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(ui): thêm modal xem pdf toàn màn hình có nút đóng cho mobile"`

### [2026-07-21 08:35] Fix lưu thiếu user tạo văn bản & cập nhật luồng gửi thông báo hoàn thành
- **Mô tả**: 
  - Sửa bug `DocumentRepository.InsertAsync` không gán `UploadedByUserId`, khiến toàn bộ văn bản mặc định do Admin tạo.
  - Sửa logic gửi thông báo khi "Hoàn thành văn bản": Từ nay không chỉ gửi cho người upload mà còn tự động gửi cho toàn bộ những cán bộ, văn thư đã từng xử lý/luân chuyển văn bản này (trừ người vừa bấm).
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(core): sửa lỗi lưu UploadedByUserId và cải tiến luồng thông báo hoàn thành văn bản"`

### [2026-07-21 08:24] Fix lỗi giao diện kẹt ở "Đang OCR" dù backend đã xử lý xong
- **Mô tả**: Giao diện `Upload.jsx` có cơ chế polling (hỏi server) mỗi 2 giây để cập nhật trạng thái OCR. Tuy nhiên giới hạn số lần hỏi chỉ là 20 lần (tương đương 40 giây). Với server ARM64, quá trình giải mã PDF và gọi Gemini tốn nhiều hơn 40s, dẫn đến frontend ngừng hỏi và kẹt vĩnh viễn ở trạng thái "Đang OCR" dù backend đã xử lý thành công. Đã tăng giới hạn lên 150 lần (5 phút) và sửa logic map trạng thái `Chưa xử lý` thành `ready` thay vì `processing`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/pages/Upload.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(ui): tăng thời gian chờ polling OCR lên 5 phút và sửa lỗi hiển thị trạng thái đang OCR"`


- **Mô tả**: Khi người dùng nhấn xóa văn bản (ID: 4820), hệ thống báo lỗi 500. Kiểm tra log Docker cho thấy lỗi `SQLite Error 19: FOREIGN KEY constraint failed`. Nguyên nhân là `DeleteAsync` trong `DocumentRepository.cs` mới chỉ xóa dữ liệu ở bảng `Comments` và `CommentReactions`, nhưng bỏ sót dữ liệu ở bảng `DocumentRoutings` (Luân chuyển) và `Notifications` (Thông báo). Đã thêm lệnh `DELETE FROM DocumentRoutings` và `DELETE FROM Notifications` trước khi xóa văn bản chính để giải quyết xung đột khóa ngoại. Đã áp dụng cho cả hàm `DeleteAsync` và `BulkDeleteAsync`.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi — dòng 661 và 727)
- **Lệnh git commit**: `git commit -m "fix(db): xử lý lỗi foreign key constraint khi xóa document do còn tồn đọng routing và notification"`

### [2026-07-21 08:02] Fix luân chuyển công văn không cập nhật Đơn vị chủ trì và Cán bộ xử lý
- **Mô tả**: Khi VanThu forward công văn cho cán bộ (hoặc cán bộ forward tiếp), endpoint `POST /api/documents/{id}/routings` chỉ tạo record trong bảng `DocumentRoutings` mà không cập nhật `Documents.AssignedTo` và `Documents.DepartmentId`. Do đó UI luôn hiển thị "CHƯA PHÂN CÔNG" dù đã luân chuyển. Đã thêm method `UpdateHandlerAsync` và gọi ngay sau khi tạo routing để cập nhật đúng cán bộ xử lý và đơn vị của họ.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Interfaces/IDocumentRepository.cs` (Sửa đổi — thêm `UpdateHandlerAsync`)
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi — implement `UpdateHandlerAsync`)
  - `ToolCalendar.Api/Controllers/DocumentRoutingsController.cs` (Sửa đổi — inject repos + gọi `UpdateHandlerAsync`)
- **Lệnh git commit**: `git commit -m "fix(routing): cập nhật AssignedTo và DepartmentId trên document khi tạo routing mới"`

### [2026-07-21 02:20] Fix query GetDocumentByIdAsync trả về FullText rỗng
- **Mô tả**: `GetDocumentByIdAsync` trong `DocumentRepository.cs` đang hardcode `'' AS FullText` và `'[]' AS OcrPagesJson` trong câu SELECT, khiến dù OCR lưu dữ liệu thành công vào DB thì mỗi lần đọc lên vẫn trả về rỗng. Đây là nguyên nhân gốc rễ khiến OCR DATA STREAM luôn hiển thị "HỆ THỐNG KHÔNG TÌM THẤY DỮ LIỆU OCR." Đã sửa thành `doc.FullText` và `doc.OcrPagesJson`.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi — dòng 340)
- **Lệnh git commit**: `git commit -m "fix(db): sửa GetDocumentByIdAsync trả về fullText rỗng do hardcode trong SQL SELECT"`

### [2026-07-21 02:14] Fix ARM64 native libs + thêm tính năng Xử lý lại OCR
- **Mô tả**: OCR liên tục báo "Không tìm thấy dữ liệu OCR" do `ToolCalendar.Core.csproj` khai báo package native `linux-x64` nhưng Docker container chạy trên Apple Silicon ARM64. Đã thay thế bằng các package ARM64 native chính thức từ `sdcb`. Đồng thời bổ sung endpoint `POST /api/documents/{id}/reprocess-ocr` và nút **"Xử lý lại OCR"** trong panel OCR để cho phép kích hoạt lại OCR cho tài liệu cũ mà không cần xóa và upload lại. Nút có logic tự polling và reload trang khi kết quả về.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/ToolCalendar.Core.csproj` (Sửa đổi — thay linux-x64 bằng linux-arm64)
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (Sửa đổi — thêm endpoint reprocess-ocr)
  - `ToolCalendar.Api/ClientApp/src/pages/DocDetail.jsx` (Sửa đổi — thêm nút Xử lý lại OCR)
  - `Dockerfile` (Sửa đổi — bỏ --platform để build native ARM64)
- **Lệnh git commit**: `git commit -m "fix(ocr): thay thư viện native linux-x64 bằng arm64 và thêm endpoint reprocess-ocr"`

### [2026-07-21 01:39] Thêm platform: linux/amd64 cho official-doc-backend
- **Mô tả**: Hệ thống sử dụng PaddleOCR và OpenCvSharp yêu cầu thư viện native `libOpenCvSharpExtern.so`. Tuy nhiên thư viện này chỉ có sẵn bản build cho x64, trong khi Docker trên máy Mac của Developer chạy kiến trúc ARM64 (Apple Silicon), gây ra lỗi `DllNotFoundException` và làm OCR sập hoàn toàn. Đã thêm `platform: linux/amd64` vào `docker-compose.yml` để ép Docker Desktop giả lập x86_64, giúp load được thư viện native thành công.
- **Tệp thay đổi**:
  - `docker-compose.yml` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(infra): ép docker backend chạy amd64 để sửa lỗi opencv trên mac arm64"`

### [2026-07-21 01:34] Cập nhật ParseTextAsync để sử dụng Regex lấy Thời hạn khi có Gemini
- **Mô tả**: Khi có API Key Gemini, hệ thống luôn ưu tiên parse bằng Gemini nhưng prompt của Gemini không yêu cầu lấy `ThoiHan`. Do đó `ThoiHan` luôn rỗng và không áp dụng các cấu hình từ khóa của hệ thống (trong DB). Đã sửa code để luôn gọi `ParseTextWithRegexAsync` để lấy `ThoiHan` và gán vào kết quả cuối cùng.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Services/OcrTextProcessingService.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(ocr): luôn trích xuất thời hạn bằng regex kể cả khi dùng gemini"`

### [2026-07-20 23:32] Cập nhật Regex OCR cho Số văn bản
- **Mô tả**: Bổ sung hỗ trợ ký tự `&` và `_` trong phần cơ quan ban hành (VD: SNN&MT) để tránh OCR nhận diện sai số hiệu công văn và kéo dài ký tự tối đa.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Services/OcrTextProcessingService.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(ocr): thêm hỗ trợ ký tự & và _ trong regex bắt số văn bản"`

### [2026-07-18 15:44] Refactor Rate Limiting for Global Application
- **Mô tả**: Tái cấu trúc cấu hình Rate Limiting trong Program.cs: dùng RateLimitPartition (theo IP/User) thay cho pool chung toàn server. Áp dụng policy fixed làm mặc định cho toàn bộ Controllers và SignalR Hub bằng .RequireRateLimiting("fixed") nhằm bảo vệ toàn hệ thống khỏi DoS.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Program.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "refactor(api): apply partitioned global rate limiting for all endpoints"`

### [2026-07-12 15:24] Fix Unit/Integration Test build errors
- **Mô tả**: Cập nhật lại các test case (`BusinessFlowTests`, `RuleExtractionTests`, `OcrAutomationTests`, `OcrStressTests`, `RealDocumentTests`, `OcrTextRegexTests`) để tương thích với các thay đổi DI gần đây: thêm tham số `IServiceScopeFactory` cho `OcrService` và `OcrTextProcessingService`, đồng thời thay thế các lệnh gọi tĩnh trên `DatabaseService` (đã bị xóa/di dời) bằng các Repository tương ứng thông qua DI (`IUserRepository`, `IAdminRepository`, `ISettingRepository`, `IAuditLogRepository`). Kế thừa `IntegrationTestBase` cho các class test cần sử dụng DI từ Host.
- **Tệp thay đổi**:
  - `ToolCalendar.Tests/IntegrationTestBase.cs` (Sửa đổi)
  - `ToolCalendar.Tests/BusinessFlowTests.cs` (Sửa đổi)
  - `ToolCalendar.Tests/RuleExtractionTests.cs` (Sửa đổi)
  - `ToolCalendar.Tests/OcrTextRegexTests.cs` (Sửa đổi)
  - `ToolCalendar.Tests/OcrStressTests.cs` (Sửa đổi)
  - `ToolCalendar.Tests/OcrAutomationTests.cs` (Sửa đổi)
  - `ToolCalendar.Tests/RealDocumentTests.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(tests): resolve missing DI dependencies and update deprecated DatabaseService calls"`

### [2026-07-12 15:15] Fix build error Label and related issues
- **Mô tả**: Sửa lỗi build "The type or namespace name 'Label' could not be found" do AdminRepository/Controller dùng sai kiểu `Label` thay vì `DocumentLabel`. Đồng thời sửa lỗi thiếu hàm đồng bộ trên IUserRepository, thêm thiếu using DependencyInjection, và sửa lỗi syntax do thiếu đóng ngoặc nhọn ở AuthController.cs.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Interfaces/IAdminRepository.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/AdminRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/AdminController.cs` (Sửa đổi)
  - `ToolCalendar.Core/Services/NotificationManager.cs` (Sửa đổi)
  - `ToolCalendar.Core/Services/OcrTextProcessingService.cs` (Sửa đổi)
  - `ToolCalendar.Core/Services/OcrService.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/AuthController.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(core,api): resolve build errors related to DocumentLabel, missing using and unclosed bracket"`

### [2026-07-09 16:24] Kết nối backend thực cho toàn bộ phân hệ Phòng họp không giấy tờ — Loại bỏ mọi hardcode
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/DatabaseService.cs` (Sửa đổi — thêm migration 8 cột Meetings + 4 bảng mới)
  - `ToolCalendar.Core/Models/MeetingProceeding.cs` (Mới)
  - `ToolCalendar.Core/Models/MeetingConclusion.cs` (Mới)
  - `ToolCalendar.Core/Models/MeetingNote.cs` (Mới)
  - `ToolCalendar.Core/Data/Repositories/MeetingProceedingRepository.cs` (Mới)
  - `ToolCalendar.Core/Data/Repositories/MeetingConclusionRepository.cs` (Mới)
  - `ToolCalendar.Core/Data/Repositories/MeetingNoteRepository.cs` (Mới)
  - `ToolCalendar.Core/Data/Repositories/MeetingRepository.cs` (Sửa đổi — thêm `GetByParticipantAsync`, `UpdateAttendanceAsync`)
  - `ToolCalendar.Api/Controllers/Cabinet/MeetingsController.cs` (Sửa đổi — fix dashboard stats thực, thêm `/my-meetings`, thêm `PUT /{id}/attendance`)
  - `ToolCalendar.Api/Controllers/Cabinet/MeetingProceedingsController.cs` (Mới)
  - `ToolCalendar.Api/Controllers/Cabinet/MeetingConclusionsController.cs` (Mới)
  - `ToolCalendar.Api/Controllers/Cabinet/MeetingNotesController.cs` (Mới)
  - `ToolCalendar.Api/Program.cs` (Sửa đổi — đăng ký 3 repo mới vào DI)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx` (Sửa đổi — fetch `/my-meetings`, xóa hardcode tên chủ trì và trạng thái giả)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetHome.jsx` (Sửa đổi — xóa fallback hardcode stats)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetProceedings.jsx` (Sửa đổi — rewrite toàn bộ, fetch từ API)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetConclusions.jsx` (Sửa đổi — rewrite toàn bộ, fetch từ API, phân trang, search)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetNotebook.jsx` (Sửa đổi — rewrite toàn bộ, fetch từ API, upload file, delete)
  - `SYSTEM_FEATURES.md` (Sửa đổi — bổ sung toàn bộ tài liệu phân hệ Cabinet)
- **Lệnh git commit**: `git commit -m "feat(cabinet): backend data-driven đầy đủ cho Kỷ yếu, Kết luận, Sổ tay — loại bỏ mọi hardcode"`

### [2026-07-09 15:53] Triển khai giao diện Kỷ yếu, Kết luận và Sổ tay
- **Mô tả**: Thiết kế và tích hợp 3 màn hình mới vào phân hệ Phòng họp không giấy tờ: Kỷ yếu phiên họp (`CabinetProceedings`), Tra cứu kết luận sau phiên họp (`CabinetConclusions`), và Quản lý sổ tay (`CabinetNotebook`). Các giao diện được triển khai bằng TailwindCSS và shadcn/ui dựa trên mockup, bao gồm layout chi tiết, empty states, modals "Thêm mới kỷ yếu" và "Thêm mới ghi chú" (hỗ trợ kéo thả tài liệu). Đã cấu hình tab router trong `CabinetMeetings` để điều hướng đến các màn hình này.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetProceedings.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetConclusions.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetNotebook.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetMeetings.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): triển khai UI màn hình Kỷ yếu, Kết luận, Sổ tay"`

### [2026-07-09 11:36] Thêm Tooltip và Dropdown Menu cho nút thao tác trong danh sách phiên họp
- **Mô tả**: Bổ sung tooltip "Thao tác khác" khi hover vào nút 3 chấm trong bảng Danh sách phiên họp. Khi click vào sẽ hiển thị ra 2 tuỳ chọn: "Xác nhận tham gia" và "Thêm tài liệu vào thư viện" như yêu cầu thiết kế.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): thêm dropdown thao tác khác cho danh sách phiên họp"`

### [2026-07-09 11:29] Sửa lỗi không hiển thị Lịch họp cá nhân & Cấu trúc lại layout chính
- **Mô tả**: Khi chuyển thẻ `main` thành `overflow-y-auto` ở commit trước, các trang yêu cầu chiều cao tuyệt đối (như Lịch họp cá nhân sử dụng FullCalendar) bị vỡ layout (height = 0). Đã cập nhật lại `main` thành một Flexbox Container (`flex flex-col overflow-hidden`), đồng thời uỷ quyền việc quản lý scroll (`overflow-auto`) cho từng trang con cụ thể (Dashboard tự cuộn, Lịch họp tự giãn hết màn hình).
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetSchedule.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(cabinet): sửa lỗi mất lịch họp cá nhân do vỡ layout flex"`

### [2026-07-09 11:27] Sửa lỗi không cuộn được trang chủ
- **Mô tả**: Thay đổi CSS class của thẻ `main` trong `CabinetAppShell.jsx` từ `overflow-hidden` thành `overflow-y-auto` để cho phép người dùng cuộn xem toàn bộ nội dung của trang chủ (Dashboard) và các trang con khi nội dung bị tràn quá màn hình.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(cabinet): sửa lỗi không thể cuộn trang trên dashboard"`

### [2026-07-08 17:35] Cập nhật layout Modal Giao diện & Phiên bản khớp với thiết kế
- **Mô tả**: Sửa layout của modal Giao diện để phần mô tả và các lựa chọn màu sắc nằm trên các hàng riêng biệt, có vạch ngăn cách màu xanh nhạt. Cập nhật ngày phiên bản từ cứng "09.09.2024" sang "09.07.2026" (ngày mai) theo đúng nghiệp vụ yêu cầu, đồng thời điều chỉnh badge Fixed thành màu tím và cập nhật kích thước header.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(cabinet): điều chỉnh layout và dữ liệu hiển thị modal giao diện, phiên bản"`

### [2026-07-08 17:33] Thiết kế lại Dashboard (CabinetHome) theo giao diện mới
- **Mô tả**: Tái cấu trúc lại trang chủ (Dashboard) để khớp với giao diện yêu cầu. Cột bên trái bổ sung thêm các widget "Phiên họp cần chuẩn bị tài liệu", "Tổng số phiếu lấy ý kiến". Cột bên phải bổ sung danh sách "Phiên họp chưa xác nhận", "Phiếu lấy ý kiến chưa trả lời". Xây dựng DatePicker Popover cho chức năng chọn tháng/năm ở widget Thống kê với tính năng hiển thị năm và lưới tháng. Cập nhật thiết kế doughnut chart và empty state (Không có dữ liệu).
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetHome.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/package.json` (Cài đặt thêm package `date-fns` nếu cần)
- **Lệnh git commit**: `git commit -m "feat(cabinet): thiết kế lại dashboard theo template mới, thêm datepicker popup và thống kê"`

### [2026-07-08 17:28] Tích hợp Menu Tài khoản và Modal "Giao diện", "Phiên bản"
- **Mô tả**: Phát triển tính năng Dropdown cho thông tin Tài khoản ở góc phải thanh Header. Menu chứa các tuỳ chọn: Hồ sơ cá nhân, Giao diện, Phiên bản và Đăng xuất. Bỏ mục "Tài liệu sử dụng" theo yêu cầu của user. Phát triển hai modal sử dụng component `Dialog`: (1) Modal thay đổi màu sắc giao diện với 3 tuỳ chọn màu sắc; (2) Modal thông tin Phiên bản (1.0 - 09.09.2024) kèm badge Fixed và nội dung. Đăng xuất được cấu hình để xóa token.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): thiết kế dropdown tài khoản và modal đổi giao diện, phiên bản"`

### [2026-07-08 17:25] Cập nhật giao diện Thông báo (Notification Popover) trên Header
- **Mô tả**: Tích hợp component `Popover` của Shadcn UI vào icon cái chuông trên thanh Header. Khi click vào sẽ hiển thị danh sách các thông báo dưới dạng một menu dropdown có thiết kế bo góc, shadow và hover state sắc nét. Bổ sung thêm badge "99+" màu đỏ cạnh biểu tượng chuông.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): bổ sung popover danh sách thông báo và badge 99+ ở header"`

### [2026-07-08 17:21] Thiết kế tính năng Sổ tay (Notebook Modal) trong Chi tiết phiên họp
- **Mô tả**: Bổ sung nút "Sổ tay" dính lề phải (floating button) tại màn hình Thông tin phiên họp. Khi click sẽ mở ra Modal "Sổ tay" chứa các thông tin tóm tắt của phiên họp, danh sách ghi chú, textarea để nhập ghi chú mới và khu vực upload tài liệu đính kèm (hỗ trợ kéo thả). Giao diện Modal sử dụng `Dialog` component từ Shadcn UI, bám sát hoàn toàn với thiết kế UX/UI.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingDetail.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): bổ sung modal sổ tay vào màn hình chi tiết phiên họp"`

### [2026-07-08 17:16] Thiết kế giao diện chi tiết Thông tin phiên họp
- **Mô tả**: Xây dựng component `MeetingDetail.jsx` để hiển thị chi tiết Thông tin phiên họp khi click vào icon "Con mắt" ở bảng danh sách. Giao diện được thiết kế gồm các Accordion có thể đóng mở: Thông tin chi tiết, Nội dung họp (kèm danh sách tài liệu tải xuống), Danh sách biểu quyết, Đăng ký phát biểu, Tham gia góp ý. Tích hợp empty state illustration khi không có dữ liệu. Do backend chưa cung cấp đủ các trường, component hiện đang sử dụng mock data để khớp UI 100% với bản thiết kế.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingDetail.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): thêm màn hình chi tiết thông tin phiên họp và các accordion"`

### [2026-07-08 17:11] Cải thiện UI: Chuyển nút Về hệ thống chính lên header
- **Mô tả**: Xóa nút "Về hệ thống chính" khỏi header với text cũ gây tốn diện tích, thay bằng icon ArrowLeft tinh gọn, luôn hiển thị và có tooltip "Về Hệ thống chính". Điều này giúp người dùng dễ dàng chuyển về hệ thống chính từ trang chủ mà không bị ẩn trong sidebar.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "style(cabinet): chuyển nút về hệ thống chính thành icon trên header"`

### [2026-07-08 17:02] Thiết kế giao diện Quản lý Danh sách phiên họp
- **Mô tả**: Bổ sung tab "Quản lý họp" vào menu chính. Xây dựng trang "Danh sách phiên họp" với đầy đủ 2 tab nhỏ (Cá nhân được mời / Cần chuẩn bị tài liệu), thẻ thống kê trạng thái tham gia (xanh, cam, đỏ), bảng dữ liệu có phân trang, tính năng popover để mở bộ lọc nâng cao và bộ lọc thời gian. Giao diện được clone chính xác theo thiết kế với các thành phần từ thư viện Lucide, Tailwind và Shadcn (Select, Popover).
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetMeetings.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx` (Mới)
- **Lệnh git commit**: `git commit -m "feat(cabinet): thiết kế màn hình quản lý danh sách phiên họp"`

### [2026-07-08 16:57] Thiết kế lại giao diện Lịch họp đơn vị theo thiết kế Calendar Grid tùy chỉnh
- **Mô tả**: Tạo trang hiển thị riêng cho tab "Lịch họp đơn vị" sử dụng FullCalendar nhưng với cấu hình giao diện đặc biệt (dạng block theo cột thứ trong tuần, tô màu đỏ nhạt cột hôm nay, ẩn các mốc thời gian giờ) sát với bản thiết kế. Bổ sung các view Tuần, Tháng, Năm. Cài đặt thêm plugin `@fullcalendar/multimonth` để hỗ trợ chế độ xem Năm.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/package.json` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetUnitSchedule.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetSchedule.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): thiết kế lưới lịch tùy chỉnh cho tab lịch họp đơn vị"`

### [2026-07-08 16:53] Thiết kế lại giao diện Lịch họp lãnh đạo theo thiết kế dạng danh sách Accordion
- **Mô tả**: Thay thế component FullCalendar ở tab "Lịch họp lãnh đạo" bằng một giao diện danh sách tuần hoàn toàn mới, hỗ trợ nhóm các cuộc họp theo ngày bằng Accordion (đóng/mở), bổ sung chức năng tìm kiếm, chuyển tuần, filter theo đúng thiết kế được yêu cầu. Giao diện thay thế component ConfirmationModal đẹp mắt cho thao tác xóa thay vì dùng window.confirm mặc định.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/components/MeetingModal.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetLeaderSchedule.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetSchedule.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): thiết kế giao diện danh sách Accordion cho lịch họp lãnh đạo và nâng cấp modal xác nhận xóa"`

### [2026-07-08 15:41] Thêm 3 AI Skills vào .agents/skills/ để tối ưu cấu trúc cho AI Agent
- **Mô tả**: Học từ cấu trúc dự án OpenClaw (enterprise-grade AI-native platform), điền vào thư mục `.agents/skills/` vốn đang trống. Thêm 3 skill chuyên biệt: (1) `tc-skill-code-review.md` — checklist tự review code cho Backend/Frontend trước mỗi commit; (2) `tc-skill-db-migration.md` — quy trình thay đổi SQLite schema an toàn không dùng EF Migration; (3) `tc-skill-api-testing.md` — hướng dẫn test API bằng curl và viết C# unit test.
- **Tệp thay đổi**:
  - `.agents/skills/tc-skill-code-review.md` (Mới)
  - `.agents/skills/tc-skill-db-migration.md` (Mới)
  - `.agents/skills/tc-skill-api-testing.md` (Mới)
  - `COMMIT_LOG.md` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "docs(agents): thêm 3 AI skills chuyên biệt vào .agents/skills/"`

### [2026-07-08 15:22] Xóa toàn bộ văn bản và xuất file CSDL mới
- **Mô tả**: Xóa sạch toàn bộ dữ liệu mẫu về văn bản (bảng Documents, Comments, DocumentRoutings, Notifications, v.v.) trong CSDL để chuẩn bị cho dữ liệu mới, sau đó xuất lại file seed_db.sql.
- **Tệp thay đổi**:
  - seed_db.sql (Sửa đổi)
- **Lệnh git commit**: git commit -m "chore(db): clear document data and export new seed_db.sql"

# Nhật ký Thay đổi Mã Nguồn (Commit Log)

Tệp này lưu trữ lịch sử các thay đổi và tính năng mới được thêm vào hệ thống để AI có thể nhanh chóng nắm bắt ngữ cảnh mà không cần quét lại toàn bộ mã nguồn.

## Lịch sử

### [2026-07-12 22:03] Sửa định dạng mã nguồn (format) trong AppShell.jsx
- **Mô tả**: Chạy prettier và định dạng lại (fix indentation) code trong `AppShell.jsx` để chuẩn hóa code style theo cấu hình của dự án.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/shell/AppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "style: định dạng mã nguồn AppShell.jsx"`

### [2026-07-08 09:40] Thêm chức năng Xóa phiên họp trong popup chỉnh sửa
- **Mô tả**: Thêm nút Xóa (Delete) vào MeetingModal khi chỉnh sửa sự kiện đã có. Gọi API DELETE và làm mới danh sách cuộc họp khi xóa thành công.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/components/MeetingModal.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(ui): add delete button and functionality to meeting edit modal"`


### [2026-07-08 01:30] Cập nhật và xuất dữ liệu DB mới nhất
- **Mô tả**: Xóa các file .sql cũ (fix_data, recover, migrate_meetings_v2, schema) theo yêu cầu và xuất dữ liệu DB mới nhất (documents.db) ra file seed_db.sql để cập nhật dữ liệu trên source code.
- **Tệp thay đổi**:
  - `seed_db.sql` (Sửa đổi)
  - `fix_data.sql` (Xóa)
  - `data_dump/migrate_meetings_v2.sql` (Xóa)
  - `data_dump/recover.sql` (Xóa)
  - `data_dump/schema.sql` (Xóa)
- **Lệnh git commit**: `git commit -m "chore(db): export latest database to seed_db.sql and remove obsolete sql scripts"`


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

### [2026-07-07 09:45] Sửa lỗi menu thao tác phòng họp bị che khuất
- **Mô tả**: Bỏ menu dropdown 3 chấm (ActionMenu) ở màn hình Quản lý phòng họp do bị cắt khuất bởi thuộc tính `overflow-x-auto` của table. Thay thế bằng các nút bấm inline (Sửa, Xóa) hiển thị trực tiếp trên dòng, giúp người dùng dễ dàng thao tác mà không bị lỗi hiển thị.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetRooms.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(cabinet-rooms): replace action menu with inline buttons to prevent overflow clipping"`

### [2026-07-07 10:02] Thêm chức năng xem chi tiết phòng họp (chỉ đọc)
- **Mô tả**: Nút "Xem chi tiết" (hình con mắt) trước đây không có sự kiện click. Đã bổ sung `mode='view'` vào component `RoomModal` để cho phép tái sử dụng form này làm màn hình xem thông tin chi tiết với các trường dữ liệu bị vô hiệu hóa (disabled) và ẩn nút lưu. Gắn sự kiện `onClick` cho nút con mắt.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetRooms.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet-rooms): implement view mode for room details modal"`

### [2026-07-07 10:48] Sửa lỗi hiển thị viền thừa ở bảng lịch họp
- **Mô tả**: Giao diện Lịch họp có một khoảng trống/viền thừa màu xám ở lề phải và dưới do container bọc FullCalendar bị set class `p-2` (padding) cộng thêm border mặc định của FullCalendar. Đã loại bỏ class `p-2` và thêm style ẩn viền `.fc-scrollgrid` để bảng lịch hiển thị full không gian một cách liền mạch.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetSchedule.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "style(cabinet-schedule): remove extra padding and borders from calendar grid"`

### [2026-07-07 11:11] Thêm thanh tìm kiếm người tham dự vào form tạo phiên họp
- **Mô tả**: Bổ sung ô input để tìm kiếm người tham dự (theo tên, username, tên phòng ban) giúp người dùng dễ dàng chọn thành viên khi danh sách quá dài. Đồng thời sửa URL API từ `/api/admin/users` sang `/api/users` để lấy được dữ liệu. Bổ sung sửa lỗi múi giờ khi chọn ngày trên trình duyệt, không convert sang UTC để tránh lệch khung giờ ở thư viện Lịch.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/components/MeetingModal.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet-meetings): add search input for participants list and fix users api endpoint"`

### [2026-07-07 11:15] Thêm tính năng lưu khách mời ngoài cơ quan cho phiên họp
- **Mô tả**: Phiên họp ngoài cán bộ trong hệ thống thì thường có thêm các khách mời ngoài cơ quan (như Công an, Quân sự...). Đã cập nhật database schema thêm cột `ExternalParticipants`, cập nhật Model/Repository và giao diện `MeetingModal.jsx` thêm 1 ô nhập text (textarea) để người dùng có thể nhập tự do danh sách khách mời ngoài.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Models/Meeting.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/MeetingRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/components/MeetingModal.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet-meetings): add external participants text field to meetings"`

### [2026-07-07 14:07] Sửa lỗi mở modal chỉnh sửa phiên họp không hiển thị danh sách tham dự đã lưu
- **Mô tả**: Khi gọi API lấy lịch (`/schedule`), backend không trả về `Participants` để tránh N+1 queries. Do đó khi click vào calendar event để mở `MeetingModal`, danh sách thành viên bị trống. Đã cập nhật sự kiện `eventClick` ở `CabinetSchedule.jsx` để fetch thông tin đầy đủ của meeting (qua `GET /{id}`) trước khi mở modal, đảm bảo state hiển thị chính xác các thành viên đã được chọn.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetSchedule.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(cabinet-schedule): fetch full meeting details on eventClick to properly load participant list"`
### [2026-07-04 10:36] feat(auth): Thêm tính năng ghi log IP đăng nhập ra file txt
- **Mô tả**: Bổ sung tính năng tự động trích xuất địa chỉ IP của client (thông qua `X-Forwarded-For` hoặc `RemoteIpAddress`) và ghi log vào file `login_ips.txt` kèm theo mốc thời gian và tên tài khoản mỗi khi có người dùng gọi API `/api/auth/login`. Tính năng được bọc trong khối `try-catch` để không làm gián đoạn luồng đăng nhập nếu gặp lỗi ghi file.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Controllers/AuthController.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(auth): thêm tính năng ghi log IP đăng nhập ra file txt"`

### [2026-07-05 13:42] fix(meeting): Thêm try-catch-rollback cho tất cả transaction trong MeetingRepository
- **Mô tả**: Phát hiện 3 hàm `CreateAsync`, `UpdateAsync`, `DeleteAsync` trong `MeetingRepository` có dùng Transaction nhưng thiếu khối `try-catch` và `tx.Rollback()`. Trong tình huống mất kết nối giữa chừng hoặc xảy ra lỗi DB, transaction sẽ không được hoàn tác đúng cách dẫn đến dữ liệu bị không nhất quán (ví dụ: xóa MeetingParticipants thành công nhưng không xóa được Meetings). Đã bọc toàn bộ logic trong khối `try { ... tx.Commit(); } catch { tx.Rollback(); throw; }` để đảm bảo tính Atomicity.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/MeetingRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(meeting): thêm try-catch-rollback cho transaction trong MeetingRepository"`

### [2026-07-05 13:47] fix(document): Sửa 3 lỗi trong ToggleReactionAsync — thêm transaction, try-catch, đổi sang async
- **Mô tả**: Phát hiện 3 lỗi trong hàm `ToggleReactionAsync` của `DocumentRepository`: (1) Thiếu `try-catch` xử lý lỗi DB. (2) `checkCmd.ExecuteScalar()` được gọi đồng bộ (blocking) trong một async function — phải dùng `await ExecuteScalarAsync()`. (3) Không có transaction bao bọc cặp Check+Write, dẫn đến nguy cơ Race Condition (2 request check cùng lúc cho cùng 1 user). Đã sửa bằng cách thêm `BeginTransaction()`, bọc toàn bộ trong `try { tx.Commit() } catch { tx.Rollback(); throw; }`.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(document): sửa transaction, async và try-catch trong ToggleReactionAsync"`

### [2026-07-05 13:51] fix(document): Sửa 3 lỗi trong DocumentRepository — blocking async, BulkDelete thiếu transaction, GetPaged thiếu try-catch
- **Mô tả**: Quét toàn bộ các Repository và phát hiện 3 lỗi trong `DocumentRepository`: (1) `GetPagedAsync` gọi `countCmd.ExecuteScalar()` đồng bộ (blocking) trong async method — sửa thành `await ExecuteScalarAsync()`, bọc trong try-catch. (2) `InsertAsync` gọi `cmd.ExecuteScalar()` đồng bộ — sửa thành `await ExecuteScalarAsync()`. (3) `BulkDeleteAsync` thực hiện 3 câu DELETE trong 1 string SQL nhưng không có transaction riêng biệt — nếu xóa bị gián đoạn giữa chừng (mất điện, lỗi DB), dữ liệu sẽ bị không nhất quán. Đã tách thành 3 lệnh riêng gắn vào cùng 1 transaction với try-catch-rollback.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(document): sửa blocking async, thêm transaction cho BulkDelete và try-catch cho GetPaged"`

### [2026-07-05 14:02] refactor(document): Xóa try-catch vô nghĩa (anti-pattern) trong GetPagedAsync
- **Mô tả**: Phát hiện `catch { throw; }` trong `GetPagedAsync` là anti-pattern — bắt exception nhưng không xử lý gì, chỉ ném lại y chang. Hàm này không có transaction nên không cần rollback, tài nguyên đã được `using var` quản lý tự động. Đã xóa khối `try-catch` thừa để code sạch hơn và dễ đọc hơn.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "refactor(document): xóa try-catch vô nghĩa trong GetPagedAsync — catch chỉ throw lại không xử lý gì"`

### [2026-07-05 14:12] perf(questionnaire): Xóa `SELECT *` trong QuestionnaireRepository
- **Mô tả**: Phát hiện hàm `GetAllAsync` dùng `SELECT q.*`, gây lãng phí bộ nhớ và ảnh hưởng tới hiệu năng khi dữ liệu lớn, cũng như tiềm ẩn lỗi mapping nếu cấu trúc bảng bị thay đổi. Đã sửa thành liệt kê rõ các cột cần thiết (`q.Id`, `q.MeetingId`, `q.Title`, `q.AssignedTo`, `q.Deadline`, `q.Status`, `q.CreatedAt`) để tối ưu và an toàn.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/QuestionnaireRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "perf(questionnaire): xóa SELECT * và liệt kê rõ cột trong GetAllAsync"`

### [2026-07-05 14:13] perf(room): Loại bỏ `SELECT *` trong RoomRepository
- **Mô tả**: Tương tự như `QuestionnaireRepository`, phát hiện hàm `GetAllAsync` và `GetByIdAsync` trong `RoomRepository` sử dụng câu truy vấn `SELECT r.*`. Đã sửa thành chỉ định rõ các cột cần thiết (`r.Id`, `r.Name`, `r.DepartmentId`, `r.Status`, `r.CreatedAt`) để tối ưu hiệu năng, giảm RAM server và bảo vệ code khỏi lỗi nếu schema thay đổi.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/RoomRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "perf(room): xóa SELECT * và liệt kê rõ cột trong GetAllAsync và GetByIdAsync"`

### [2026-07-05 14:14] fix(room): Bổ sung Transaction chống race condition khi xóa phòng họp
- **Mô tả**: Hàm `DeleteAsync` trong `RoomRepository` thực hiện hai thao tác là kiểm tra (SELECT) xem phòng có đang được lên lịch không, sau đó mới xóa (DELETE). Để tránh tình trạng có người đặt lịch đúng vào khoảnh khắc giữa hai lệnh này (Race Condition), đã bổ sung `BeginTransaction` cùng block `try-catch-rollback` (đúng chuẩn).
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/RoomRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(room): thêm transaction cho DeleteAsync để chống race condition"`

### [2026-07-05 14:16] perf(all): Quét và loại bỏ toàn bộ `SELECT *` trong các Repositories
- **Mô tả**: Đã quét toàn bộ mã nguồn tầng Data Access (Repositories) để tìm các câu lệnh chứa `SELECT *`, `SELECT m.*`, `SELECT mp.*`, `SELECT doc.*`. Đã thay thế thành việc liệt kê cụ thể các cột tương ứng với schema hiện tại ở:
  - `MeetingRepository` (`BASE_SELECT` và `GetParticipantsByMeetingIdAsync`).
  - `DocumentRepository` (`GetDocumentByIdAsync`).
  Việc này giúp bảo vệ ứng dụng khỏi lỗi OOM, tối ưu memory footprint và tránh crash khi CSDL thay đổi schema.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/MeetingRepository.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "perf(all): loại bỏ triệt để SELECT * trong toàn bộ Repositories"`

### [2026-07-07 14:55] fix(meeting): S?a l?i crash API khi load danh s�ch l?ch h?p
- **M� t?**: B? sung m.ExternalParticipants v�o c�u truy v?n BASE_SELECT trong MeetingRepository.cs. Tru?c d� do lo?i b? SELECT * nhung s�t c?t n�y khi?n SqliteDataReader quang exception IndexOutOfRangeException d?n d?n trang L?ch h?p b? crash kh�ng hi?n th? d? li?u.
- **T?p thay d?i**:
  - ToolCalendar.Core/Data/Repositories/MeetingRepository.cs (S?a d?i)
- **L?nh git commit**: git commit -m "fix(meeting): add missing ExternalParticipants column to BASE_SELECT"


### [2026-07-07 15:37] fix(ui): Sửa lỗi hiển thị mờ nhạt phần text sự kiện trong view tháng
- **Mô tả**: Gắn `eventDisplay="block"` và `backgroundColor` cho box sự kiện `eventContent` ở `CabinetSchedule.jsx`. Giúp FullCalendar áp dụng đúng màu và kích thước box sự kiện khi chuyển sang view tháng, giữ cho nền không bị trong suốt.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetSchedule.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(ui): sửa lỗi hiển thị mờ nhạt phần text sự kiện trong view tháng"`

### [2026-07-07 16:00] fix(ui): add Tham gia button and handle 401 globally
- **M� t?**: B? sung n�t 'V�o h?p' cho c�c phi�n h?p dang di?n ra t?i Dashboard. �?ng th?i, th�m x? l� m� l?i 401 Unauthorized t?i Global Fetch Interceptor (main.jsx) d? t? d?ng dang xu?t ngu?i d�ng n?u SecurityStamp kh�ng kh?p. L?i n�y khi?n API tr? v? d? li?u r?ng v� Dashboard hi?n th? 0 cu?c h?p, 0 danh s�ch tham d?.
- **T?p thay d?i**:
  - `ToolCalendar.Api/ClientApp/src/main.jsx` (S?a d?i)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetHome.jsx` (S?a d?i)
- **L?nh git commit**: `git commit -m "fix(ui): add Tham gia button and handle 401 globally"`




### [2026-07-09 14:57] Thêm màn hình Diễn biến phiên họp
- **Mô tả**: Thêm component mới `MeetingProgress` cho màn hình Diễn biến phiên họp và xử lý sự kiện click nút "Xem diễn biến" từ màn hình Thông tin phiên họp để chuyển hướng trang.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingProgress.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingDetail.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): thêm màn hình diễn biến phiên họp và xử lý chuyển trang từ thông tin phiên họp"`

### [2026-07-11 09:21] Refactor DatabaseService to Repository Pattern
- **Mô tả**: Hoàn tất quá trình refactor hệ thống sang sử dụng Repository Pattern. Chuyển tất cả các phương thức truy xuất database tĩnh từ `DatabaseService` vào các Repositories tương ứng (`ISettingRepository`, `IAdminRepository`, `IUserRepository`, `INotificationRepository`, `IAuditLogRepository`, `IStatsRepository`). Tiêm các repositories này vào Controllers và Services (`DocumentsController`, `OcrTextProcessingService`) thông qua Dependency Injection. Dọn dẹp hoàn toàn `DatabaseService.cs` chỉ còn lại phương thức `Initialize()`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (Sửa đổi)
  - `ToolCalendar.Core/Services/OcrTextProcessingService.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/DatabaseService.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "refactor(data): remove static methods from DatabaseService and finish injecting repositories"`

### [2026-07-13 04:10] Fix bug API v Unit Test Cabinet
- **M t?**: B? sung b?ng MeetingConclusions, MeetingNotes vo seed_db.sql d? trnh l?i DB. Fix cc test lin quan d?n Cabinet b? thi?u thu?c tnh, sai d?nh d?ng response v b? test call API /api/auth/me khng t?n t?i.
- **T?p thay d?i**:
  - \seed_db.sql\ (S?a d?i)
  - \ToolCalendar.Tests/IntegrationTestBase.cs\ (S?a d?i)
  - \ToolCalendar.Tests/Cabinet/CabinetConclusionsTests.cs\ (S?a d?i)
  - \ToolCalendar.Tests/Cabinet/CabinetMeetingsTests.cs\ (S?a d?i)
  - \ToolCalendar.Tests/Cabinet/CabinetNotesTests.cs\ (S?a d?i)
  - \ToolCalendar.Tests/Cabinet/CabinetRoomsTests.cs\ (S?a d?i)
- **L?nh git commit**: \git commit -m "test(cabinet): fix test failures and missing tables"\

### [2026-07-20 23:50] feat(ocr): tích hợp Gemini API làm phương pháp bóc tách chính
- **Mô tả**: Thay thế luồng trích xuất dữ liệu dựa trên Regex kém hiệu quả bằng Google Gemini 1.5 Flash. Khi có `GEMINI_API_KEY`, hệ thống sẽ gọi Gemini xử lý văn bản bị lộn xộn. Trả về fallback Regex nếu Gemini thất bại hoặc thiếu Key.
- **Tệp thay đổi**:
  - `docker-compose.yml` (Sửa đổi)
  - `.env.example` (Sửa đổi)
  - `ToolCalendar.Api/Program.cs` (Sửa đổi)
  - `ToolCalendar.Core/Services/OcrTextProcessingService.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(ocr): tích hợp Gemini API làm phương pháp bóc tách chính"`

### [2026-07-21 00:16] fix(ocr): chuyển mô hình Gemini sang flash-lite để fix lỗi quota
- **Mô tả**: Thay thế gemini-1.5-flash (bị deprecate) và gemma-4 (quá chậm) bằng gemini-flash-lite-latest để xử lý lỗi 429 Quota Exceeded trên free tier.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Services/OcrTextProcessingService.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(ocr): chuyển mô hình Gemini sang flash-lite để fix lỗi quota"`

### [2026-07-21 00:22] style(ui): đổi tên mục menu Lịch công tác thành Văn bản đến hạn
- **Mô tả**: Sửa tên mục sidebar từ Lịch công tác thành Văn bản đến hạn để ngắn gọn và phản ánh đúng nội dung.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/shell/Sidebar.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "style(ui): đổi tên mục menu Lịch công tác thành Văn bản đến hạn"`

### [2026-07-21 00:29] fix(settings): sửa lỗi từ khóa không lưu do bất đồng bộ state
- **Mô tả**: Khi thêm hoặc xóa từ khóa thời hạn (Deadline), component lưu state bằng setConfig rồi gọi onSave() ngay lập tức, dẫn đến việc closure của hàm onSave sử dụng biến state config cũ (stale state) và gửi mảng chưa cập nhật lên API. Thay vì thế, truyền trực tiếp biến newConfig vào onSave để request gửi state mới nhất.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/pages/Settings.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/components/settings/GeneralTab.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(settings): sửa lỗi từ khóa không lưu do stale state khi gọi api"`

### [2026-07-21 00:59] fix(settings): sửa lỗi không lưu được từ khóa thời hạn mới
- **Mô tả**: Sửa lỗi logic `isEvent` trong `Settings.jsx` nhận diện nhầm `overrideConfig` thành event, dẫn đến việc fallback về config cũ khi lưu, làm mất từ khóa mới thêm. Cập nhật `onBlur` trong `GeneralTab.jsx` để tránh rò rỉ event object.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/pages/Settings.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/components/settings/GeneralTab.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(settings): sửa lỗi không lưu được từ khóa thời hạn mới"`

### [2026-07-21 01:09] fix(upload): thực sự xóa văn bản khỏi DB khi hủy đợt tải hoặc gỡ bỏ một văn bản
- **Mô tả**: Sửa lỗi logic trên giao diện Upload, khi ấn "Xóa" hoặc "Hủy đợt tải" chỉ xóa khỏi State (UI) mà không gọi API xóa tài liệu (nháp) dưới Database, dẫn đến rác dữ liệu tồn đọng trong Quản lý văn bản.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/pages/Upload.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(upload): thực sự xóa văn bản khỏi DB khi hủy đợt tải hoặc gỡ bỏ"`

### [2026-07-21 01:16] feat(ocr): nâng cấp Regex nhận diện thời hạn để hỗ trợ bỏ qua cụm thời gian (giờ/phút)
- **Mô tả**: Cập nhật logic OCR Regex trong `OcrTextProcessingService.cs`. Cho phép tùy chọn bỏ qua các cụm từ chỉ thời gian (VD: "16h", "16 giờ", "16h30") nằm giữa từ khóa thời hạn và ngày tháng, giúp nhận diện chính xác các văn bản có cấu trúc như "trước 16h ngày 22/7/2026" chỉ bằng từ khóa "trước".
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Services/OcrTextProcessingService.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(ocr): nâng cấp Regex nhận diện thời hạn hỗ trợ thời gian (giờ/phút)"`

### [2026-07-21 01:46] fix(docs): hiển thị đúng người tiếp nhận và sửa logic lịch sử phân công
- **Mô tả**: Sửa lỗi giao diện hiển thị người "Tiếp nhận văn bản" là "HỆ THỐNG" và "PHÂN CÔNG XỬ LÝ" sai thời điểm trong lịch sử văn bản. Thêm trường `UploadedByUserId` vào tất cả các câu truy vấn SELECT trong `DocumentRepository.cs` để frontend nhận được id thật của người tải lên. Cập nhật frontend `DocDetail.jsx` chỉ hiển thị event "PHÂN CÔNG XỬ LÝ" ảo khi văn bản chưa qua bước luân chuyển nào (chưa có DocumentRoutings) và được phân công cho người khác người tải lên.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/DocumentRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/pages/DocDetail.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(docs): hiển thị đúng người tiếp nhận và sửa logic lịch sử phân công"`

### [2026-07-21 09:37] fix(api): giữ nguyên tên file gốc khi tải xuống
- **Mô tả**: Sửa lỗi endpoint tải file (/api/documents/{id}/file và /api/documents/evidence-file) trả về file trắng không có đuôi (như 'evidence-file' hoặc 'file') bằng cách thêm tham số thứ 3 vào hàm PhysicalFile để buộc trình duyệt lấy tên file vật lý.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(api): giữ nguyên tên file gốc khi tải xuống"`

<<<<<<< HEAD
### [2026-07-21 09:45] fix(api): khôi phục tính năng xem trước inline cho PDF và file ảnh
- **Mô tả**: Thay vì truyền tham số fileDownloadName vào hàm PhysicalFile (khiến trình duyệt ép tải file về và phá vỡ iframe preview), sử dụng System.Net.Mime.ContentDisposition với Inline = true để vừa hỗ trợ xem trước inline, vừa giữ được tên file khi người dùng nhấn Tải Xuống từ trình xem PDF.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/Controllers/DocumentsController.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(api): khôi phục tính năng xem trước inline cho file đính kèm"`
=======
### [2026-07-22 16:32] Fix OcrTextProcessingService constructor errors
- **Mô tả**: Sửa lỗi constructor của OcrTextProcessingService trong các file test do thiếu tham số IConfiguration và IHttpClientFactory
- **Tệp thay đổi**:
  - `ToolCalendar.Tests\OcrAutomationTests.cs` (Sửa đổi)
  - `ToolCalendar.Tests\OcrTextRegexTests.cs` (Sửa đổi)
  - `ToolCalendar.Tests\RuleExtractionTests.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "test(ocr): thêm tham số cấu hình cho OcrTextProcessingService trong các file test"`
>>>>>>> 69b23d8f4ab7e9af79161311e46c7f18d2155804
### [2026-07-26 16:30] Tính toán thống kê động cho Danh sách phiên họp và Trang chủ
- **Mô tả**: Thay thế các con số fix cứng (Tham gia 31, Chưa xác nhận 1, Vắng mặt 0...) bằng cách tính toán số lượng thực tế từ dữ liệu trả về qua endpoint `/api/phonghopkhonggiayto/meetings/my-meetings` tại trang `MeetingList` và `CabinetHome`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetHome.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(cabinet): tính toán thống kê phiên họp động dựa trên dữ liệu thực tế thay vì fix cứng"`
### [2026-07-26 16:59] Thêm nút điểm danh khi vào họp trên trang chủ
- **Mô tả**: Khi người dùng nhấn nút "Vào họp" ở trang chủ (CabinetHome), thay vì hiển thị thông báo alert như trước, hệ thống sẽ mở một Dialog "Xác nhận điểm danh". Sau khi nhấn "Điểm danh & Vào họp", hệ thống sẽ gọi API PUT `/api/phonghopkhonggiayto/meetings/{id}/attendance` để tự động cập nhật trạng thái "Có tham gia" cho người dùng, sau đó đóng modal và làm mới lại thống kê trên Dashboard.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/CabinetHome.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(routing): thêm modal xác nhận điểm danh trước khi vào họp"`

### [2026-08-04 16:44] style(ui): đổi tên mục menu Phân quyền và quản trị thành Phân quyền để không bị cắt chữ
- **Mô tả**: Rút gọn text hiển thị trên navbar của CabinetAppShell để tránh bị cắt chữ trên màn hình nhỏ.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "style(ui): rút gọn text navbar Phân quyền để không bị cắt chữ"`


### [2026-08-04 16:49] feat(ui): thiết kế lại modal Hồ sơ cá nhân và thêm hiệu ứng đăng xuất
- **Mô tả**: Thiết kế lại giao diện Hồ sơ cá nhân theo yêu cầu mới (Header đỏ, form thông tin gọn gàng chỉ giữ lại Tên đăng nhập và Tên đại biểu). Đồng thời thêm màn hình overlay loading khi nhấn Đăng xuất.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(ui): thiết kế lại modal Hồ sơ cá nhân và thêm hiệu ứng đăng xuất"`


### [2026-08-04 16:54] feat(auth): thêm thông tin lần đăng nhập gần nhất vào JWT
- **Mô tả**: Truy xuất bản ghi đăng nhập thành công gần nhất từ bảng `LoginAuditLog` và đưa vào JWT claim `LastLogin` để frontend hiển thị trong màn hình Hồ sơ cá nhân.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Interfaces/IAuditLogRepository.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/AuditLogRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/AuthController.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/CabinetAppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(auth): thêm thông tin lần đăng nhập gần nhất vào JWT"`


### [2026-08-04 16:58] feat(ui): thêm nút Tạo phiên họp cho Admin
- **Mô tả**: Tích hợp luồng tạo cuộc họp (thông qua `MeetingModal`) vào trang Quản lý phiên họp. Nút "Tạo phiên họp" chỉ hiển thị đối với tài khoản có quyền `Admin` hoặc `LanhDao`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(ui): thêm nút Tạo phiên họp cho Admin"`


### [2026-08-04 17:05] feat(ui): thêm tuỳ chọn "Phòng họp khác" cho Admin
- **Mô tả**: Hỗ trợ nhập "Phòng họp khác" nếu phòng họp không có trong danh sách. Cho phép RoomId có thể nhận giá trị `null` và lưu chuỗi văn bản tự do vào trường `Location`.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Models/Meeting.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/Cabinet/MeetingsController.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/MeetingRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/cabinet/components/MeetingModal.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(ui): thêm tuỳ chọn Phòng họp khác trong MeetingModal"`


### [2026-08-04 17:14] feat(ui): thêm tab Tất cả phiên họp cho Admin
- **Mô tả**: Khi Admin tạo phiên họp nhưng không mời chính mình thì phiên họp không hiển thị ở tab "Phiên họp cá nhân được mời". Vì vậy, bổ sung thêm tab "Tất cả phiên họp" (chỉ hiển thị với quyền Admin/Lãnh đạo) gọi API `/schedule` để lấy toàn bộ danh sách phiên họp.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(ui): thêm tab Tất cả phiên họp cho Admin"`


### [2026-08-04 17:20] feat(ui): thêm tính năng Xóa phiên họp cho Admin
- **Mô tả**: Bổ sung nút "Xóa phiên họp" trong menu thao tác của mỗi phiên họp (chỉ hiển thị cho Admin/Lãnh đạo). Khi ấn, người dùng xác nhận và gọi API DELETE để xóa.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingList.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(ui): thêm tính năng xóa phiên họp cho admin"`


### [2026-08-04 17:22] fix(api): sửa lỗi truy vấn danh sách phiên họp được mời
- **Mô tả**: Sửa lỗi API `GetByParticipantAsync` trả về cả những phiên họp do người dùng tạo nhưng họ không tham gia. Đã loại bỏ điều kiện `OR m.CreatorId = @userId` trong câu lệnh SQL `WHERE`.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/MeetingRepository.cs` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(api): sửa truy vấn lấy danh sách phiên họp cá nhân"`


### [2026-08-04 18:14] refactor(ui): hiển thị thông tin thực tế trong trang Chi tiết phiên họp thay vì dữ liệu mẫu
- **Mô tả**: Thay thế các dữ liệu hardcode (như tên cuộc họp, thời gian, chủ trì, danh sách tài liệu) trong `MeetingDetail.jsx` bằng dữ liệu thực được truyền vào từ biến `meeting`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingDetail.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "refactor(ui): hien thi du lieu that cho trang chi tiet phien hop"`


### [2026-08-05 15:58] Nâng cấp Bảo mật Session (Chuẩn Enterprise)
- **Mô tả**: Vá lỗ hổng bảo mật liên quan đến Refresh Token bằng cách lưu Token vào HttpOnly Cookie (chống XSS) và thu hồi Refresh Token trong DB khi người dùng đăng xuất hoặc đổi mật khẩu.
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Interfaces/IUserRepository.cs` (Sửa đổi)
  - `ToolCalendar.Core/Data/Repositories/UserRepository.cs` (Sửa đổi)
  - `ToolCalendar.Api/Controllers/AuthController.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/pages/Login.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/main.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "security(auth): nâng cấp bảo mật refresh token dùng httponly cookie và thu hồi token"`

### [2026-08-05 23:36] Refactor Giai đoạn 1: Chuẩn hóa Constants & Loại bỏ AUTH_HEADER
- **Mô tả**: Thay thế chuỗi cứng (magic strings) về trạng thái điểm danh bằng `ATTENDANCE_STATUS`. Xóa bỏ khai báo và truyền `AUTH_HEADER` dư thừa ở tất cả các file fetch của phân hệ Cabinet do hệ thống đã dùng Global Fetch Interceptor kèm HttpOnly Cookies cho xác thực.
- **Tệp thay đổi**:
  - `.agents/rules/tc-rule-frontend-architecture.md` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/constants/meeting.js` (Mới)
  - `ToolCalendar.Api/ClientApp/src/constants/document.js` (Mới)
  - Các file thuộc `ToolCalendar.Api/ClientApp/src/cabinet/` (Sửa đổi: xóa AUTH_HEADER)
- **Lệnh git commit**: `git commit -m "refactor(api): chuẩn hóa constants và loại bỏ AUTH_HEADER dư thừa"`

### [2026-08-05 23:38] Refactor Giai đoạn 2: Xóa bỏ truyền Auth Token thủ công (Documents & Cabinet)
- **Mô tả**: Loại bỏ hoàn toàn việc lấy auth_token từ localStorage và truyền vào header cho fetch API ở các module Documents và Cabinet, tận dụng triệt để Global Fetch Interceptor nhằm đơn giản hóa code và tăng tính bảo mật.
- **Tệp thay đổi**:
  - Các file thuộc  (Sửa đổi)
  - Các file thuộc  (Sửa đổi)
- **Lệnh git commit**: 

### [2026-08-05 23:38] Refactor Giai đoạn 2: Xóa bỏ truyền Auth Token thủ công (Documents & Cabinet)
- **Mô tả**: Loại bỏ hoàn toàn việc lấy auth_token từ localStorage và truyền vào header cho fetch API ở các module Documents và Cabinet, tận dụng triệt để Global Fetch Interceptor nhằm đơn giản hóa code và tăng tính bảo mật.
- **Tệp thay đổi**:
  - Các file thuộc `ToolCalendar.Api/ClientApp/src/documents/` (Sửa đổi)
  - Các file thuộc `ToolCalendar.Api/ClientApp/src/cabinet/` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "refactor(api): xóa bỏ truyền auth token thủ công trong requests"`

### [2026-08-05 23:49] Giai đoạn 2 - Bóc tách component DocDetail.jsx
- **Mô tả**: Refactor chia nhỏ component `DocDetail.jsx` (dài hơn 1400 dòng) thành các sub-components độc lập để dễ bảo trì, tuân thủ nguyên tắc SRP. Các sub-components được đặt trong thư mục `src/documents/pages/DocDetail/components`.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocOverviewTab.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocContentTab.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocRoutingTab.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocHistoryTab.jsx` (Mới)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocComments.jsx` (Mới)
- **Lệnh git commit**: `git commit -m "refactor(docs): bóc tách giao diện DocDetail thành các sub-components"`

### [2026-08-05 23:56] Khôi phục các Modal trong DocDetail
- **Mô tả**: Sửa lỗi mất code của các Modal (Edit, Delete, Evidence, Forward, Fullscreen PDF) trong quá trình bóc tách DocDetail.jsx, chuyển chúng vào DocModals.jsx.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocModals.jsx` (Mới)
- **Lệnh git commit**: `git commit -m "fix(docs): khôi phục các modal bị mất trong quá trình refactor DocDetail"`

### [2026-08-05 23:59] Sửa logic hiển thị trạng thái phiên họp
- **Mô tả**: Sửa lỗi trạng thái phiên họp hiển thị 'Sắp diễn ra' (lấy từ database) trong khi thời gian thực tế đã hết ('Hết thời gian!'). Thay đổi để sử dụng hàm `getDynamicStatus` đồng bộ với logic tính toán thời gian.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/cabinet/pages/MeetingDetail.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(cabinet): sửa lỗi hiển thị trạng thái phiên họp không đồng bộ với thời gian thực"`

### [2026-08-06 00:04] Khôi phục code bị mất trong DocRoutingTab và DocComments
- **Mô tả**: Khi thực hiện bóc tách (refactor) các component con của DocDetail bằng script tự động, hai file DocRoutingTab.jsx và DocComments.jsx chưa được đổ dữ liệu vào (return null). Đã trích xuất mã nguồn gốc từ file backup và ghi vào lại hai file này.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocRoutingTab.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocComments.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(docs): khôi phục nội dung tab luân chuyển và khung bình luận bị sót khi refactor"`

### [2026-08-06 00:05] Khôi phục mã JSX của các tab còn lại bị mất do script tách component
- **Mô tả**: Tương tự như DocRoutingTab, các tab DocOverviewTab, DocContentTab và DocHistoryTab cũng bị trả về `null` do lỗi trong kịch bản tự động khi bóc tách code. Đã khôi phục nguyên trạng toàn bộ 100% nội dung JSX từ file sao lưu cũ vào các file tương ứng.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocOverviewTab.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocContentTab.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocHistoryTab.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(docs): khôi phục toàn bộ nội dung các tab Overview, Content và History bị ẩn"`

### [2026-08-06 00:11] Tái cấu trúc loại bỏ Magic Strings trong MyTasks.jsx và thiết lập quy tắc mới
- **Mô tả**: Đã tạo file `constants/document.js` chứa các hằng số (constants) cho trạng thái văn bản và bộ lọc thay cho việc hardcode chuỗi trực tiếp. Áp dụng rule này vào file `MyTasks.jsx` để code sạch, dễ bảo trì và hạn chế sai lỗi chính tả. Đồng thời đã định nghĩa và thêm quy tắc `tc-rule-magic-strings.md` vào thư mục `.agents/rules` để AI luôn tuân thủ.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/constants/document.js` (Mới)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/MyTasks.jsx` (Sửa đổi)
  - `.agents/rules/tc-rule-magic-strings.md` (Mới)
  - `.agents/AGENTS.md` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "refactor: loại bỏ magic strings trong MyTasks và cập nhật rule AI"`

### [2026-08-06 00:15] Tái cấu trúc loại bỏ Magic Strings toàn dự án (Frontend)
- **Mô tả**: Tiếp nối chiến dịch loại bỏ Magic Strings, đã quét và thay thế tất cả chuỗi hardcode liên quan đến `Roles` (Admin, CanBo, VanThu, LanhDao), `Trạng thái văn bản` (Chưa xử lý, Đang xử lý, v.v.), và `Độ ưu tiên` sang sử dụng các constants dùng chung. Đã thêm `constants/roles.js`.
- **Tệp thay đổi**:
  - `src/constants/roles.js` (Mới)
  - `src/constants/document.js` (Sửa đổi)
  - 14 file components và pages (Sửa đổi)
- **Lệnh git commit**: `git commit -m "refactor: loại bỏ magic strings toàn bộ frontend (roles, status, priority)"`

### [2026-08-06 23:56] Xóa phân hệ Cabinet khỏi CSDL và Tài liệu
- **Mô tả**: Tách phân hệ "Phòng họp không giấy tờ" (Cabinet) thành dự án riêng biệt. Tiến hành gỡ bỏ schema bảng liên quan đến Cabinet trong `tc-rule-database-schema.md`, xóa thông tin phân hệ trong `SYSTEM_FEATURES.md`, và drop các bảng thuộc Cabinet khỏi SQLite CSDL để làm gọn dự án `Tool-Calendar`.
- **Tệp thay đổi**:
  - `data_dump/documents.db` (Sửa đổi - Drop tables)
  - `SYSTEM_FEATURES.md` (Sửa đổi)
  - `.agents/rules/tc-rule-database-schema.md` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "refactor(db): loại bỏ phân hệ cabinet khỏi csdl và tài liệu"`


### [2026-08-07 00:00] Loại bỏ mã nguồn phân hệ Cabinet
- **Mô tả**: Xóa bỏ toàn bộ mã nguồn của phân hệ Cabinet (Controllers, Components, Pages) khỏi dự án Tool-Calendar để tối ưu hóa và làm gọn dự án, phục vụ mục đích duy nhất là hệ thống Điều phối công văn nội bộ.
- **Tệp thay đổi**:
  - Các file thuộc `ToolCalendar.Api/ClientApp/src/cabinet/` (Xóa)
  - Các file thuộc `ToolCalendar.Api/Controllers/Cabinet/` (Xóa)
  - `ToolCalendar.Api/Program.cs` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/main.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/shell/AppShell.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "refactor(code): loại bỏ hoàn toàn mã nguồn phân hệ cabinet"`


### [2026-08-07 00:05] Fix missing DOCUMENT_STATUS imports
- **Mô tả**: Bổ sung các lệnh import biến `DOCUMENT_STATUS` từ `constants/document.js` vào các file bị thiếu (Dashboard, DocDetail, DocRoutingTab, DocOverviewTab, DocHistoryTab, Upload, DocumentRoutingTree) để sửa lỗi crash giao diện `DOCUMENT_STATUS is not defined` trên môi trường deploy.
- **Tệp thay đổi**:
  - `ToolCalendar.Api/ClientApp/src/documents/pages/Dashboard.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocRoutingTab.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocOverviewTab.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocHistoryTab.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/documents/pages/Upload.jsx` (Sửa đổi)
  - `ToolCalendar.Api/ClientApp/src/components/DocumentRoutingTree.jsx` (Sửa đổi)
- **Lệnh git commit**: `git commit -m "fix(docs): add missing DOCUMENT_STATUS imports"`

