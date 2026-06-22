---
description: "Quy trình chuẩn để thêm tính năng mới vào hệ thống Tool-Calendar."
---

# TC-WORKFLOW-NEW-FEATURE

Quy trình này hướng dẫn cách triển khai một tính năng mới một cách đúng chuẩn, đảm bảo không phá vỡ các tính năng hiện có.

## Bước 1 — Hiểu Yêu cầu

1. Đọc `SYSTEM_FEATURES.md` để nắm kiến trúc tổng thể.
2. Đọc `COMMIT_LOG.md` để biết thay đổi gần nhất.
3. Xác định tính năng mới thuộc module nào: `auth`, `docs`, `ocr`, `routing`, `stats`, `users`, `admin`, `notify`.
4. Kiểm tra xem tính năng tương tự đã tồn tại chưa để tránh duplicate logic.

## Bước 2 — Thiết kế (Design)

### Backend (nếu cần API mới):
1. Xác định endpoint: `METHOD /api/<resource>/<action>`
2. Xác định request body và response DTO.
3. Xác định DB query cần thiết.
4. Xác định Business Rules và validation.

### Frontend (nếu cần UI mới):
1. Xác định component cần tạo hoặc sửa.
2. Xác định state management cần thiết.
3. Xác định API calls cần thực hiện.

## Bước 3 — Implement Backend (nếu cần)

### 3.1 — Repository (ADO.NET)
```csharp
// Trong ToolCalendar.Core/Data/Repositories/
public async Task<T> GetSomethingAsync(int param)
{
    using var conn = new SqliteConnection(_connectionString);
    await conn.OpenAsync();
    // ... ADO.NET query
}
```

### 3.2 — Service (Business Logic)
```csharp
// Trong ToolCalendar.Core/Services/
public class NewFeatureService : INewFeatureService
{
    private readonly INewFeatureRepository _repo;
    // Inject qua constructor DI
}
```

### 3.3 — Đăng ký DI trong Program.cs
```csharp
// ToolCalendar.Api/Program.cs
builder.Services.AddScoped<INewFeatureService, NewFeatureService>();
builder.Services.AddScoped<INewFeatureRepository, NewFeatureRepository>();
```

### 3.4 — Controller
```csharp
// ToolCalendar.Api/Controllers/
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NewFeatureController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var data = await _service.GetAsync();
        return Ok(ApiResponse<List<NewFeatureDto>>.Ok(data)); // ✅ ApiResponse<T>
    }
}
```

## Bước 4 — Implement Frontend (nếu cần)

```jsx
// Trong ToolCalendar.Api/ClientApp/src/pages/ hoặc src/components/
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function NewFeaturePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/newfeature')
      .then(r => r.json())
      .then(result => {
        setData(result); // Interceptor đã unwrap .data
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Đang tải...</div>;
  
  return (
    <div className="p-6 space-y-4">
      {/* UI với Tailwind + shadcn/ui */}
    </div>
  );
}
```

## Bước 5 — Viết Unit Tests

```csharp
// Trong ToolCalendar.Tests/
public class NewFeatureTests
{
    [Fact]
    public void TestNewFeatureLogic_ValidInput_ReturnsExpected()
    {
        // Arrange
        // Act
        // Assert
    }
}
```

## Bước 6 — Cập nhật SYSTEM_FEATURES.md (nếu tính năng đáng kể)

Nếu tính năng mới thêm API endpoint hoặc business rule quan trọng:
- Thêm vào mục "3. Các API Endpoints Chính" trong `SYSTEM_FEATURES.md`.
- Thêm vào mục "4. Các Business Rules Trọng Yếu" nếu có logic nghiệp vụ mới.

## Bước 7 — Commit theo quy trình

Xem [`tc-workflow-git-push.md`](tc-workflow-git-push.md).

---
**Status:** ACTIVE  
**Use when:** Triển khai tính năng mới bất kỳ
