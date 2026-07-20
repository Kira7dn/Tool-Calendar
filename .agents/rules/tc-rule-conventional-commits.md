---
trigger: always_on
description: "Chuẩn Conventional Commits cho dự án Tool-Calendar — bắt buộc khi tạo commit."
---

# TC-RULE-CONVENTIONAL-COMMITS

Lịch sử Git là tài sản tri thức của dự án. Mọi commit phải tuân thủ chuẩn Conventional Commits để AI Agent và Developer có thể hiểu tiến độ mà không cần họp.

## 1. Cấu Trúc Commit Message

Format chuẩn:
```
<type>(<scope>): <mô tả ngắn gọn>
```

### Các `type` được phép:

| Type | Khi nào dùng |
|---|---|
| `feat` | Thêm tính năng mới cho người dùng |
| `fix` | Sửa lỗi kỹ thuật hoặc logic nghiệp vụ |
| `docs` | Chỉ thay đổi tài liệu (SYSTEM_FEATURES, COMMIT_LOG, README) |
| `style` | Thay đổi CSS/UI, không ảnh hưởng logic |
| `refactor` | Tái cấu trúc code, không thay đổi hành vi |
| `perf` | Tối ưu hiệu năng (query DB, caching) |
| `test` | Thêm hoặc sửa Unit Tests |
| `chore` | Cập nhật build, config, dependencies |
| `security` | Vá lỗi bảo mật, cập nhật auth/crypto |

### Các `scope` gợi ý (theo module):

| Scope | Ý nghĩa |
|---|---|
| `auth` | Xác thực, JWT, login/logout |
| `docs` | Documents — quản lý công văn |
| `ocr` | Luồng xử lý OCR + RabbitMQ |
| `routing` | Luân chuyển công văn |
| `stats` | Dashboard, báo cáo |
| `users` | Quản lý người dùng |
| `admin` | Phòng ban, nhãn, luật tự động |
| `notify` | Thông báo Push, SignalR |
| `api` | Thay đổi chung layer API |
| `db` | Thay đổi schema hoặc queries ADO.NET |
| `infra` | Docker, Nginx, CI/CD |
| `test` | Unit tests |

## 2. Quy Tắc Bắt Buộc

- Mô tả bắt đầu bằng **chữ thường**, không có dấu chấm ở cuối.
- Không viết mô tả mơ hồ: ~~`update`~~, ~~`fix bug`~~, ~~`done`~~, ~~`sửa lỗi`~~.
- Mô tả phải đủ nghĩa đọc một mình cũng hiểu được thay đổi.

## 3. Ví Dụ

**✅ HỢP LỆ:**
```
feat(ocr): thêm retry 3 lần khi PaddleOCR timeout
fix(auth): sửa lỗi BCrypt bị ghi đè rỗng khi update user info
refactor(docs): tách DocumentExtractorService thành Facade pattern
test(auth): thêm unit test kiểm tra PBKDF2 và BCrypt hash
chore(infra): cập nhật Dockerfile dùng .NET 10 runtime image
security(auth): tăng lockout lên 30 phút sau 5 lần đăng nhập sai
docs: cập nhật SYSTEM_FEATURES.md bổ sung mô tả Chat module
```

**❌ BỊ CHẶN BỞI commit-msg HOOK:**
```
update code
fix bug  
sửa lỗi
done task
wip
abc
```

## 4. Enforcement

Git hook `commit-msg` tại `.githooks/commit-msg` sẽ tự động chặn commit không đúng format. Nếu bị chặn, hãy chạy:
```bash
git commit --amend -m "feat(scope): mô tả đúng chuẩn"
```

---
**Status:** ACTIVE  
**Priority:** HIGH — Bắt buộc với mọi commit