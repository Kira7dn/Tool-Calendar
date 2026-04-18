# DANH SÁCH YÊU CẦU NGHIỆP VỤ (GĐ 1)

* **Môi trường vận hành**:

  * Ứng dụng chạy Local hoàn toàn (Offline).
  * Sử dụng máy chủ nội bộ (Local Server) trong mạng LAN.
* **Hệ thống Thông báo & Cảnh báo**:

  * Sử dụng **Web Push API (VAPID)** kết hợp với **Service Worker** để tạo thông báo đẩy (Push Notification) có thể hiển thị ngay cả khi **đã đóng trình duyệt/tab ứng dụng** (Lưu ý: Cần kết nối Internet để liên hệ với Push Service của trình duyệt, nhưng không cần tạo tài khoản FCM).
  * Sử dụng **In-app Toast** (thông báo nhỏ trong ứng dụng) và **SignalR** để cảnh báo tức thời khi đang mở Dashboard.
  * **Logic nhắc việc 7-3-1**: Cảnh báo tự động theo các mốc 7 ngày, 3 ngày và 1 ngày trước hạn.
  * Cho phép tải file **.ics** (Calendar) để nạp lịch nhắc việc vào Outlook/Lịch của Windows (chuyển sang GD2).
  * Gửi thông báo nhắc việc qua **Email** (GĐ 1 - Tự động lấy email từ hồ sơ User; Hiện tại đang ở dạng **Stub/Log** để kiểm tra logic, cần cấu hình SMTP Server để gửi thật).
  * Gửi thông báo nhắc việc qua **Zalo** (chuyển sang GD2).
* **Số hóa & Nhập liệu**:

  * **Bóc tách OCR**: Sử dụng Tesseract để tự động nhận diện Số hiệu, Tên công văn, Trích yếu, Ngày tháng, Thời hạn từ file PDF.
  * **Dán nhãn công văn**: dán nhãn, phân loại công văn theo từ khóa, set up rule thủ công trong giao diện admin
  * LLM tự động nhận diện ngữ cảnh và dán nhãn công văn (chuyển sang GD2).
  * **Giao diện Rà soát (Review)**: Thiết kế chia đôi màn hình (Side-by-Side) từng trang với file PDF gốc bên trái và Form dữ liệu bóc tách bên phải. Cho phép văn thư chỉnh sửa dữ liệu được trích xuất nếu phát hiện sai lệch
  * **Local LLM** tự động correct thông tin từ OCR, embedding và lưu vào vector store phục vụ cho RAG/Agent (chuyển sang GD2).
  * **Tự động gợi ý thời hạn**: Hệ thống tự bắt từ khóa để gợi ý số ngày xử lý (ví dụ: Công văn = 15 ngày).
  * **Batch import**: Hỗ trợ nạp hàng loạt dữ liệu, nhưng vẫn bao gồm giao diện review với từng tài liệu.
* **Quản lý & Điều phối**:

  * **Phân quyền (RBAC)**: 4 vai trò (Lãnh đạo, Văn thư, Cán bộ, Admin).
  * **Phân bổ công việc**: Văn thư gán đích danh Cán bộ xử lý từng văn bản.
  * **Dashboard Lãnh đạo**: Theo dõi biểu đồ tiến độ và các điểm nghẽn (quá hạn).
  * **Dashboard Cán bộ**: Nhận biết được danh sách công văn cần xử lý, các công văn đã giải quyết xong có đính kèm bằng chứng
  * **Admin** tạo mới người dùng, quản lý user/password thông tin người dùng
  * **Admin** có quyền tạo auto workflow để tự động điều phối văn thư theo rule base dựa vào metadata của tài liệu và user (chuyển sang GD2)
* **Bảo mật & Lưu trữ**:

  * Dữ liệu lưu tại Local Server, không đẩy lên Cloud.
  * **Sao lưu (Backup)**: Tự động sao lưu định kỳ vào ổ cứng dưới dạng csv hoặc text, thuận tiện cho việc xuất dữ liệu ra USB hoặc ổ cứng rời để lưu trữ thủ công.

---

# THIẾT KẾ USER FLOW (LUỒNG NGƯỜI DÙNG)

## 1. Luồng của Văn thư (Nhập liệu & Điều phối)

- **Bắt đầu**: Tải lên file PDF/Quét văn bản (Hỗ trợ Tải lẻ hoặc Tải hàng loạt).
- **OCR [hệ thống]**: Bóc tách OCR (Xếp hàng xử lý Batch) và đưa vào **Danh sách chờ duyệt (Pending List)**.
- **Review**: Giao diện Review Side-by-Side rà soát từng trang PDF vs Dữ liệu bóc tách (đặc biệt là Tên công văn, Số hiệu, Trích yếu).
- **Chỉnh sửa**: Chỉnh sửa/Bổ sung thông tin sai lệch.
- **Phân loại**: Dán nhãn/Phân loại & Áp rule thủ công.
- **Điều phối**: Gán đích danh Cán bộ/Phòng ban xử lý.
- **Hoàn tất [hệ thống]**: Lưu dữ liệu & Đẩy Web Notification cho Cán bộ.

## 2. Luồng của Cán bộ (Thực thi & Báo cáo)

- **Đăng nhập**: Xem Dashboard cá nhân với các chỉ số: Việc mới nhận, Việc đang xử lý, Việc sắp hết hạn (màu Vàng/Đỏ).
- **Tiếp nhận**: Nhận thông báo (Web & Email); click xem văn bản (Hệ thống tự động lưu vết "Đã xem" và thời gian tiếp nhận).
- **Nghiên cứu**: Xem PDF gốc song song với thông tin tóm tắt metadata.
- **Thực thi**: Chuyển trạng thái sang "Đang thực hiện"; hệ thống duy trì nhắc việc qua Web/Email theo mốc 7-3-1 ngày.
- **Báo cáo**: Tải lên file bằng chứng thực hiện (Ảnh/PDF/File kết quả) và nhập nội dung tóm tắt kết quả xử lý.
- **Hoàn tất**: Nhấn "Xác nhận hoàn thành" để chuyển hồ sơ sang mục "Đã giải quyết" và gửi thông báo cho cấp quản lý.

## 3. Luồng của Lãnh đạo (Giám sát & Đôn đốc)

Tập trung vào số liệu tổng quan và xử lý các điểm nghẽn.

- **Dashboard**: Xem biểu đồ Tỷ lệ hoàn thành/Quá hạn toàn đơn vị.
- **Giám sát**: Truy vấn danh sách văn bản theo phòng ban hoặc cán bộ.
- **Đôn đốc**: Nhấn nút "Nhắc nhở" cho các văn bản chậm trễ.
- **Kết quả**: Xem bằng chứng hoàn thành từ cán bộ để đánh giá chất lượng.

## 4. Luồng của Admin (Cấu hình & Quản trị)

Đảm bảo hệ thống vận hành đúng quy tắc.

- **Quản lý User**: Tạo mới, phân quyền, quản lý mật khẩu.
- **Cấu hình Rule**: Thiết lập từ khóa dán nhãn, gợi ý thời hạn và mapping metadata.
- **Cấu hình Thông báo & Email**: Thiết lập các mốc thời gian nhắc việc (7-3-1), nội dung thông báo và cấu hình Server gửi Email (SMTP).
- **Cấu hình Sao lưu**: Giao diện thiết lập tần suất tự động sao lưu, đường dẫn lưu trữ file (CSV/Text) và quản lý các bản sao lưu hiện có.
- **Bảo trì**: Kiểm tra log hệ thống, dọn dẹp dữ liệu rác.

---

# THIẾT KẾ DATA ENTITY MODEL (MÔ HÌNH DỮ LIỆU)

### 1. User (Người dùng)
- `Id`, `Username`, `PasswordHash`.
- `FullName`: Họ và tên cán bộ.
- `Email`, `PhoneNumber`: Để phục vụ gửi thông báo (Email/Zalo) trong tương lai.
- `Role`: Phân quyền (Admin, Lãnh đạo, Văn thư, Cán bộ).
- `DepartmentId`: Định danh phòng ban.

### 2. Department (Phòng ban)
- `Id`, `Name`: Tên phòng ban/bộ phận.
- `Description`: Mô tả chức năng.

### 3. Document (Công văn/Văn bản)
- `Id`, `SoHieu`, `TenCongVan`, `TrichYeu`.
- `FullText`: Toàn bộ nội dung văn bản dưới dạng chữ (OCR bóc tách) phục vụ tìm kiếm.
- `NgayBanHanh`, `HanXuLy` (Deadline).
- `FilePath`: Đường dẫn file PDF gốc tại local server.
- `Status`: Trạng thái (Chưa xử lý, Đang xử lý, Đã hoàn thành, Quá hạn).
- `Priority`: Mức độ khẩn (Thường, Khẩn, Hỏa tốc).
- `DepartmentId`: Phòng ban đang thụ lý (để báo cáo nhanh).
- `AssignedTo`: ID Cán bộ thụ lý nhiệm vụ.
- `EvidencePaths`: Danh sách đường dẫn các file bằng chứng hoàn thành (Lưu dạng chuỗi JSON hoặc Array).
- `EvidenceNotes`: Ghi chú nội dung kết quả xử lý.
- `CompletionDate`: Ngày thực tế hoàn thành việc.
- `LabelId`: Định danh nhãn đã dán (Mapping với bảng DocumentLabel).

### 4. DocumentLabel (Nhãn/Phân loại)
- `Id`, `Name`: Tên nhãn (Ví dụ: Dự án, Khiếu nại, ...).
- `Color`: Mã màu hiển thị.

### 5. AutoRule (Quy tắc tự động)
- `Id`, `Keyword`: Từ khóa nhận diện để gợi ý dán nhãn/thời hạn.
- `LabelId`: Nhãn dự kiến sẽ gợi ý (Mapping với bảng DocumentLabel).
- `DefaultDeadlineDays`: Số ngày gợi ý mặc định.

### 6. AppSetting (Cấu hình hệ thống)
- `Key`, `Value`: Lưu các thiết lập mốc 7-3-1 ngày, đường dẫn Backup, v.v.

### 7. AuditLog (Nhật ký hệ thống)
- `Id`, `UserId`, `Action`, `Timestamp`: Lưu vết 100% các thao tác Xem/Sửa/Xóa của mọi người dùng.

### 8. PushSubscription (Đăng ký nhận tin)
- `Id`, `UserId`: Liên kết với người dùng.
- `Endpoint`: URL dịch vụ push của trình duyệt.
- `P256dh`, `Auth`: Khóa mã hóa bảo mật thông báo (VAPID).
- `CreatedAt`: Thời điểm đăng ký.

---

# 📋 TODO LIST (LỘ TRÌNH TRIỂN KHAI GĐ 1)

### 1. Data Domain (Persistence Layer)
- [x] Khởi tạo các Entity trong `ToolCalender.Core` (User, Document, Department, Label, Rule, Setting, AuditLog). 🔹 *Next: Đã hoàn thành. Sẵn sàng cho việc phân quyền và điều phối.*
- [x] Thiết lập kết nối Database (MongoDB hoặc SQL). 🔹 *Next: Duy trì cấu hình kết nối hiện tại.*
- [x] Cài đặt Repository Pattern/Data Access Layer. 🔹 *Next: Đã có DatabaseService, cần tối ưu cho các Entity mới.*
- [x] Tạo dữ liệu mẫu (Seed Data): Tài khoản Admin mặc định, các Phòng ban cơ bản của cơ quan. 🔹 *Next: Bổ sung dữ liệu mẫu cho Phòng ban và Nhãn.*

### 2. Service (Backend Logic)
- [x] **Auth Service**: Xử lý Đăng nhập, cấp Token JWT và kiểm tra quyền RBAC. 🔹 *Next: Cập nhật Token để chứa thêm thông tin FullName/Department.*
- [x] **OCR Service**: Tích hợp Tesseract, xử lý **Hàng đợi Batch (Queue)** và bóc tách thông tin (gồm cả Tên công văn). 🔹 *Next: Đã hoàn thành xử lý nền và bóc tách nâng cao.*
- [x] **Document Service**: Xử lý Upload PDF, CRUD văn bản, Gán việc và cập nhật trạng thái kèm **nhiều file bằng chứng**. 🔹 *Next: Đã hoàn thành luồng điều phối và báo cáo kết quả.*
- [x] **Notification Service**: Quét mốc 7-3-1 ngày, gửi Web Notification và lưu vết thông báo vào **AuditLog**. 🔹 *Next: Đã hoàn thành triển khai Web Push (VAPID) và tự động tạo khóa.*
- [x] **Admin & Backup Service**: Quản lý Rule dán nhãn, **Quản lý Phòng ban**, Cấu hình SMTP và cơ chế Auto-backup CSV. 🔹 *Next: Đã hoàn thành CRUD danh mục và xuất CSV.*
- [x] **Stats Service**: Tính toán dữ liệu tổng hợp theo Phòng ban/Cán bộ cho Dashboard. 🔹 *Next: Đã hoàn thành API thống kê tổng hợp.*

### 3. UI Component (Atomic Elements)
- [x] **Layout**: Sidebar điều hướng, Header Premium tích hợp danh sách thông báo đẩy. 🔹 *Next: Hoàn thiện danh sách thông báo thả xuống (Dropdown).*
- [x] **Data Table**: Danh sách văn bản hỗ trợ lọc, tìm kiếm và phân trang chuyên sâu. 🔹 *Next: Thêm bộ lọc nhanh theo Phòng ban.*
- [x] **Status Badge**: Các nhãn màu sắc thể hiện Trạng thái và Mức độ khẩn. 🔹 *Next: Duy trì.*
- [ ] **PDF Previewer**: Component nhúng PDF hỗ trợ **điều hướng từng trang** để rà soát. 🔹 *Next: Tích hợp thư viện hiển thị PDF (như PDF.js).*
- [x] **Notification UI**: Toast thông báo tức thời và danh sách thông báo chưa đọc. 🔹 *Next: Đã triển khai Service Worker cho Web Push.*
- [ ] **FE Approval Logic**: Xây dựng UI/Logic để xin quyền người dùng (Notification Permission), lấy Subscription và gửi về API `/api/Notification/subscribe`.

### 4. UI Scene (Main Views)
- [x] **Login Scene**: Trang đăng nhập bảo mật. 🔹 *Next: Hoàn thành.*
- [x] **Dashboard Scene**: Trang chủ với biểu đồ thống kê và top văn bản sắp quá hạn. 🔹 *Next: Bổ sung biểu đồ phân tích điểm nghẽn theo phòng ban.*
- [ ] **Upload & OCR Review Scene**: Giao diện chia đôi màn hình; tích hợp **Danh sách chờ duyệt (Pending List)** cho luồng Batch. 🔹 *Next: Thiết kế lại CSS màn hình rà soát Side-by-Side.*
- [ ] **Staff Workspace Scene**: Danh sách việc được giao; giao diện cập nhật kết quả và upload nhiều file bằng chứng. 🔹 *Next: Tạo màn hình "Công việc của tôi".*
- [ ] **Admin Setup Scene**: Trang cài đặt người dùng, phòng ban, rule bóc tách, SMTP và Backup dữ liệu. 🔹 *Next: Triển khai giao diện quản lý cấu hình hệ thống.*
