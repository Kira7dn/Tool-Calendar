# TOOL-CALENDAR — AGENT CONSTITUTION (AGENTS.md)

Bạn là **AI Agent** đang làm việc trong dự án **Tool-Calendar** — Hệ thống Điều phối Công văn Nội bộ. Nhiệm vụ của bạn là thực thi các yêu cầu của Developer, tuân thủ nghiêm ngặt kiến trúc và các quy tắc dưới đây. Đọc tài liệu này **TRƯỚC KHI** thực hiện bất kỳ thay đổi nào.

---

## I. Nguyên Tắc Cốt Lõi (Core Principles)

1. **Context-First:** Luôn đọc `SYSTEM_FEATURES.md` và `COMMIT_LOG.md` ở thư mục gốc trước khi viết code mới hoặc sửa tính năng. Tuyệt đối không quét lại toàn bộ source khi thông tin đã có trong hai file này.
2. **Architecture-Integrity:** Tuyệt đối không dùng Entity Framework. Mọi truy vấn DB phải dùng ADO.NET/SqliteDataReader thô. Không tự ý đổi schema bảng mà không ghi lý do vào `COMMIT_LOG.md`.
3. **Evidence-Based:** Mọi thay đổi phải có dấu vết trong `COMMIT_LOG.md`. Không có entry = không có thay đổi hợp lệ.
4. **Response-Contract:** Mọi API endpoint **phải** trả về lớp `ApiResponse<T>` chuẩn hóa. Không được trả về object thô.
5. **Zero-Secret:** Tuyệt đối không commit API key, password, connection string, JWT secret vào Git. Dùng `.env` hoặc `appsettings.json` (không track bởi Git).
6. **Conventional-Commits:** Mọi commit message phải đúng chuẩn `<type>(<scope>): <mô tả>`. Xem Chốt Commit ở `CODE_QUALITY.md`.
7. **AI Behavior Standard:** AI phải tuân thủ nghiêm ngặt tiêu chuẩn code tinh gọn, bằng chứng toàn diện và giao tiếp cộc lốc theo chuẩn OpenClaw. Xem chi tiết tại `tc-rule-ai-behavior.md`.

---

## II. Stack Công Nghệ (Tech Stack — Bắt buộc tuân thủ)

| Lớp | Công nghệ | Ghi chú |
|---|---|---|
| **Backend** | ASP.NET Core 10.0, C# | MVC Controllers, không Minimal API |
| **Database** | SQLite + ADO.NET | **KHÔNG Entity Framework**, dùng `SqliteDataReader` |
| **Frontend** | React 19 + Vite + Tailwind CSS v4 + shadcn/ui | `fetch` API, không Axios |
| **Auth** | JWT Bearer Token | Header `Authorization: Bearer <token>` |
| **Queue/Realtime** | RabbitMQ + SignalR | OCR background jobs |
| **Security** | ClamAV, BCrypt/PBKDF2, Nginx | Rate limiting: 5 req/phút cho auth |
| **Containerization** | Docker + docker-compose | File DB mount tại `/app/data/` |

---

## III. Cấu trúc Thư mục Trọng yếu

```
Tool-Calendar/
├── .agents/                      ← [PROTECTED] Quy tắc AI
│   ├── AGENTS.md                 ← File này
│   ├── rules/                    ← Các rule chi tiết
│   ├── skills/                   ← Kỹ năng chuyên biệt
│   └── workflows/                ← Quy trình chuẩn
├── ToolCalendar.Api/
│   ├── Controllers/              ← API endpoints, dùng ApiResponse<T>
│   ├── Middleware/               ← GlobalExceptionMiddleware
│   ├── ClientApp/                ← React frontend
│   │   └── src/
│   │       ├── main.jsx          ← Global Fetch Interceptor ở đây
│   │       └── ...
│   └── Program.cs                ← DI registration, middleware pipeline
├── ToolCalendar.Core/
│   ├── Models/ApiResponse.cs     ← Response contract bắt buộc
│   ├── Data/Repositories/        ← ADO.NET queries
│   └── Services/                 ← Business logic, OCR services
├── ToolCalendar.Tests/           ← Unit tests bắt buộc
├── SYSTEM_FEATURES.md            ← [ĐỌC TRƯỚC] Bộ não hệ thống
├── COMMIT_LOG.md                 ← [CẬP NHẬT SAU MỖI THAY ĐỔI]
└── CODE_QUALITY.md               ← Tiêu chuẩn chất lượng code
```

---

## IV. Ma trận Quyền Hạn (Governance Matrix)

### ✅ Vùng Tự do (Có thể sửa đổi tự do)
- `ToolCalendar.Api/Controllers/` — Thêm/sửa API endpoint
- `ToolCalendar.Api/ClientApp/src/` — React components, pages, hooks
- `ToolCalendar.Core/Services/` — Business logic, services
- `ToolCalendar.Core/Data/Repositories/` — ADO.NET queries
- `ToolCalendar.Tests/` — Unit tests
- `docs/` — Tài liệu bổ sung

### ⚠️ Vùng Tinh chỉnh (Cẩn thận khi sửa — phải ghi COMMIT_LOG)
- `ToolCalendar.Api/Program.cs` — DI và middleware pipeline
- `ToolCalendar.Api/ClientApp/package.json` — Dependencies
- `docker-compose.yml` — Config containers
- `ToolCalendar.Core/Models/ApiResponse.cs` — Phải giữ nguyên contract

### 🚫 Vùng Cấm (Không được tự ý sửa)
- `.agents/rules/` — Các file rule trong thư mục này
- `.agents/workflows/` — Quy trình chuẩn
- `.githooks/` — Git hooks quality gates
- `SYSTEM_FEATURES.md` — Chỉ AI cập nhật khi có tính năng mới thật sự
- `seed_db.sql` — Dữ liệu mẫu gốc

> [!CAUTION]
> Nếu lỡ tay sửa vùng cấm, hãy dùng `git checkout <file>` để khôi phục ngay.

---

## V. Quy trình Hoạt động (Operational Workflow)

### Khi nhận yêu cầu mới:
1. **Bootstrap** → Đọc `SYSTEM_FEATURES.md` và `COMMIT_LOG.md`
2. **Assess** → Kiểm tra tính năng đã tồn tại chưa, tránh duplicate
3. **Implement** → Viết code tuân thủ Tech Stack và Architecture
4. **Test** → Thêm/cập nhật Unit Tests trong `ToolCalendar.Tests/`
5. **Log** → Cập nhật `COMMIT_LOG.md` với đầy đủ thông tin
6. **Commit** → Dùng đúng chuẩn Conventional Commits

### Khi debug/sửa lỗi:
1. Đọc `COMMIT_LOG.md` để hiểu ngữ cảnh thay đổi gần nhất
2. Trace từ Controller → Service → Repository theo luồng ADO.NET
3. Kiểm tra `GlobalExceptionMiddleware` nếu lỗi liên quan response format
4. Ghi sự cố và bản vá vào `COMMIT_LOG.md`

---

## VI. Decision Ladder

| Tình huống | Hành động |
|---|---|
| Refactor nội bộ, thêm helper method | Tự quyết + ghi COMMIT_LOG |
| Thêm dependency mới vào package.json/csproj | Ghi lý do vào COMMIT_LOG |
| Thay đổi DB schema (thêm cột, bảng mới) | Ghi lý do + migration SQL vào COMMIT_LOG |
| Thay đổi format `ApiResponse<T>` | Phải hỏi Developer trước — ảnh hưởng toàn hệ thống |
| Thêm JWT claim mới | Phải hỏi Developer — ảnh hưởng bảo mật |

---

**Status:** ACTIVE — TOOL-CALENDAR PROJECT RULES  
**Version:** 2.1 (Nâng cấp chuẩn OpenClaw)  
**Last Updated:** 2026-07-25  
**See also:** [SYSTEM_FEATURES.md](../SYSTEM_FEATURES.md) | [COMMIT_LOG.md](../COMMIT_LOG.md) | [CODE_QUALITY.md](../CODE_QUALITY.md) | [tc-rule-ai-behavior.md](rules/tc-rule-ai-behavior.md)
