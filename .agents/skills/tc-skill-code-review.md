---
name: tc-skill-code-review
description: |
  Hướng dẫn AI Agent tự review code trong dự án Tool-Calendar trước khi commit/push.
  Áp dụng cho mọi thay đổi ở Controller, Service, Repository và React component.
---

# TC-SKILL-CODE-REVIEW

Kỹ năng này giúp AI Agent tự kiểm tra chất lượng code theo chuẩn dự án Tool-Calendar
trước khi commit. Chạy checklist này sau mỗi thay đổi code, trước khi cập nhật COMMIT_LOG.md.

---

## 1. Checklist Backend (C# / ASP.NET Core)

### 1.1 API Response Contract
- [ ] Mọi endpoint đều trả về `ApiResponse<T>` — không trả object thô
- [ ] Dùng `ApiResponse.Ok(data)` cho thành công
- [ ] Dùng `ApiResponse.Fail("message")` cho lỗi nghiệp vụ
- [ ] Không để exception leak ra ngoài (GlobalExceptionMiddleware đã xử lý)

```csharp
// ✅ Đúng
return Ok(ApiResponse.Ok(result));
return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ."));

// ❌ Sai
return Ok(result);
return BadRequest("error");
```

### 1.2 Database / ADO.NET
- [ ] Không sử dụng Entity Framework — chỉ dùng `SqliteDataReader` thô
- [ ] Mọi query đều dùng parameterized SQL (chống SQL Injection)
- [ ] Connection được đóng trong `using` block
- [ ] Không thay đổi schema bảng mà không ghi vào COMMIT_LOG.md

```csharp
// ✅ Đúng
using var cmd = new SqliteCommand("SELECT * FROM Users WHERE Id = @id", conn);
cmd.Parameters.AddWithValue("@id", userId);

// ❌ Sai
var cmd = new SqliteCommand($"SELECT * FROM Users WHERE Id = {userId}", conn);
```

### 1.3 Authorization
- [ ] Controller class có `[Authorize]`
- [ ] Các endpoint nhạy cảm có `[Authorize(Roles = "Admin")]`
- [ ] Không để endpoint public mà không có lý do

### 1.4 Null Checks
- [ ] Kiểm tra null cho input từ `[FromBody]`
- [ ] Kiểm tra tồn tại record trước khi update/delete

---

## 2. Checklist Frontend (React / TypeScript)

### 2.1 API Calls
- [ ] Dùng `fetch` API — không dùng Axios
- [ ] Header `Authorization: Bearer <token>` được gửi đúng
- [ ] Xử lý response: kiểm tra `response.success` trước khi dùng `response.data`
- [ ] Có error handling (try/catch hoặc `.catch()`)

```jsx
// ✅ Đúng
const res = await fetch('/api/documents', {
  headers: { Authorization: `Bearer ${token}` }
});
const json = await res.json();
if (!json.success) throw new Error(json.message);
setData(json.data);

// ❌ Sai
const data = await fetch('/api/documents').then(r => r.json());
setData(data); // Không kiểm tra success
```

### 2.2 Components
- [ ] Component có PropTypes hoặc TypeScript interface
- [ ] Không hardcode text tiếng Anh trong UI (dự án dùng tiếng Việt)
- [ ] Loading state được hiển thị khi đang fetch
- [ ] Error state được hiển thị khi fetch thất bại

### 2.3 Tailwind CSS v4 / shadcn/ui
- [ ] Dùng shadcn/ui components khi có sẵn, không tự tạo lại
- [ ] Responsive design: mobile-first

---

## 3. Checklist Bảo mật

- [ ] Không có API key, password, JWT secret trong code
- [ ] File upload: kiểm tra MIME type, không chỉ extension
- [ ] Không log thông tin nhạy cảm (password, token)
- [ ] Không commit file `.env` thật

---

## 4. Checklist Business Rules

Đối chiếu với `SYSTEM_FEATURES.md` section 4:

- [ ] **Thuật toán 7-3-1**: Logic deadline dùng đúng timezone (UTC+7)
- [ ] **OCR Flow**: Sau upload phải bắn message vào RabbitMQ
- [ ] **Password rehash**: Sau login bằng plain-text phải tự động nâng cấp lên BCrypt
- [ ] **Routing**: Phân biệt giao cho Phòng ban (DepartmentId) vs Cán bộ (AssignedTo)

---

## 5. Cách Chạy Review

```bash
# 1. Xem diff những gì thay đổi
git diff --stat

# 2. Kiểm tra C# format
dotnet format --verify-no-changes

# 3. Kiểm tra ESLint (nếu có thay đổi frontend)
cd ToolCalendar.Api/ClientApp && npx eslint src/ --max-warnings 0

# 4. Build để bắt lỗi compile
dotnet build

# 5. Chạy tests
dotnet test ToolCalendar.Tests/
```

Nếu tất cả pass → tiến hành cập nhật `COMMIT_LOG.md` và commit.

---
**Status:** ACTIVE
**Scope:** Mọi thay đổi code trong Tool-Calendar
**Trigger:** Trước mỗi commit
