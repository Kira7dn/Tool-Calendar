---
trigger: always_on
description: "Kiến trúc bắt buộc cho Backend ASP.NET Core — ADO.NET, ApiResponse, Middleware."
---

# TC-RULE-BACKEND-ARCHITECTURE

Quy tắc này định nghĩa các ràng buộc kiến trúc bắt buộc cho layer Backend của Tool-Calendar. AI Agent **phải** tuân thủ 100% — không có ngoại lệ.

## 1. Database Access — Chỉ ADO.NET

> [!IMPORTANT]
> Dự án này **NGHIÊM CẤM** Entity Framework. Mọi truy cập DB phải dùng ADO.NET/SqliteDataReader thủ công.

### Pattern đúng:
```csharp
// ✅ ĐÚNG — ADO.NET thủ công
using var conn = new SqliteConnection(_connectionString);
await conn.OpenAsync();
using var cmd = conn.CreateCommand();
cmd.CommandText = "SELECT * FROM Documents WHERE Id = @Id";
cmd.Parameters.AddWithValue("@Id", id);
using var reader = await cmd.ExecuteReaderAsync();
while (await reader.ReadAsync())
{
    // map fields manually
}
```

### Pattern sai:
```csharp
// ❌ SAI — Entity Framework
_context.Documents.Where(d => d.Id == id).ToListAsync();
// ❌ SAI — Dapper với code gen
await _conn.QueryAsync<Document>("SELECT ...");
```

### Quy tắc Query:
- Luôn dùng **parameterized queries** (`@Param`) — không bao giờ string interpolation.
- Mọi column JSON (như `AssignedUserIds`, `EvidencePaths`) phải serialize/deserialize thủ công qua `System.Text.Json`.
- Không dùng `SELECT *` — luôn liệt kê cột cụ thể.

### Quy tắc SQLite Transaction (Quan trọng):
- Mọi Transaction ghi (`connection.BeginTransaction()`) **phải hoàn toàn đồng bộ (Synchronous)**.
- **TUYỆT ĐỐI KHÔNG** dùng `await`, `ExecuteNonQueryAsync()`, `ExecuteScalarAsync()`, hay `ReadAsync()` bên trong block của `BeginTransaction()`. Chỉ dùng các hàm đồng bộ (`ExecuteNonQuery`, `ExecuteScalar`, `Read`) để đảm bảo Transaction nhả khóa nhanh nhất có thể.
- Mọi việc chuẩn bị bất đồng bộ (gọi mạng, I/O) phải làm xong TRƯỚC khi gọi `BeginTransaction()`.

---

## 2. API Response — Bắt buộc dùng `ApiResponse<T>`

> [!IMPORTANT]
> Mọi endpoint phải trả về `ApiResponse<T>` hoặc `ApiResponse` (non-generic). Không được trả về object thô, `IActionResult` raw, hoặc tự tạo response format riêng.

### Cách dùng đúng:
```csharp
// ✅ Thành công có data
return Ok(ApiResponse<DocumentDto>.Ok(data));

// ✅ Thành công không data  
return Ok(ApiResponse.Ok("Cập nhật thành công"));

// ✅ Lỗi nghiệp vụ
return BadRequest(ApiResponse.Fail("Tên đăng nhập đã tồn tại"));

// ✅ Không tìm thấy
return NotFound(ApiResponse.Fail($"Không tìm thấy document #{id}"));
```

### Cách dùng sai:
```csharp
// ❌ Trả về object thô
return Ok(new { id = 1, name = "..." });

// ❌ Tự tạo format
return Ok(new { success = true, data = document });

// ❌ Trả về exception message trực tiếp
return StatusCode(500, ex.Message);
```

---

## 3. Exception Handling — Dùng GlobalExceptionMiddleware

- `GlobalExceptionMiddleware` đã xử lý toàn bộ unhandled exception.
- **Không** wrap toàn bộ controller method bằng `try-catch` để log lỗi chung.
- **Dùng** `try-catch` cục bộ chỉ khi cần xử lý nghiệp vụ đặc thù (ví dụ: phân biệt lỗi DB constraint vs lỗi validation).

---

## 4. Business Rules — 7-3-1 Algorithm

Khi cần logic liên quan đến deadline công văn:
- **Đến hạn hôm nay (1 ngày)**: `ThoiHan.Date == DateTime.Today`
- **Sắp đến hạn (3-7 ngày)**: `ThoiHan.Date` trong khoảng `[Today+1, Today+7]`
- **Quá hạn**: `ThoiHan < DateTime.Today && Status != "Hoàn thành"`

Background job quét lúc **08:30** mỗi ngày — không thay đổi giờ này mà không hỏi.

---

## 5. Authentication & Authorization

- JWT token được đọc từ header `Authorization: Bearer <token>`.
- Mọi endpoint cần auth phải có `[Authorize]` attribute.
- Admin-only endpoint dùng `[Authorize(Policy = "AdminOnly")]` hoặc kiểm tra `Role == "Admin"` trong JWT claims.
- Rate limiting cho `/api/auth/login`: **5 requests/phút/IP** — đã config, không xóa.

---

## 6. Password Handling

Hệ thống hỗ trợ 2 loại hash (Legacy migration):
- **Legacy**: Plain-text (chỉ tồn tại trong DB cũ)
- **Modern**: BCrypt hoặc PBKDF2 (Identity format)

Khi user login đúng bằng Plain-text → **tự động rehash** sang BCrypt và ghi lại DB. Không xóa logic rehash này.

---
**Status:** ACTIVE  
**Priority:** LEVEL 1 — Ràng buộc kiến trúc cứng