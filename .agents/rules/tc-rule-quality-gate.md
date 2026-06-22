---
trigger: on_demand
description: "Tiêu chí chấp nhận kỹ thuật (Quality Gate) trước khi commit hoặc deploy."
---

# TC-RULE-QUALITY-GATE

Quy tắc này định nghĩa **5 chốt chặn chất lượng** bắt buộc vượt qua trước khi commit code lên repository.

## 1. Sơ đồ Quality Gate

```
Developer / AI Agent
      │
      ▼
  git commit
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│                   PRE-COMMIT HOOK                       │
│                                                         │
│  Chốt 1: COMMIT_LOG.md đã được cập nhật?   ─── ❌ BLOCK │
│  Chốt 2: Có Secrets/Password hardcode?     ─── ❌ BLOCK │
│  Chốt 3: ESLint (React/JS chất lượng)?    ─── ❌ BLOCK │
│  Chốt 4: Prettier (định dạng JS/JSX)?     ─── ❌ BLOCK │
│  Chốt 5: dotnet format (chuẩn C#)?        ─── ❌ BLOCK │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────┐
│           COMMIT-MSG HOOK              │
│  Message đúng Conventional Commits?   │── ❌ BLOCK      │
└────────────────────────────────────────┘
      │
      ▼
   ✅ COMMIT THÀNH CÔNG
```

## 2. Chi tiết Từng Chốt

### Chốt 1 — COMMIT_LOG.md bắt buộc cập nhật
- **Lý do**: AI Agent session mới phải đọc được ngữ cảnh mà không cần quét code.
- **Cách pass**: Thêm entry mới vào `COMMIT_LOG.md` và `git add COMMIT_LOG.md`.
- **Xem thêm**: `tc-rule-commit-log.md`

### Chốt 2 — Quét Secrets & Hardcoded Passwords
- **Lý do**: Ngăn lộ credential lên GitHub (OWASP A02).
- **Cách pass**: Không có password/key/token hardcode trong code. Dùng `.env`.
- **Xem thêm**: `tc-rule-secret-management.md`

### Chốt 3 — ESLint
- **Lý do**: Đảm bảo code React không có bug ẩn.
- **Cách kiểm tra thủ công**:
  ```bash
  cd ToolCalendar.Api/ClientApp && npx eslint src/
  ```
- **Cách tự động sửa**:
  ```bash
  cd ToolCalendar.Api/ClientApp && npx eslint src/ --fix
  ```

### Chốt 4 — Prettier
- **Lý do**: Code format nhất quán — dễ review, dễ đọc.
- **Cách kiểm tra thủ công**:
  ```bash
  cd ToolCalendar.Api/ClientApp && npx prettier --check .
  ```
- **Cách tự động sửa**:
  ```bash
  cd ToolCalendar.Api/ClientApp && npx prettier --write .
  ```

### Chốt 5 — dotnet format
- **Lý do**: C# code tuân thủ Microsoft Coding Conventions và Roslyn Analyzers.
- **Cách kiểm tra**:
  ```bash
  dotnet format --verify-no-changes
  ```
- **Cách tự động sửa**:
  ```bash
  dotnet format
  ```

## 3. Unit Tests — Yêu cầu với tính năng mới

Mọi tính năng mới hoặc logic quan trọng phải có Unit Test tương ứng trong `ToolCalendar.Tests/`:
```bash
# Chạy toàn bộ test
dotnet test ToolCalendar.Tests/

# Xem coverage (nếu được cài)
dotnet test --collect:"XPlat Code Coverage"
```

**Các module bắt buộc phải có test:**
- Password hash/verify logic (`AuthPasswordHashTests.cs`)
- OCR regex parsing (`OcrTextRegexTests.cs`)
- Bất kỳ service nào có logic nghiệp vụ phức tạp

## 4. Tự Kiểm tra Trước Khi Commit (AI Agent Checklist)

Trước khi tạo commit, AI Agent phải tự hỏi:
- [ ] Tôi đã cập nhật `COMMIT_LOG.md` chưa?
- [ ] Code có hardcode password/secret nào không?
- [ ] `console.log` và `debugger` đã bị xóa chưa?
- [ ] Mọi API endpoint mới có dùng `ApiResponse<T>` không?
- [ ] Mọi DB query có dùng parameterized query không?
- [ ] Commit message có đúng Conventional Commits không?

---
**Status:** ACTIVE  
**Priority:** LEVEL 1 — Bắt buộc với mọi commit
**See also:** `CODE_QUALITY.md` ở thư mục gốc dự án
