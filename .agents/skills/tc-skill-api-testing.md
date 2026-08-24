---
name: tc-skill-api-testing
description: |
  Hướng dẫn AI Agent kiểm thử API endpoints của Tool-Calendar.
  Bao gồm cách test thủ công bằng curl/HTTPie và cách viết unit test C#.
---

# TC-SKILL-API-TESTING

Kỹ năng này cung cấp quy trình kiểm thử API của hệ thống Tool-Calendar.
Áp dụng khi: thêm endpoint mới, sửa logic, hoặc debug lỗi production.

---

## 1. Môi trường test

```bash
# Development (local)
BASE_URL=http://localhost:5000

# Docker
BASE_URL=http://localhost:8080

# Lấy token trước tiên (mọi request đều cần)
TOKEN=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' \
  | jq -r '.data.token')

echo "Token: $TOKEN"
```

---

## 2. Test từng nhóm endpoint

### Auth Endpoints

```bash
# Login
curl -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'

# Kết quả mong đợi:
# { "success": true, "data": { "token": "eyJ...", "user": {...} } }

# Get current user
curl -X GET $BASE_URL/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Change password
curl -X POST $BASE_URL/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword":"Admin@123","newPassword":"NewPass@456"}'
```

### Documents Endpoints

```bash
# Lấy danh sách (có phân trang)
curl -X GET "$BASE_URL/api/documents?page=1&pageSize=10&status=Chưa%20xử%20lý" \
  -H "Authorization: Bearer $TOKEN"

# Upload file
curl -X POST $BASE_URL/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "soVanBan=CV-001/2026" \
  -F "tenCongVan=Công văn test"

# Lấy chi tiết
curl -X GET $BASE_URL/api/documents/1 \
  -H "Authorization: Bearer $TOKEN"

# Cập nhật status
curl -X PUT $BASE_URL/api/documents/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"Đang xử lý"}'
```

### Admin Endpoints

```bash
# Lấy phòng ban
curl -X GET $BASE_URL/api/admin/departments \
  -H "Authorization: Bearer $TOKEN"

# Thêm phòng ban
curl -X POST $BASE_URL/api/admin/departments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Phòng IT","code":"IT"}'

# Lấy danh sách user
curl -X GET $BASE_URL/api/users \
  -H "Authorization: Bearer $TOKEN"
```

### Stats / Dashboard

```bash
# Dashboard 7-3-1
curl -X GET $BASE_URL/api/stats/dashboard \
  -H "Authorization: Bearer $TOKEN"

# Monthly report
curl -X GET "$BASE_URL/api/stats/monthly-report?month=7&year=2026" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. Kiểm tra ApiResponse contract

Mọi response phải theo format:

```json
// Thành công
{
  "success": true,
  "message": null,
  "data": { ... }
}

// Thất bại
{
  "success": false,
  "message": "Mô tả lỗi rõ ràng bằng tiếng Việt",
  "data": null
}
```

```bash
# Script kiểm tra nhanh format response
check_response() {
  local response=$1
  echo $response | jq 'has("success") and has("message") and has("data")'
  # Phải in ra: true
}
```

---

## 4. Unit Test C# (ToolCalendar.Tests)

### Template test cho Controller

```csharp
// ToolCalendar.Tests/Controllers/AdminControllerTests.cs
using Xunit;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Models;

public class AdminControllerTests
{
    [Fact]
    public void GetDepartments_ShouldReturnApiResponseOk()
    {
        // Arrange
        var controller = new AdminController();

        // Act
        var result = controller.GetDepartments() as OkObjectResult;

        // Assert
        Assert.NotNull(result);
        var response = result.Value as ApiResponse<object>;
        Assert.True(response?.Success);
    }

    [Fact]
    public void AddDepartment_NullInput_ShouldReturnBadRequest()
    {
        // Arrange
        var controller = new AdminController();

        // Act
        var result = controller.AddDepartment(null) as BadRequestObjectResult;

        // Assert
        Assert.NotNull(result);
        var response = result.Value as ApiResponse<object>;
        Assert.False(response?.Success);
        Assert.NotEmpty(response?.Message ?? "");
    }
}
```

### Chạy tests

```bash
# Chạy tất cả tests
dotnet test ToolCalendar.Tests/

# Chạy test cụ thể
dotnet test ToolCalendar.Tests/ --filter "FullyQualifiedName~AdminControllerTests"

# Xem coverage (nếu có)
dotnet test ToolCalendar.Tests/ --collect:"XPlat Code Coverage"
```

---

## 5. Checklist trước khi coi endpoint là "done"

- [ ] Endpoint trả về `ApiResponse<T>` đúng format
- [ ] Test với token hợp lệ → thành công
- [ ] Test không có token → `401 Unauthorized`
- [ ] Test với role không đủ quyền → `403 Forbidden`
- [ ] Test với input null/rỗng → `400 BadRequest` + message rõ ràng
- [ ] Test với id không tồn tại → `404` hoặc message rõ ràng
- [ ] Unit test đã được thêm vào `ToolCalendar.Tests/`

---

## 6. Debug lỗi phổ biến

| Lỗi | Nguyên nhân | Cách fix |
|---|---|---|
| `401 Unauthorized` | Token hết hạn hoặc sai | Đăng nhập lại lấy token mới |
| `403 Forbidden` | Role không đủ | Kiểm tra `[Authorize(Roles = "...")]` |
| `500 Internal Server Error` | Exception chưa bắt | Xem GlobalExceptionMiddleware log |
| Response không phải `ApiResponse` | Trả về object thô | Wrap bằng `ApiResponse.Ok(data)` |
| CORS error | Frontend gọi sai origin | Kiểm tra CORS config trong `Program.cs` |

---
**Status:** ACTIVE
**Scope:** Mọi API endpoint trong Tool-Calendar
**Trigger:** Sau khi thêm/sửa endpoint, hoặc khi debug
