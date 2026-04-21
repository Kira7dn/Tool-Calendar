# 📄 Hệ Thống Điều Phối Công Văn (Link Strategy - GD1)

Hệ thống quản lý, giám sát và điều phối công văn thời gian thực dành cho cơ quan hành chính. Tích hợp AI OCR và bảo mật đa tầng.

## 🌟 Tính năng chính (Giai đoạn 1)

- **Dashboard thông minh**: Giám sát tiến độ công văn 7-3-1 ngày.
- **AI OCR (Industrial Edition)**: Tự động bóc tách thông tin văn bản với độ chính xác cao.
- **Bảo mật RBAC**: Phân quyền 4 vai trò (Admin, Lãnh đạo, Văn thư, Cán bộ).
- **SSL Tự động**: Trải nghiệm chuyên nghiệp với `https://congvan.local` (Xanh 100%).

---

## 🛠️ Hướng dẫn Cài đặt Hệ thống (Dành cho Admin)

### Bước 1: Chuẩn bị môi trường
- Cài đặt **Docker Desktop**.
- Cài đặt **Node.js** (để chạy lệnh `npx` khởi tạo SSL).

### Bước 2: Khởi tạo Server
1. Mở thư mục dự án.
2. Chuột phải vào file **`init_server.ps1`** -> Chọn **Run with PowerShell**.
3. Script sẽ tự động:
   - Dò tìm địa chỉ IP của máy chủ.
   - Khởi tạo chứng chỉ SSL (thông qua `mkcert`).
   - Cấu hình Nginx.
   - Tự động tạo bộ cài cho máy khách trong thư mục `client_setup`.
   - Khởi chạy toàn bộ hệ thống bằng Docker.

### Bước 3: Cung cấp bộ cài cho máy khách
- Sau khi chạy xong Bước 2, một thư mục tên **`client_setup`** sẽ xuất hiện (hoặc được cập nhật).
- Gửi toàn bộ thư mục **`client_setup`** này cho các máy tính khác trong mạng để họ truy cập.

---

## 💻 Hướng dẫn dành cho Máy Client (Máy trạm)

Để truy cập hệ thống một cách ổn định và bảo mật:

1. **Nhận bộ cài**: Tải về thư mục **`client_setup`** từ Admin.
2. **Cài đặt**:
   - Vào thư mục `client_setup`.
   - Chuột phải vào file **`setup_client.ps1`** -> Chọn **Run with PowerShell** (Yêu cầu quyền Administrator).
3. **Hoàn tất**: Mở trình duyệt và truy cập: [https://congvan.local](https://congvan.local).

---

## 🔑 Thông tin Tài khoản Mặc định

- **Tên đăng nhập**: `admin`
- **Mật khẩu**: `admin@123456`
- **Địa chỉ truy cập**: [https://congvan.local](https://congvan.local)

---

## 📈 Quy trình làm việc

1. **Văn thư**: Đăng nhập -> Tải hồ sơ (PDF) -> Kiểm tra kết quả OCR AI -> Lưu hệ thống.
2. **Lãnh đạo**: Đăng nhập -> Xem Dashboard biểu đồ -> Theo dõi tiến độ.
3. **Admin**: Quản lý nhân sự và các cấu hình hệ thống.
