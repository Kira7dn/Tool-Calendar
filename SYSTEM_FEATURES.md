# Tài Liệu Hệ Thống Điều Phối Công Văn (Dành cho AI & Developer)

> **Phiên bản**: 2.0 · **Cập nhật**: 23/08/2026 · **Nhánh**: `develop`
> **Tài liệu đầy đủ**: xem `docs/legacy/ARCHITECTURE.md` để biết chi tiết kỹ thuật toàn diện.

Tài liệu này là **"Bộ não"** của hệ thống. AI Agent phải đọc file này **TRƯỚC** khi sửa code để tránh phá vỡ logic cũ.

---

## 1. Kiến Trúc Tổng Quan

### 1.1. Stack Công nghệ

| Lớp | Công nghệ | Ghi chú |
|---|---|---|
| **Frontend** | React 19 + Vite + Tailwind CSS v4 + shadcn/ui | SPA, build ra `wwwroot`, PWA (`vite-plugin-pwa`) |
| **Realtime client** | `@microsoft/signalr` | WebSocket, fallback SSE |
| **Backend** | ASP.NET Core 10 (MVC Controllers) | 2 project: `Api` (host) + `Core` (domain/data) |
| **Data access** | **ADO.NET thuần** (`Microsoft.Data.Sqlite`) | **KHÔNG dùng EF Core** — SQL tay |
| **Database** | SQLite | file `documents.db`, `journal_mode=DELETE`, `Cache=Shared` |
| **Message queue** | RabbitMQ | queue `ocr_document_queue`, durable, prefetch 8 |
| **AI service** | FastAPI + Uvicorn (Python 3.11) | 1 worker, chia sẻ global state qua `app.state` |
| **Embedding** | `paraphrase-multilingual-MiniLM-L12-v2` | 384 dims, CPU |
| **Rerank** | `cross-encoder/ms-marco-MiniLM-L-2-v2` | CrossEncoder 2-stage |
| **Extract** | Docling + pypdf | table/heading-aware parse |
| **LLM** | Ollama `qwen2.5:3b` | chạy trên **host**, không container |
| **AV** | ClamAV | container riêng, TCP INSTREAM port 3310 |
| **Gateway** | Nginx alpine | compose độc lập (`gateway/`), TLS wildcard `*.vpdtcampha.vn` |

### 1.2. Container Topology (VNPT Server: 14.225.172.225)

```
gateway/ (docker-compose độc lập)
  └── nginx-proxy          :80/:443 — DÙNG CHUNG, phục vụ nhiều subdomain

Tool-Calendar/ (docker-compose chính)
  ├── official-doc-backend  :5000 (host :59607) — .NET 10 backend
  ├── python-ai-service     :8001 (expose only, KHÔNG map host port)
  ├── rabbitmq              :5672 (mgmt :15672)
  ├── clamav                :3310 (internal)
  └── uptime-kuma           :3001
```

> ⚠️ **PRODUCTION-SAFETY**: KHÔNG chạy `docker compose down`. Chỉ restart service cụ thể.

### 1.3. Cấu trúc Python AI Service (sau refactor v3.0)

```
python-ai-service/
├── main.py              # Chỉ chứa: FastAPI app, lifespan, include_router
├── config.py            # Pydantic Settings
├── exceptions.py        # AiClientError, AiServerError
├── api/
│   ├── router.py        # Master router (đăng ký tất cả sub-routers)
│   ├── embed.py         # POST /api/embed, /api/embed/batch, /api/cache/stats|clear
│   ├── rag.py           # POST /api/compress, /api/chunk, /api/rerank, /api/hybrid-search
│   ├── document.py      # POST /api/extract, /api/extract-fast, /api/extract-metadata, /api/extract-keywords
│   ├── llm.py           # POST /api/chat, /api/doc-summary, /api/hyde, /api/contextual-chunk, /api/parse-date, /api/generate-qa
│   └── exception_handler.py
├── services/
│   ├── embed_service.py
│   ├── rag_service.py
│   ├── document_service.py
│   └── llm_service.py
├── schemas/             # Pydantic models (embed, rag, document, llm)
├── embeddings/          # AsyncBatchEmbedder, SemanticEmbedder
├── llm_provider/        # OllamaClient, ChatQueueManager, RadixPrefixCache
├── rag/                 # SmartTextChunker, ContextCompressor, HybridRetriever, CrossEncoderReranker, DoclingExtractor
└── utils/
```

---

## 2. Database Schema

> **Quan trọng**: Dùng ADO.NET thô. Mọi thay đổi schema phải chạy SQL tay và ghi vào `COMMIT_LOG.md`.

### `Users` (Người dùng)
```sql
Id, Username (UK), PasswordHash, FullName, Email, PhoneNumber,
Role TEXT -- 'Admin'|'LanhDao'|'VanThu'|'CanBo'
DepartmentId, SessionId, SecurityStamp, NormalizedUserName,
AccessFailedCount, LockoutEnd, LockoutEnabled,
FailedLoginCount (legacy), LockoutUntil (legacy), CreatedAt
```

### `Documents` (Công văn)
```sql
Id, SoVanBan, TenCongVan, TrichYeu,
FullText,           -- toàn văn Docling/OCR
OcrPagesJson,       -- JSON pages
NgayBanHanh, CoQuanBanHanh, CoQuanChuQuan,
ThoiHan,            -- DEADLINE cho thuật toán 7-3-1
DonViChiDao, FilePath, ContentHash,  -- SHA-256 chống trùng
Status TEXT,        -- 'Chưa xử lý'|'Đang xử lý'|'Hoàn thành'|'Lỗi OCR'
Priority TEXT,      -- 'Thường'|'Khẩn'|'Hỏa tốc'
DepartmentId, AssignedTo,
AssignedUserIds TEXT,       -- JSON array "[1,2,3]"
AssignedDepartmentIds TEXT, -- JSON array
EvidencePaths TEXT,         -- JSON array
EvidenceNotes, CompletionDate,
LabelId, NgayThem, UpdatedAt,
DaTaoLich, UploadedByUserId
```

### `DocumentRoutings` (Luân chuyển)
```sql
Id, DocumentId, SenderId, ReceiverId, ParentRoutingId,
ActionType TEXT,  -- 'Chủ trì'|'Phối hợp'
Note, Status, ProcessingContent, CreatedAt, UpdatedAt
```

### `DocumentChunks` (RAG Vector Index)
```sql
Id, DocumentId, ChunkIndex,  -- -1=summary; pIndex; pIndex*1000+cIndex
TextContent, VectorJson,     -- float[384] JSON
ParentChunkId                -- NULL=summary/parent; id=child chunk
```
> ⚠️ Bảng này **KHÔNG** có trong `DatabaseService.Initialize()` — phải chạy `data_dump/migration_document_chunks.sql` tay khi deploy mới.

### `Comments` & `CommentReactions`
```sql
-- Comments: Id, DocumentId, UserId, Username, Content, AttachmentPaths, CreatedAt
-- CommentReactions: CommentId, UserId, ReactionType (UNIQUE CommentId+UserId+Reaction)
```

### `Departments`, `Labels`, `AutoRules`
```sql
-- Departments: Id, Name, Code, ParentId (cây phòng ban)
-- Labels: Id, Name, Color
-- AutoRules: Id, LabelId, DepartmentId, Conditions (JSON), Actions (JSON)
```

### `AiSemanticCache` (GPTCache pattern)
```sql
Id, QuestionVectorJson, Response, CreatedAt, LastAccessedAt, HitCount
-- LRU 500 bản ghi, cosine threshold 0.85
```
> ⚠️ **R-01**: Cache KHÔNG có cột `UserId` — rò rỉ dữ liệu xuyên user!

### `UserMemories`, `ChatMessages`, `Reminders`
```sql
-- UserMemories: Id, UserId, Content, VectorJson
-- ChatMessages: Id, UserId, Role ('user'|'assistant'|'tool'), Content, CreatedAt
-- Reminders: Id, UserId, Content, RemindAt, IsSent, CreatedAt
```
> ⚠️ `UserMemories` cũng KHÔNG trong `Initialize()` — chạy SQL tay.

### `PushSubscriptions`, `Notifications`, `AuditLogs`, `AppSettings`
```sql
-- PushSubscriptions: Id, UserId, Endpoint (UK), P256dh, Auth, CreatedAt
-- Notifications: Id, UserId, Title, Body, Data, IsRead, CreatedAt
-- AuditLogs: Id, UserId(nullable), Action, Timestamp, IpAddress, UserAgent, IsSuccess, FailReason
-- AppSettings: Key (PK), Value
```

**AppSettings runtime quan trọng**: `Vapid_PublicKey`, `Vapid_PrivateKey`, `Notification_ScanTime` (mặc định `08:30`), `Notification_LastScanDate`, `Document_DeadlineKeywords`, `Document_DeadlineExcludeKeywords`, `AiSimilarityThreshold`.

---

## 3. API Endpoints

### 3.1. Backend .NET (`/api`)

| Controller | Endpoint | Method | Quyền |
|---|---|---|---|
| **Auth** | `/auth/login` | POST | Anonymous + rate limit 5/60s/IP |
| | `/auth/refresh` | POST | cookie `refresh_cookie` |
| | `/auth/logout` | POST | — |
| | `/auth/change-password` | POST | `[Authorize]` |
| **Documents** | `/documents` | GET | 4 role |
| | `/documents/upload` | POST | Admin, VanThu |
| | `/documents/{id}` | GET/PUT/DELETE | 4 role / Admin |
| | `/documents/{id}/reindex` | POST | authenticated |
| | `/documents/{id}/status` | PUT | authenticated |
| | `/documents/{id}/assign` | POST | authenticated |
| | `/documents/{id}/submit-evidence` | POST | Admin, CanBo |
| | `/documents/{id}/file` | GET | 4 role (token header/cookie/query) |
| | `/documents/{id}/comments` | GET/POST | 4 role |
| | `/documents/my-tasks` | GET | 4 role |
| | `/documents/public-schedule` | GET | **AllowAnonymous** |
| **Routings** | `/documents/{id}/routings` | GET/POST | authenticated |
| | `/routings/{id}/reject` | PUT | authenticated |
| | `/routings/{id}/status` | PUT | authenticated |
| **Stats** | `/stats` | GET | 4 role (MemoryCache) |
| | `/stats/activities` | GET | 4 role |
| | `/stats/deadline-series` | GET | 4 role |
| | `/stats/monthly-report` | GET | 4 role |
| | `/stats/settings` | GET/POST | Admin, VanThu |
| **Users** | `/users` | GET | 4 role |
| | `/users/{id}` | GET/PUT/DELETE | Admin |
| **Admin** | `/admin/departments` | GET/POST/PUT/DELETE | GET: 4 role; Write: Admin |
| | `/admin/labels`, `/admin/rules` | GET/POST/DELETE | Admin |
| | `/admin/audit-logs` | GET/POST | Admin |
| **Notification** | `/notification` | GET | authenticated |
| | `/notification/vapid-public-key` | GET | **AllowAnonymous** |
| | `/notification/subscribe` | POST | authenticated |
| | `/notification/trigger-scan` | POST | Admin, VanThu |
| **Chat** | `/chat/history` | GET/DELETE | authenticated |
| | `/chat/message` | POST | authenticated · SSE `text/event-stream` |
| **Backup** | `/backup/export` | GET | Admin |
| **Hạ tầng** | `/health` | GET | Anonymous |
| | `/notificationHub` | WS | JWT qua query `access_token` |

### 3.2. Python AI Service (`:8001`, chỉ nội bộ Docker)

| Endpoint | Method | Chức năng |
|---|---|---|
| `/health` | GET | status + model + radix cache + chat queue |
| `/api/cache/stats` | GET | RadixTree cache stats |
| `/api/cache/clear` | DELETE | Xóa embedding cache |
| `/api/embed` | POST | Embed 1 text, L2 normalize, RadixCache |
| `/api/embed/batch` | POST | Batch embed, tối đa 100 texts |
| `/api/chunk` | POST | SmartTextChunker với metadata header |
| `/api/contextual-chunk` | POST | Contextual Retrieval (Anthropic) |
| `/api/compress` | POST | RAG 3 bước: cosine → hybrid → cross-encoder |
| `/api/hybrid-search` | POST | BM25 0.3 + semantic 0.7 |
| `/api/rerank` | POST | CrossEncoder rerank, score threshold 0.1 |
| `/api/extract` | POST | Docling full parse (table + heading) |
| `/api/extract-fast` | POST | pypdf native text (~0.1s) |
| `/api/extract-metadata` | POST | LLM + regex fallback bóc tách trường công văn |
| `/api/extract-keywords` | POST | Sinh từ khóa tìm kiếm |
| `/api/doc-summary` | POST | RAPTOR document summary + vector |
| `/api/generate-qa` | POST | Sinh QA pairs từ chunk |
| `/api/hyde` | POST | Hypothetical Document Embeddings |
| `/api/parse-date` | POST | Parse ngày tiếng Việt tự nhiên |
| `/api/chat` | POST | Stream chat qua Ollama (queue FCFS ≤4) |

---

## 4. Business Rules Trọng Yếu

### 4.1. Thuật toán 7-3-1 (Dashboard & Thông báo)

Job Background `DeadlineWorker` quét lúc **08:30** mỗi ngày (cấu hình trong `AppSettings.Notification_ScanTime`):

- **Còn 7/3/1/0 ngày**: gửi thông báo cho `AssignedTo` (hoặc Admin id=1 nếu chưa giao)
- **Quá hạn**: `ThoiHan < DateTime.Today AND Status != 'Hoàn thành'`
- Chống chạy lặp: ghi `Notification_LastScanDate` ngay trước khi quét

> ⚠️ Worker chỉ thông báo cho `AssignedTo` (1 người) — KHÔNG fan-out theo `AssignedUserIds`/`AssignedDepartmentIds`.

### 4.2. Luồng Upload & OCR — Two-Speed Extraction

**Giai đoạn 1 — Upload đồng bộ (~100ms)**:
1. Kiểm tra null/empty → SHA-256 ContentHash → check trùng
2. Kiểm tra whitelist extension + magic bytes + size cap
3. ZipBomb detection (docx/xlsx)
4. Stream vào `Uploads/.quarantine/`
5. ClamAV TCP INSTREAM (fail-open nếu service down)
6. Strip EXIF/GPS metadata
7. Move `quarantine/ → Uploads/Documents/`
8. INSERT DB với `Status = "Đang xử lý"` (retry 15 lần, backoff 1.5^i)
9. Publish docId vào RabbitMQ (fallback: `Task.Run` nếu broker down)

**Giai đoạn 2 — OCR bất đồng bộ (Background)**:
- **Luồng nhanh (~0.1s)**: `POST /api/extract-fast` (pypdf) → nếu có text → `POST /api/extract-metadata` (LLM + regex) → UPDATE DB + Status = "Chưa xử lý" → **UI MỞ KHÓA**
- **Luồng nặng (2-3 phút)**: `POST /api/extract` (Docling) → UPDATE FullText → nếu file ảnh scan: extract-metadata lại

**Giai đoạn 3 — RAG Indexing (sau OCR)**:
1. `POST /api/doc-summary` → lưu chunk index=-1 (RAPTOR macro-chunk)
2. `POST /api/chunk` (parent: size=1500, overlap=150) — KHÔNG embed thật (vector toàn 0)
3. Với mỗi parent chunk:
   - `POST /api/chunk` (child: size=400, overlap=50) với context prefix `[Ngữ cảnh: title. Tóm tắt: summary]`
   - 2 parent đầu: `POST /api/generate-qa` → append QA vào child texts
   - `POST /api/embed/batch` → lưu vector thật vào `DocumentChunks`

### 4.3. Agent Loop Trợ lý AI (N-hop tool chain)

1. **Regex fast-path**: match "tìm ... công văn số X" → gọi tool ngay
2. **Semantic cache** (GPTCache): embed câu hỏi → tìm cache cosine ≥0.85 → trả ngay nếu hit
3. **Semantic routing**: so vector với route templates → gợi ý tool cho LLM
4. **RAG compress** (nếu có documentId): `POST /api/compress` → context string
5. **N-hop tool loop** (tối đa 5 hops):
   - Mỗi tool tối đa 2 lần (dedup guard)
   - Hop cuối bỏ `tools` để buộc LLM sinh text
6. **Stream response**: 50 ký tự/chunk → xử lý special tags ([REMINDER|...], [STORE_MEMORY|...])
7. **Lưu semantic cache** (LRU 500 bản ghi)

**5 AI Tools**: `get_document_stats`, `search_documents_by_condition`, `search_document_content` (RAG), `web_search` (Tavily), `chart_generator`

### 4.4. Vector Search (C# in-process)

`DocumentChunkRepository.FindSimilarChunksAsync`:
1. `SELECT` toàn bộ chunks → parse VectorJson → tính cosine (filter ≥ 0.20)
2. `FindByKeywordAsync` (LIKE)
3. Merge + TF-IDF cosine cho keyword → Hybrid score = 0.7·vector + 0.3·keyword
4. MMR diversification → mở rộng lên Parent chunk → top-K

> ⚠️ **R-04**: O(N) full-scan — với ~50k chunk sẽ chậm. Cần sqlite-vec/Qdrant trong tương lai.

### 4.5. Bảo mật — 6 Lớp

| Lớp | Cơ chế |
|---|---|
| Tầng 0 | TLS 1.2/1.3, HTTP→HTTPS 301, client_max_body_size 50M |
| Tầng 1 | Path-traversal filter, chặn `/uploads/*` → 403, CSP/XFO headers |
| Tầng 2 | RateLimiter: 50/10s global · 5/60s login · 1000/60s upload |
| Tầng 3 | JWT HS256 exp 8h + sec_stamp binding + Refresh token 7 ngày (HttpOnly cookie) |
| Tầng 4 | 7 Policy + `ActiveSessionRequirement` + file chỉ qua API có JWT |
| Tầng 5 | SHA-256 dedupe → whitelist → magic bytes → size → zip-bomb → ClamAV → strip EXIF → quarantine |
| Tầng 6 | no-new-privileges · mem/cpu limit · SQLite backup 6h giữ 28 bản · AuditLog |

### 4.6. Quản lý Mật khẩu & Đăng nhập

- Hỗ trợ 2 loại hash: BCrypt (legacy) và PBKDF2 (Identity)
- Login đúng bằng BCrypt → tự động **rehash** sang PBKDF2 (không được xóa logic này)
- Rate limit: 5 lần / 60s / IP (sliding window)
- Lockout: 5 lần sai → khóa 15 phút
- Single-session: login mới → đá kết nối SignalR cũ (event `Kicked`) + xóa `SecurityStamp` cũ

### 4.7. Luân chuyển Công văn

- Bảng `DocumentRoutings` lưu cây đa cấp qua `ParentRoutingId`
- `ActionType`: `Chủ trì` hoặc `Phối hợp`
- Trạng thái routing: `Chưa xử lý` → `Đang xử lý` → `Hoàn thành` / `Từ chối`
- Từ chối → Sender giao lại (tạo routing mới với `ParentRoutingId` trỏ về routing cũ)

### 4.8. Thông báo — Fan-out 5 kênh

`NotificationManager.SendToUserAsync` luôn gửi đồng thời:
1. Email (SMTP, nếu user có email)
2. Web Push (VAPID, mỗi subscription; auto-xóa sub nếu 410/404)
3. Lưu DB `Notifications` (trước SignalR để UI fetch được ngay)
4. SignalR `Clients.Group("User_{id}")` event `ReceiveNotification`
5. AuditLog

> ⚠️ **R-14**: `ReminderWorker` dùng `Clients.User(userId)` thay vì `Clients.Group("User_{id}")` → có thể không tới đích.

---

## 5. Giới Hạn & Timeout Quan Trọng

| Hạng mục | Giá trị |
|---|---|
| JWT access token | 8 giờ |
| Refresh token | 7 ngày |
| Identity lockout | 5 lần sai → 15 phút |
| Cache SecurityStamp | 2 phút (MemoryCache) |
| Upload tối đa | PDF 50MB, DOC(X) 30MB, XLS(X) 20MB, ảnh 10MB |
| HttpClient → Python | **10 phút** (Docling chạy lâu) |
| Ollama chat (C#) | 300s + 1 retry delay 2s |
| Python chat | 180s |
| RabbitMQ prefetch | 8 file song song |
| Ollama đồng thời (Python) | Semaphore 4, queue 100 |
| Agent tool chain | ≤5 hop, mỗi tool ≤2 lần |
| Semantic cache | cosine ≥0.85, tối đa 500 bản ghi |
| RAG thresholds | cosine ≥0.20 (search) / ≥0.65 (compress); rerank ≥0.1 top-5; hybrid 0.7/0.3 |
| Backup | mỗi 6h, giữ 28 bản |
| AuditLog dọn | > 30 ngày, chạy sau quét 08:30 |
| DeadlineWorker poll | 30s |
| Notification_ScanTime | `08:30` (cấu hình trong AppSettings) |

---

## 6. Phân Quyền (RBAC)

| Chức năng | Admin | LanhDao | VanThu | CanBo |
|---|:--:|:--:|:--:|:--:|
| Xem danh sách / chi tiết công văn | ✅ | ✅ | ✅ | ✅ |
| Upload / tạo công văn | ✅ | ❌ | ✅ | ❌ |
| Bulk confirm / bulk delete | ✅ | ❌ | ✅ | ❌ |
| Sửa công văn (`PUT /{id}`) | ✅ | ✅ | ✅ | ✅ |
| Xóa công văn (`DELETE /{id}`) | ✅ | ❌ | ❌ | ❌ |
| Nộp minh chứng | ✅ | ❌ | ❌ | ✅ |
| Quản lý users (CRUD) | ✅ | ❌ | ❌ | ❌ |
| Phòng ban / Labels / Rules ghi | ✅ | ❌ | ❌ | ❌ |
| Cài đặt hệ thống (`/stats/settings`) | ✅ | ❌ | ✅ | ❌ |
| Quét thời hạn thủ công | ✅ | ❌ | ✅ | ❌ |
| Trợ lý AI (chat) | ✅ | ✅ | ✅ | ✅ |
| Backup export DB | ✅ | ❌ | ❌ | ❌ |

> ⚠️ **R-02**: Chưa có row-level security — `CanBo` xem được toàn bộ công văn mọi phòng ban.

---

## 7. Các Rủi Ro Kiến Trúc Cần Biết (Top 5)

| ID | Mức | Vấn đề | Cần làm |
|---|:--:|---|---|
| **R-01** | 🔴 | `AiSemanticCache` không có `UserId` → rò rỉ dữ liệu xuyên user | Thêm `UserId` vào khóa cache |
| **R-02** | 🔴 | Không có row-level security | Lọc theo `DepartmentId`/`AssignedUserIds` |
| **R-03** | 🔴 | Port 15672/3001/59607 mở ra Internet | Bỏ `ports`, dùng `expose` + proxy |
| **R-04** | 🔴 | Vector search full-scan O(N) trong RAM | Chuyển sang sqlite-vec/Qdrant |
| **R-05** | 🟠 | `DocumentChunks`, `UserMemories` không trong `Initialize()` | Đưa vào migration có version |

Chi tiết đầy đủ 22 rủi ro: xem `docs/legacy/ARCHITECTURE.md` §17.

---

## 8. Biến Môi Trường Bắt Buộc

| Biến | Bắt buộc | Ghi chú |
|---|:--:|---|
| `JWT_SECRET` | ✅ | **≥32 ký tự**, app từ chối khởi động nếu thiếu |
| `PUBLIC_ID_SECRET` | ✅ | `openssl rand -base64 48` |
| `RABBITMQ_USER` / `RABBITMQ_PASS` | ✅ | không dùng `guest/guest` |
| `VAPID_SUBJECT` | ✅ | `mailto:...` |
| `DB_PATH` | ✅ | `/app/data/documents.db` trong Docker |
| `ASPNETCORE_ENVIRONMENT` | ✅ | `Production` |
| `TZ` | ✅ | `Asia/Ho_Chi_Minh` |
| `PythonAiServiceUrl` | ⬜ | mặc định `http://python-ai-service:8001` |
| `Ollama__ChatUrl` | ⬜ | `http://host.docker.internal:11434/api/chat` |
| `ClamAv__Host` / `ClamAv__Port` | ⬜ | `clamav` / `3310` |
| `DOCLING_USE_SIMPLE_PIPELINE` | ⬜ | `true` — giảm RAM cho Docling |

---

*Để biết chi tiết đầy đủ về kiến trúc, xem [`docs/legacy/ARCHITECTURE.md`](docs/legacy/ARCHITECTURE.md) — bản phân tích trực tiếp từ source code.*
