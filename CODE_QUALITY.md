# Code Quality & Commit Rules — Hệ thống Điều phối Công văn

Tài liệu này mô tả toàn bộ quy tắc và tiêu chuẩn chất lượng code được áp dụng trong dự án.

---

## Kiến trúc Cổng Kiểm duyệt (Quality Gates)

Mọi lần `git commit` đều phải vượt qua **4 chốt chặn** tự động. Nếu bất kỳ chốt nào thất bại, commit sẽ bị từ chối.

```
Developer / AI
      │
      ▼
  git commit
      │
      ▼
┌─────────────────────────────────────────────────────┐
│             PRE-COMMIT HOOK                         │
│                                                     │
│  Chốt 1: Có Secrets/Password cứng không?  ─── ❌ BLOCK
│  Chốt 2: ESLint (JS/React chất lượng)?    ─── ❌ BLOCK
│  Chốt 3: Prettier (định dạng code)?       ─── ❌ BLOCK
│  Chốt 4: dotnet format (chuẩn C#)?        ─── ❌ BLOCK
└─────────────────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────┐
│          COMMIT-MSG HOOK             │
│                                      │
│  Message đúng chuẩn Conventional     │
│  Commits không? (feat/fix/docs...)   │── ❌ BLOCK
└──────────────────────────────────────┘
      │
      ▼
   ✅ COMMIT THÀNH CÔNG
```

---

## Chi tiết Từng Chốt

### Chốt 1 — Quét Secrets & Hardcoded Passwords
- **Lý do**: Ngăn chặn rò rỉ thông tin bảo mật lên Git repository.
- **Cách pass**: Không được có mật khẩu, API key, token cứng trong code. Hãy dùng biến môi trường (`.env`).
- **Tham chiếu**: OWASP A02 — Cryptographic Failures, SonarQube rule S2068.

### Chốt 2 — ESLint (JavaScript/React)
- **Lý do**: Đảm bảo code React không có bug ẩn và tuân thủ best practices.
- **Quy tắc chính**:
  - Bắt buộc `===` thay vì `==`
  - Cấm `var`, dùng `const`/`let`
  - Cấm `eval()`, `new Function()`
  - Cấm để `console.log` trong code
  - Cấm để `debugger`
  - Cảnh báo thiếu `key` trong list render
  - Bắt buộc tuân thủ Rules of Hooks
- **Cách pass**: Chạy `cd ToolCalendar.Api/ClientApp && npx eslint src/` để kiểm tra trước.
- **Tham chiếu**: ESLint Recommended, React Best Practices.

### Chốt 3 — Prettier (Định dạng code)
- **Lý do**: Đảm bảo toàn bộ code JS/JSX trong dự án có định dạng nhất quán (indent, dấu chấm phẩy, nháy đơn...).
- **Cách pass**: Chạy `cd ToolCalendar.Api/ClientApp && npx prettier --write .` trước khi commit.
- **Config**: Xem file `.prettierrc` trong thư mục `ClientApp`.

### Chốt 4 — dotnet format (C#)
- **Lý do**: Đảm bảo code C# tuân thủ Microsoft C# Coding Conventions và Roslyn Analyzers.
- **Cách pass**: Chạy `dotnet format` ở thư mục gốc để tự động sửa trước khi commit.
- **Tham chiếu**: Microsoft C# Coding Conventions, .editorconfig.

---

## Quy tắc Commit Message (Conventional Commits)

Format bắt buộc:
```
<type>(<scope>): <mô tả ngắn gọn>
```

| Type | Khi nào dùng |
|---|---|
| `feat` | Thêm tính năng mới |
| `fix` | Sửa lỗi |
| `docs` | Cập nhật tài liệu |
| `style` | Thay đổi giao diện, CSS |
| `refactor` | Tái cấu trúc code, không thay đổi logic |
| `perf` | Tối ưu hiệu năng |
| `test` | Thêm/sửa test |
| `chore` | Cập nhật config, build |

**Ví dụ HỢP LỆ:**
```
feat(upload): thêm hỗ trợ quét OCR nhiều trang
fix(auth): sửa lỗi khóa tài khoản khi đổi mật khẩu
docs: cập nhật SYSTEM_FEATURES.md thêm mô tả Chat
```

**Ví dụ BỊ CHẶN:**
```
update code
fix bug
sửa lỗi
```

---

## Lệnh Hữu ích

```sh
# Kiểm tra ESLint
cd ToolCalendar.Api/ClientApp && npx eslint src/

# Tự động sửa lỗi định dạng Prettier
cd ToolCalendar.Api/ClientApp && npx prettier --write .

# Tự động sửa chuẩn code C#
dotnet format

# Cài dev dependencies lần đầu
cd ToolCalendar.Api/ClientApp && npm install
```

---

## Thư mục `scripts/`

Các script tiện ích và script deploy nằm trong thư mục `scripts/` ở thư mục gốc:

| File | Mục đích |
|---|---|
| `deploy_gateway.sh` | Script deploy API Gateway |
| `deploy_to_vnpt.sh` | Script deploy lên máy chủ VNPT |
| `gen_jwt.py` | Script sinh JWT token thủ công để test |
| `test_regex.cs` / `test_regex.py` | Script kiểm tra regex phân tích công văn |
| `fix_cqdt_parser.cs` | Script sửa lỗi parser CQDT |

> **Lưu ý:** Đây là các script tiện ích nội bộ, **không phải** là file mã nguồn của ứng dụng.
