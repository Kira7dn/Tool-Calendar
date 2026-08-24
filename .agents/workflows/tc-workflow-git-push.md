---
description: "Quy trình chuẩn để commit và push code lên repository."
---

# TC-WORKFLOW-GIT-PUSH

Quy trình này là đường commit chuẩn bắt buộc cho mọi Developer và AI Agent trong dự án Cabinet.

## Bước 1 — Nạp Ngữ cảnh (Context Loading)

Trước khi bắt đầu bất kỳ thay đổi nào, đọc:
- [`SYSTEM_FEATURES.md`](../../SYSTEM_FEATURES.md) — Kiến trúc và Business Rules
- [`COMMIT_LOG.md`](../../COMMIT_LOG.md) — Lịch sử thay đổi gần nhất
- [`CODE_QUALITY.md`](../../CODE_QUALITY.md) — Tiêu chuẩn chất lượng

## Bước 2 — Cài đặt Git Hooks (Lần đầu tiên)

Git hooks phải được kích hoạt thủ công một lần:
```bash
# Từ thư mục gốc dự án
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
chmod +x .githooks/commit-msg
```

## Bước 3 — Kiểm tra Chất lượng Thủ công

Chạy trước khi commit để tránh bị chặn bởi hooks:

```bash
# Kiểm tra C# format
dotnet format --verify-no-changes

# Kiểm tra ESLint
cd Cabinet.Api/ClientApp && npx eslint src/

# Kiểm tra Prettier
cd Cabinet.Api/ClientApp && npx prettier --check .

# Chạy Unit Tests
dotnet test Cabinet.Tests/
```

**Nếu có lỗi, tự động sửa:**
```bash
dotnet format
cd Cabinet.Api/ClientApp && npx eslint src/ --fix && npx prettier --write .
```

## Bước 4 — Cập nhật COMMIT_LOG.md

Thêm entry mới vào đầu phần "Lịch sử" trong `COMMIT_LOG.md`:

```markdown
### [2026-MM-DD HH:MM] <Tóm tắt thay đổi>
- **Mô tả**: <Giải thích tại sao thay đổi, ngữ cảnh nghiệp vụ>
- **Tệp thay đổi**:
  - `path/to/file.cs` (Mới / Sửa đổi)
- **Lệnh git commit**: `git commit -m "feat(scope): mô tả"`
```

## Bước 5 — Stage và Commit

```bash
# Stage các file đã thay đổi
git add .

# Đảm bảo COMMIT_LOG.md được staged
git add COMMIT_LOG.md

# Commit với đúng Conventional Commits format
git commit -m "feat(docs): thêm tính năng tìm kiếm toàn văn"
# Nếu bị hook chặn, đọc error message và sửa theo hướng dẫn
```

## Bước 6 — Push và Deploy

```bash
# Push lên branch hiện tại
git push origin phonghopkhonggiayto

# Sau khi push, CHẠY LỆNH NÀY ĐỂ DEPLOY LÊN VNPT SERVER
./deploy_to_vnpt.sh
```

## Xử lý Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| `COMMIT_LOG.md chưa được cập nhật` | Quên thêm entry | Thêm entry và `git add COMMIT_LOG.md` |
| `ESLint errors` | Code JS có lỗi | `npx eslint src/ --fix` |
| `Prettier check failed` | Format sai | `npx prettier --write .` |
| `dotnet format issues` | C# format sai | `dotnet format` |
| `Secret detected` | Có credential trong code | Xóa secret, dùng `.env` |
| `Invalid commit message` | Sai Conventional Commits | Xem `tc-rule-conventional-commits.md` |

---
**Status:** ACTIVE  
**Mandatory for:** Mọi Developer và AI Agent làm việc trên dự án
