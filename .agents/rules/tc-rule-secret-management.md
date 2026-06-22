---
trigger: always_on
description: "Chính sách bảo mật — cấm secrets trong Git, quản lý credential và dependency."
---

# TC-RULE-SECRET-MANAGEMENT

Quy tắc này bảo vệ toàn bộ secrets, credentials và dependency surface trong dự án Tool-Calendar.

## 1. Tuyệt đối không commit Secret vào Git

> [!CAUTION]
> Đây là quy tắc ZERO-TOLERANCE. Vi phạm một lần có thể gây lộ thông tin sản xuất.

**Không được commit:**
- JWT Secret key
- Password bất kỳ (admin, DB, test)
- Connection string thật
- API key của bên thứ 3
- File `.env`, `.env.local`, `.env.production`
- Private certificate (`.pem`, `.p12`, `.pfx`, `.key`)
- ClamAV socket path production
- RabbitMQ credentials thật

**Thay vào đó, dùng:**
```bash
# appsettings.json (chỉ chứa placeholder, không chứa giá trị thật)
{
  "Jwt": {
    "Key": "PLACEHOLDER_REPLACE_IN_ENV"
  }
}

# Biến môi trường trong Docker / docker-compose.override.yml (không track bởi Git)
JWT_SECRET=real_secret_here
```

## 2. File `.env.example` — Chỉ chứa Key Name

File `.env.example` phải có trong repo để hướng dẫn, nhưng chỉ chứa tên key và giá trị dummy:
```env
JWT_SECRET=your_jwt_secret_here
DB_PATH=/app/data/documents.db
RABBITMQ_URL=amqp://user:password@rabbitmq:5672
CLAMAV_HOST=localhost
```

Giá trị thật chỉ tồn tại trên server production hoặc trong máy local của Developer.

## 3. Dependency Policy

Khi thêm NuGet package (C#) hoặc npm package (React):
- Không xóa hoặc downgrade các security packages: `BCrypt.Net-Next`, `Microsoft.AspNetCore.Authentication.JwtBearer`.
- Không thêm package không rõ nguồn gốc mà không có lý do rõ ràng.
- Nếu package ảnh hưởng đến auth/crypto/security → ghi lý do vào `COMMIT_LOG.md`.
- Không thêm npm lifecycle scripts nguy hiểm: `preinstall`, `postinstall`, `prepare` nếu không có lý do.

## 4. Xử lý khi phát hiện Secret đã lộ

1. **Xóa ngay** khỏi code và commit fix.
2. **Revoke** key/password bị lộ ngay lập tức.
3. Nếu đã push lên remote: dùng `git filter-branch` hoặc `git-secrets` để xóa khỏi history.
4. **Ghi sự cố** vào `COMMIT_LOG.md` với mô tả đầy đủ.

## 5. Pre-commit Hook — Quét Secrets Tự động

Git hook `pre-commit` tại `.githooks/pre-commit` tự động quét các pattern sau trước mỗi commit:
- Password hardcode (OWASP A02 patterns)
- Token patterns (Bearer, API key formats)
- Private key headers (`-----BEGIN RSA PRIVATE KEY-----`)

Nếu hook báo lỗi, sửa ngay — **không được bypass** bằng `git commit --no-verify`.

---
**Status:** ACTIVE — ALWAYS ON  
**Priority:** LEVEL 1 — ZERO-TOLERANCE
