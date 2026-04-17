# 📄 Hệ Thống Điều Phối Công Văn (Link Strategy - GD1)

Hệ thống quản lý, giám sát và điều phối công văn thời gian thực dành cho cơ quan hành chính. Tích hợp AI OCR và bảo mật đa tầng.

## 🌟 Tính năng chính (Giai đoạn 1)

- **Dashboard thông minh**: Giám sát tiến độ công văn 7-3-1 ngày.
- **AI OCR (Tesseract)**: Tự động bóc tách số hiệu, trích yếu, hạn xử lý từ file PDF.
- **Bảo mật RBAC**: Phân quyền 4 vai trò (Admin, Lãnh đạo, Văn thư, Cán bộ).
- **HTTPS & Domain**: Giao diện chuyên nghiệp với `https://congvan.local`.

---

## 🛠️ Hướng dẫn Cài đặt Hệ thống (Dành cho Admin) - CHỈ 3 BƯỚC

### Bước 1: Chuẩn bị môi trường
- Cài đặt **Docker** và **Docker Compose**.
- Cài đặt **mkcert** ([Tải file .exe tại đây](https://github.com/FiloSottile/mkcert/releases)).

### Bước 2: Chạy Script khởi tạo tự động
- Chuột phải vào file **`init_server.ps1`** -> Chọn **Run with PowerShell** (chạy bằng quyền Administrator).
- Script sẽ tự động: Khởi tạo SSL, cấu hình Nginx, chuẩn bị bộ cài cho đồng nghiệp và khởi động Docker.
- *Lưu ý: Bạn chỉ cần nhập địa chỉ IP thực tế của máy chủ này khi được hỏi.*

### Bước 3: Giao bộ cài cho đồng nghiệp
- Sau khi chạy xong Bước 2, một thư mục tên **`dist`** sẽ xuất hiện trong thư mục dự án. 
- Bạn chỉ cần gửi thư mục **`dist`** (chứa file `rootCA.pem` và `setup_client.ps1`) cho đồng nghiệp để họ cài đặt máy trạm.

---

## 💻 Hướng dẫn dành cho Máy Client

Để truy cập được `https://congvan.local` một cách nhanh chóng, các client cần thực hiện các bước sau:

1. **Nhận file từ Admin**: Tải về thư mục chứa 2 file `rootCA.pem` và `setup_client.ps1`.
2. **Cài đặt tự động**:
   - Chuột phải vào file `setup_client.ps1` -> Chọn **Run with PowerShell**.
   - Nếu có bảng hỏi hiện lên, chọn **Yes (Y)** để xác nhận quyền Administrator.
3. **Xong!**: Mở trình duyệt và truy cập ngay [https://congvan.local](https://congvan.local).

*(Lưu ý: Admin cần sửa địa chỉ IP trong file `setup_client.ps1` cho đúng với IP máy chủ trước khi gửi).*

---

## 🔑 Thông tin Tài khoản Mặc định

- **Tên đăng nhập**: `admin`
- **Mật khẩu**: `admin@123456`
- **Tên miền truy cập**: [https://congvan.local](https://congvan.local)

---

## 📈 Quy trình làm việc

1. **Văn thư**: Đăng nhập -> Tải hồ sơ (PDF) -> Kiểm tra kết quả OCR AI -> Lưu hệ thống.
2. **Lãnh đạo**: Đăng nhập -> Xem Dashboard biểu đồ -> Theo dõi các văn bản sắp quá hạn.
3. **Admin**: Quản lý danh sách nhân sự và phân quyền.
