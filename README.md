# 📄 Hệ Thống Điều Phối Công Văn (Link Strategy - GD1)

Hệ thống quản lý, giám sát và điều phối công văn thời gian thực dành cho cơ quan hành chính. Tích hợp AI OCR và bảo mật đa tầng.

## 🌟 Tính năng chính (Giai đoạn 1)

- **Dashboard thông minh**: Giám sát tiến độ công văn 7-3-1 ngày với biểu đồ tương tác.
- **AI OCR (Industrial Edition)**: Tự động bóc tách thông tin văn bản (Số hiệu, Ngày tháng, Trích yếu...) với độ chính xác cao.
- **Quản lý Nhân sự (CRUD)**: Quản lý chi tiết hồ sơ cán bộ bao gồm Họ tên, Email, Số điện thoại và sơ đồ Phòng ban.
- **Bảo mật RBAC**: Phân quyền chặt chẽ 4 vai trò (Admin, Lãnh đạo, Văn thư, Cán bộ).
- **Bảo mật HTTPS**: Tích hợp sẵn chứng chỉ SSL mẫu cho Nginx, đảm bảo an toàn dữ liệu truyền tải.

## 🛠️ Hướng dẫn Cài đặt Hệ thống (Dành cho Admin)

### Bước 1: Chuẩn bị môi trường

- Cài đặt **Docker Desktop**.

### Bước 2: Khởi chạy Server

1. Mở terminal tại thư mục dự án.
2. Chạy lệnh:
   ```powershell
   docker-compose up -d --build
   ```
3. Hệ thống sẽ khởi chạy Backend, Nginx Proxy và Ngrok.

### Bước 3: Cấu hình Biến môi trường (.env)

Tạo file `.env` tại thư mục gốc với các thông số sau để đảm bảo tính ổn định và bảo mật:

```ini
# Bảo mật Token (Tối thiểu 32 ký tự)
JWT_SECRET=LinkStrategy_Secure_Key_2026_ReplaceMe

# Thông tin Push Notification (HTTPS là bắt buộc)
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

> [!IMPORTANT]
> **Yêu cầu HTTPS:** Thông báo đẩy (Web Push) chỉ hoạt động trên môi trường **HTTPS**. Nếu chạy local, hãy dùng `localhost`.

---

## 💻 Phát triển Frontend Vite React

Frontend mới nằm trong `ToolCalendar.Api/ClientApp` và build ra `ToolCalendar.Api/wwwroot` để backend .NET vẫn phục vụ static files như trước.
UI wrapper dùng **React 19**, **Tailwind CSS v4** và **shadcn/ui**; các màn nghiệp vụ legacy vẫn được nạp từ `wwwroot/js` và `wwwroot/partials`.

### Hot reload khi phát triển UI

Cách thuận tiện nhất là chạy backend bằng Docker, còn frontend chạy bằng Vite dev server trên máy host:

```powershell
docker compose up -d official-doc-backend nginx
cd ToolCalendar.Api/ClientApp
npm run dev
```

Mở frontend dev tại:

```text
http://localhost:5173/login.html
```

Backend Docker expose `http://localhost:59607`, và Vite đã proxy các route `/api`, `/notificationHub`, `/Uploads`, `/css`, `/assets`, `/partials`, `/sw.js` về backend này. Khi sửa file React/shadcn/Tailwind trong `ClientApp/src`, trình duyệt sẽ hot reload. Khi sửa legacy CSS/partials trong `wwwroot`, refresh trình duyệt là thấy thay đổi.

1. Chạy backend API:
   ```powershell
   dotnet run --project ToolCalendar.Api/ToolCalendar.Api.csproj
   ```
2. Cài dependencies frontend:
   ```powershell
   cd ToolCalendar.Api/ClientApp
   npm install
   ```
3. Chạy Vite dev server:
   ```powershell
   npm run dev
   ```
4. Nếu backend không chạy ở `http://localhost:59607`, đặt biến proxy trước khi chạy Vite:
   ```powershell
   $env:VITE_BACKEND_URL="https://localhost:59606"; npm run dev
   ```

Build production frontend thủ công:

```powershell
cd ToolCalendar.Api/ClientApp
npm run build
```

Docker production vẫn dùng:

```powershell
docker-compose up -d --build
```

---

## 🔑 Tài khoản Mặc định (Sau khi Seed)

Hệ thống được nạp sẵn dữ liệu mẫu (Seed Data) trong file `seed_db.sql` với các vai trò: **Admin**, **Lãnh đạo**, **Văn thư**, **Cán bộ**.

> [!WARNING]
> Thông tin tài khoản và mật khẩu mặc định **không được ghi công khai** ở đây vì lý do bảo mật. Liên hệ quản trị viên hệ thống để nhận thông tin đăng nhập ban đầu.
> **Bắt buộc thay đổi mật khẩu ngay sau lần đăng nhập đầu tiên.**

- **Địa chỉ truy cập nội bộ**: [https://localhost](https://localhost) hoặc IP của máy chủ (nếu đã cấu hình domain thì dùng domain thật).
---

## 📈 Quy trình làm việc

1. **Văn thư**: Đăng nhập -> Tải hồ sơ (PDF) -> Hệ thống tự động OCR -> Kiểm tra & Lưu thông tin -> Giao việc cho Cán bộ.
2. **Lãnh đạo**: Theo dõi Dashboard, giám sát dòng chảy công văn và các cảnh báo quá hạn.
3. **Cán bộ**: Nhận thông báo (Push/SignalR) -> Xử lý văn bản được giao -> Nộp bằng chứng hoàn thành.
4. **Admin**: Quản trị nhân sự, phòng ban, nhãn văn bản và các luật tự động của hệ thống.

---

## 🛡️ Tính năng Hardening (Vận hành ổn định)

Hệ thống đã được gia cố (hardened) để đạt tiêu chuẩn vận hành thực tế:

- **Database Concurrency (WAL Mode):** Cho phép bóc tách OCR và truy vấn Dashboard diễn ra song song mà không gây khóa cơ sở dữ liệu.
- **Silent Re-subscription:** Tự động sửa lỗi và đăng ký lại thông báo đẩy ngầm khi phát hiện thay đổi cấu hình máy chủ.
- **Rate Limiting:** Bảo vệ API khỏi các cuộc tấn công spam và quá tải (Giới hạn 50 req/10s).
- **Health Check Banner:** Cảnh báo trực quan ngay trên giao diện nếu trình duyệt đang chặn quyền thông báo.
- **Logic 7-3-1:** Tự động quét và nhắc việc vào các mốc 7-3-1 ngày trước hạn vào lúc **08:30 sáng** hàng ngày.
