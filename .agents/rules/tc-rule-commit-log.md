---
trigger: always_on
description: "Quy tắc bắt buộc cập nhật COMMIT_LOG sau mỗi thay đổi mã nguồn."
---

# TC-RULE-COMMIT-LOG

Quy tắc này bắt buộc AI Agent phải duy trì `COMMIT_LOG.md` như một **nguồn sự thật** về lịch sử thay đổi, giúp AI session mới không cần quét lại toàn bộ codebase.

## 1. Điều Kiện Kích Hoạt (Always On)

Quy tắc này áp dụng **bắt buộc** sau bất kỳ hành động nào thuộc các loại:
- Thêm tính năng mới (feature)
- Sửa lỗi (bug fix)
- Refactor code
- Thay đổi cấu hình (config, docker, githooks)
- Cập nhật dependencies

## 2. Format Entry Bắt buộc

Mỗi entry trong `COMMIT_LOG.md` phải có đầy đủ 4 trường:

```markdown
### [YYYY-MM-DD HH:MM] <Tóm tắt hành động>
- **Mô tả**: <Giải thích ngắn gọn tại sao thay đổi, bối cảnh nghiệp vụ>
- **Tệp thay đổi**:
  - `path/to/file1.cs` (Mới / Sửa đổi / Xóa)
  - `path/to/file2.jsx` (Mới / Sửa đổi / Xóa)
- **Lệnh git commit**: `git commit -m "feat(scope): mô tả"`
```

## 3. Quy tắc Nội dung

- **Mô tả** phải giải thích *tại sao* — không chỉ *cái gì*. Ví dụ: "Sửa lỗi hash BCrypt bị ghi đè rỗng khi update user" thay vì "Sửa UserRepository".
- **Tệp thay đổi** phải liệt kê *mọi* file bị ảnh hưởng, kể cả file test và config.
- **Lệnh git commit** phải đúng chuẩn Conventional Commits (xem `tc-rule-conventional-commits.md`).

## 4. Cấm

- Không được bỏ qua việc cập nhật `COMMIT_LOG.md` dù thay đổi nhỏ.
- Không được ghi entry mơ hồ như "cập nhật code", "fix lỗi", "sửa bug".
- Không được gộp nhiều tính năng không liên quan vào một entry.

---
**Status:** ACTIVE — ALWAYS ON  
**Priority:** LEVEL 1 — Bắt buộc không ngoại lệ
