# 📄 Hệ Thống Điều Phối Công Văn (Link Strategy - GD1)

Hệ thống quản lý, giám sát và điều phối công văn thời gian thực dành cho cơ quan hành chính. Tích hợp AI OCR và bảo mật đa tầng.

## 🌟 Tính năng chính (Giai đoạn 1)

- **Dashboard thông minh**: Giám sát tiến độ công văn 7-3-1 ngày với biểu đồ tương tác.
- **AI OCR (Industrial Edition)**: Tự động bóc tách thông tin văn bản (Số hiệu, Ngày tháng, Trích yếu...) với độ chính xác cao.
- **Quản lý Nhân sự (CRUD)**: Quản lý chi tiết hồ sơ cán bộ bao gồm Họ tên, Email, Số điện thoại và sơ đồ Phòng ban.
- **Bảo mật RBAC**: Phân quyền chặt chẽ 4 vai trò (Admin, Lãnh đạo, Văn thư, Cán bộ).
- **SSL Tự động**: Trải nghiệm chuyên nghiệp với giao thức HTTPS (Xanh 100%) thông qua cơ chế tự cấp phát chứng chỉ.

---

## 🛠️ Hướng dẫn Cài đặt Hệ thống (Dành cho Admin)

### Bước 1: Chuẩn bị môi trường
- Cài đặt **Docker Desktop**.
- Cài đặt **Node.js** (để chạy lệnh `npx` khởi tạo SSL thông qua mkcert).

### Bước 2: Khởi tạo Server
1. Mở thư mục dự án.
2. Chuột phải vào file **`init_server.ps1`** -> Chọn **Run with PowerShell**.
3. Script sẽ tự động:
   - Dò tìm địa chỉ IP của máy chủ trong mạng LAN.
   - Khởi tạo chứng chỉ SSL bảo mật.
   - Cấu hình Nginx Proxy.
   - Tự động tạo bộ cài cho máy khách trong thư mục `client_setup`.
   - Khởi chạy toàn bộ hệ thống bằng Docker.

### Bước 3: Cung cấp bộ cài cho máy khách
- Gửi toàn bộ thư mục **`client_setup`** cho các máy tính khác trong mạng để họ thực hiện cài đặt nhanh.

---

## 💻 Hướng dẫn dành cho Máy Client (Máy trạm)

Để truy cập hệ thống một cách ổn định và bảo mật:

1. **Nhận bộ cài**: Tải về thư mục **`client_setup`** từ Admin.
2. **Cài đặt**:
   - Vào thư mục `client_setup`.
   - Chuột phải vào file **`setup_client.ps1`** -> Chọn **Run with PowerShell** (Yêu cầu quyền Administrator).
3. **Hoàn tất**: Mở trình duyệt và truy cập: [https://congvan.local](https://congvan.local).

---

## 🔑 Thông tin Tài khoản Mặc định (Sau khi Seed)

Hệ thống đã được nạp sẵn dữ liệu mẫu (Seed Data) để thử nghiệm:

- **Tài khoản Quản trị**: `admin` / `123456`
- **Tài khoản Lãnh đạo**: `chutich` / `123456`
- **Tài khoản Văn thư**: `vanthu` / `123456`
- **Địa chỉ truy cập**: [https://congvan.local](https://congvan.local)

---

## 📈 Quy trình làm việc

1. **Văn thư**: Đăng nhập -> Tải hồ sơ (PDF) -> Hệ thống tự động OCR -> Kiểm tra & Lưu thông tin.
2. **Lãnh đạo**: Theo dõi Dashboard, giám sát dòng chảy công văn và các cảnh báo quá hạn.
3. **Cán bộ**: Xử lý văn bản được giao và cập nhật tiến độ.
4. **Admin**: Quản trị nhân sự, phòng ban, nhãn văn bản và các luật tự động của hệ thống.
