---
name: tc-skill-db-migration
description: |
  Hướng dẫn AI Agent thực hiện thay đổi database schema (SQLite/ADO.NET) an toàn
  trong dự án Tool-Calendar. Bắt buộc đọc trước khi thêm cột, bảng hoặc xóa dữ liệu.
---

# TC-SKILL-DB-MIGRATION

Kỹ năng này định nghĩa quy trình thay đổi database schema an toàn. Vì dự án dùng
**SQLite + ADO.NET thuần** (không có EF Migration), mọi thay đổi schema phải thủ công
và được ghi chép đầy đủ.

> [!CAUTION]
> Không tự ý thay đổi schema bảng mà không ghi lý do vào `COMMIT_LOG.md`.
> Không xóa/đổi tên cột đang được dùng trong production mà không có migration script.

---

## 1. Nguyên tắc cốt lõi

- **SQLite chỉ** — Không thêm JSON/JSONL/TXT để lưu state
- **Backward compatible** — Thêm cột mới phải có `DEFAULT` hoặc nullable
- **Không xóa cột** ngay — Deprecate rồi xóa ở release sau
- **Luôn test trên DB copy** trước khi chạy trên production

---

## 2. Quy trình thêm cột mới

### Bước 1: Kiểm tra schema hiện tại
```bash
# Xem cấu trúc bảng hiện tại
sqlite3 data_dump/documents.db ".schema Documents"
sqlite3 data_dump/documents.db ".schema Users"
```

### Bước 2: Viết migration SQL

```sql
-- Migration: Thêm cột XYZ vào bảng ABC
-- Date: 2026-MM-DD
-- Reason: <Lý do nghiệp vụ>

-- Luôn dùng DEFAULT cho cột mới để không break dữ liệu cũ
ALTER TABLE Documents ADD COLUMN NewColumn TEXT DEFAULT '' NOT NULL;
ALTER TABLE Documents ADD COLUMN NullableCol INTEGER;  -- Nullable: OK

-- Ví dụ thực tế:
ALTER TABLE Users ADD COLUMN Avatar TEXT DEFAULT '' NOT NULL;
ALTER TABLE Documents ADD COLUMN TagIds TEXT DEFAULT '[]' NOT NULL;
```

### Bước 3: Chạy migration

```bash
# Test trên copy trước
cp data_dump/documents.db data_dump/documents.db.backup

# Chạy migration
sqlite3 data_dump/documents.db < migration_YYYYMMDD.sql

# Verify
sqlite3 data_dump/documents.db ".schema Documents"
sqlite3 data_dump/documents.db "SELECT COUNT(*) FROM Documents"
```

### Bước 4: Cập nhật seed_db.sql (nếu cần)

> [!IMPORTANT]
> `seed_db.sql` là vùng CẤM — chỉ sửa nếu có lý do rõ ràng và phải ghi COMMIT_LOG.

---

## 3. Quy trình thêm bảng mới

```sql
-- Template bảng mới
CREATE TABLE IF NOT EXISTS NewTable (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL DEFAULT '',
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index thường dùng
CREATE INDEX IF NOT EXISTS idx_newtable_name ON NewTable(Name);
```

Sau khi tạo bảng, phải:
1. Thêm Repository class trong `ToolCalendar.Core/Data/Repositories/`
2. Đăng ký DI trong `Program.cs`
3. Ghi vào `COMMIT_LOG.md` với SQL đầy đủ

---

## 4. Các cột JSON (Array stored as TEXT)

Dự án lưu array dạng JSON string trong TEXT column (ví dụ: `AssignedUserIds`, `AssignedDepartmentIds`):

```csharp
// ✅ Đọc đúng cách
var ids = JsonSerializer.Deserialize<List<int>>(reader["AssignedUserIds"].ToString() ?? "[]");

// ✅ Ghi đúng cách
cmd.Parameters.AddWithValue("@assignedUserIds", JsonSerializer.Serialize(userIds));

// ❌ Sai — không parse JSON
var ids = reader["AssignedUserIds"].ToString().Split(',');
```

---

## 5. Rollback nếu có lỗi

SQLite không hỗ trợ `ALTER TABLE DROP COLUMN` trên version cũ. Rollback bằng cách:

```bash
# Option 1: Restore backup
cp data_dump/documents.db.backup data_dump/documents.db

# Option 2: Tạo bảng mới, copy dữ liệu, đổi tên (SQLite pattern)
BEGIN TRANSACTION;
CREATE TABLE Documents_new AS SELECT col1, col2 FROM Documents; -- Chỉ copy cột cần
DROP TABLE Documents;
ALTER TABLE Documents_new RENAME TO Documents;
COMMIT;
```

---

## 6. Template COMMIT_LOG entry cho DB change

```markdown
### [2026-MM-DD HH:MM] Thêm cột <TênCột> vào bảng <TênBảng>
- **Mô tả**: <Lý do nghiệp vụ — tại sao cần cột này>
- **Migration SQL**:
  ```sql
  ALTER TABLE TenBang ADD COLUMN TenCot TEXT DEFAULT '' NOT NULL;
  ```
- **Tệp thay đổi**:
  - `ToolCalendar.Core/Data/Repositories/XxxRepository.cs` (Sửa đổi)
  - `SYSTEM_FEATURES.md` (Cập nhật schema section)
- **Lệnh git commit**: `git commit -m "feat(db): thêm cột TenCot vào bảng TenBang"`
```

---
**Status:** ACTIVE
**Scope:** Mọi thay đổi SQLite schema
**Trigger:** Trước khi thêm/xóa/sửa cột hoặc bảng
