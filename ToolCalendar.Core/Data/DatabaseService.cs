using Microsoft.Data.Sqlite;
using ToolCalendar.Models;

namespace ToolCalendar.Data
{
    public static class DatabaseService
    {
        private static string _connectionString = "";

        public static void Initialize()
        {
            string dbPath;
            string? envPath = Environment.GetEnvironmentVariable("DB_PATH");

            if (!string.IsNullOrEmpty(envPath))
            {
                dbPath = envPath;
                string? dir = Path.GetDirectoryName(dbPath);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            }
            else
            {
                string appData = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "ToolCalendar"
                );
                Directory.CreateDirectory(appData);
                dbPath = Path.Combine(appData, "documents.db");
            }
            _connectionString = $"Data Source={dbPath};Pooling=True;Default Timeout=30;Cache=Shared";

            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            // Sử dụng DELETE thay vì WAL vì WAL bị lỗi "disk I/O error" trên Docker Desktop Windows
            try 
            {
                using var walCmd = new SqliteCommand("PRAGMA journal_mode=DELETE; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;", connection);
                walCmd.ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB Warning] Could not set DELETE mode: {ex.Message}");
            }

            string createDocumentsTable = @"
                CREATE TABLE IF NOT EXISTS Documents (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    SoVanBan TEXT,
                    TenCongVan TEXT,
                    TrichYeu TEXT,
                    FullText TEXT,
                    OcrPagesJson TEXT DEFAULT '[]',
                    NgayBanHanh TEXT,
                    CoQuanBanHanh TEXT,
                    CoQuanChuQuan TEXT,
                    ThoiHan TEXT,
                    DonViChiDao TEXT,
                    FilePath TEXT,
                    Status TEXT DEFAULT 'ChÆ°a xá»­ lÃ½',
                    Priority TEXT DEFAULT 'ThÆ°á»ng',
                    DepartmentId INTEGER,
                    AssignedTo INTEGER,
                    EvidencePaths TEXT DEFAULT '[]',
                    EvidenceNotes TEXT,
                    CompletionDate TEXT,
                    LabelId INTEGER,
                    NgayThem TEXT,
                    DaTaoLich INTEGER DEFAULT 0,
                    UploadedByUserId INTEGER DEFAULT 1,
                    ContentHash TEXT
                )";

            string createUsersTable = @"
                CREATE TABLE IF NOT EXISTS Users (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    Username TEXT UNIQUE,
                    PasswordHash TEXT,
                    FullName TEXT,
                    Email TEXT,
                    PhoneNumber TEXT,
                    Role TEXT,
                    DepartmentId INTEGER,
                    CreatedAt TEXT,
                    SessionId TEXT
                )";

            string createDepartmentsTable = @"
                CREATE TABLE IF NOT EXISTS Departments (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    Name TEXT,
                    Description TEXT,
                    IsActive INTEGER DEFAULT 1
                )";

            string createLabelsTable = @"
                CREATE TABLE IF NOT EXISTS Labels (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    Name TEXT,
                    Color TEXT
                )";

            string createAutoRulesTable = @"
                CREATE TABLE IF NOT EXISTS AutoRules (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    Keyword TEXT,
                    LabelId INTEGER,
                    DepartmentId INTEGER,
                    DefaultDeadlineDays INTEGER
                )";

            string createSettingsTable = @"
                CREATE TABLE IF NOT EXISTS AppSettings (
                    [Key] TEXT PRIMARY KEY,
                    [Value] TEXT
                )";

            string createAuditLogsTable = @"
                CREATE TABLE IF NOT EXISTS AuditLogs (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    UserId INTEGER,
                    Action TEXT,
                    Timestamp TEXT
                )";

            string createNotificationsTable = @"
                CREATE TABLE IF NOT EXISTS Notifications (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    UserId INTEGER,
                    Title TEXT,
                    Body TEXT,
                    Type TEXT,
                    DocId INTEGER,
                    IsRead INTEGER DEFAULT 0,
                    CreatedAt TEXT
                )";

            string createCommentsTable = @"
                CREATE TABLE IF NOT EXISTS Comments (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    DocumentId INTEGER,
                    UserId INTEGER,
                    Username TEXT,
                    Content TEXT,
                    AttachmentPaths TEXT DEFAULT '[]',
                    CreatedAt TEXT,
                    FOREIGN KEY(DocumentId) REFERENCES Documents(Id)
                )";

            string createCommentReactionsTable = @"
                CREATE TABLE IF NOT EXISTS CommentReactions (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    CommentId INTEGER,
                    UserId INTEGER,
                    Username TEXT,
                    ReactionType TEXT,
                    CreatedAt TEXT,
                    UNIQUE(CommentId, UserId),
                    FOREIGN KEY(CommentId) REFERENCES Comments(Id) ON DELETE CASCADE
                )";

            string createPushSubscriptionsTable = @"
                CREATE TABLE IF NOT EXISTS PushSubscriptions (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    UserId INTEGER,
                    Endpoint TEXT UNIQUE,
                    P256dh TEXT,
                    Auth TEXT,
                    CreatedAt TEXT
                )";

            using var cmd = new SqliteCommand(createDocumentsTable, connection);
            cmd.ExecuteNonQuery();

            cmd.CommandText = createUsersTable;
            cmd.ExecuteNonQuery();

            cmd.CommandText = createCommentsTable;
            cmd.ExecuteNonQuery();

            cmd.CommandText = createCommentReactionsTable;
            cmd.ExecuteNonQuery();

            cmd.CommandText = createDepartmentsTable;
            cmd.ExecuteNonQuery();

            cmd.CommandText = createLabelsTable;
            cmd.ExecuteNonQuery();

            cmd.CommandText = createAutoRulesTable;
            cmd.ExecuteNonQuery();

            cmd.CommandText = createSettingsTable;
            cmd.ExecuteNonQuery();

            cmd.CommandText = createAuditLogsTable;
            cmd.ExecuteNonQuery();

            cmd.CommandText = createPushSubscriptionsTable;
            cmd.ExecuteNonQuery();

            cmd.CommandText = createNotificationsTable;
            cmd.ExecuteNonQuery();

            // Migration cho Comments
            try { cmd.CommandText = "ALTER TABLE Comments ADD COLUMN AttachmentPaths TEXT DEFAULT '[]'"; cmd.ExecuteNonQuery(); } catch { }

            // Migration: Thêm cột ContentHash cho tính năng SHA-256 Deduplication
            // Dùng try/catch vì SQLite không hỗ trợ "ADD COLUMN IF NOT EXISTS"
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN ContentHash TEXT"; cmd.ExecuteNonQuery(); } catch { }
            // Tạo index để tăng tốc truy vấn tra cứu hash (O(log n) thay vì O(n))
            try { cmd.CommandText = "CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON Documents(ContentHash) WHERE ContentHash IS NOT NULL"; cmd.ExecuteNonQuery(); } catch { }

            string createDocumentRoutingsTable = @"
                CREATE TABLE IF NOT EXISTS DocumentRoutings (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    DocumentId INTEGER,
                    SenderId INTEGER,
                    ReceiverId INTEGER,
                    ParentRoutingId INTEGER,
                    Role TEXT,
                    ForwardDate TEXT,
                    Deadline TEXT,
                    Comment TEXT,
                    ProcessingContent TEXT,
                    Status TEXT DEFAULT 'Chưa xử lý',
                    CreatedAt TEXT,
                    FOREIGN KEY(DocumentId) REFERENCES Documents(Id)
                )";
            cmd.CommandText = createDocumentRoutingsTable;
            cmd.ExecuteNonQuery();


            // --- SEED SETTINGS ---
            cmd.CommandText = "SELECT COUNT(*) FROM AppSettings WHERE [Key] = 'Notification_ScanTime'";
            if (Convert.ToInt32(cmd.ExecuteScalar()) == 0)
            {
                cmd.CommandText = "INSERT INTO AppSettings ([Key], [Value]) VALUES ('Notification_ScanTime', '08:30')";
                cmd.ExecuteNonQuery();
            }

            cmd.CommandText = "SELECT COUNT(*) FROM AppSettings WHERE [Key] = 'Document_DeadlineKeywords'";
            if (Convert.ToInt32(cmd.ExecuteScalar()) == 0)
            {
                // Máº·c Ä‘á»‹nh cÃ¡c tá»« bÃ³c tÃ¡ch háº¡n xá»­ lÃ½
                                cmd.CommandText = "INSERT INTO AppSettings ([Key], [Value]) VALUES ('Document_DeadlineKeywords', 'hạn, đến ngày, trước ngày, trình, xong, xong trước, hoàn thành')";
                cmd.ExecuteNonQuery();
            }

            // --- MIGRATION: AutoRules.DepartmentId ---
            try
            {
                cmd.CommandText = "ALTER TABLE AutoRules ADD COLUMN DepartmentId INTEGER";
                cmd.ExecuteNonQuery();
            }
            catch { /* Column already exists */ }

            // --- MIGRATION: Users Schema Update ---
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN FullName TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN Email TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN PhoneNumber TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN Role TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN DepartmentId INTEGER"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN CreatedAt TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN SessionId TEXT"; cmd.ExecuteNonQuery(); } catch { }
            // --- MIGRATION: Account Lockout columns ---
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN FailedLoginCount INTEGER DEFAULT 0"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN LockoutUntil TEXT NULL"; cmd.ExecuteNonQuery(); } catch { }

            // --- MIGRATION: ASP.NET Core Identity columns (không mất dữ liệu cũ) ---
            // SecurityStamp: thay đổi mỗi khi đổi mật khẩu → vô hiệu hóa session cũ ngay lập tức
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN SecurityStamp TEXT"; cmd.ExecuteNonQuery(); } catch { }
            // NormalizedUserName: username dạng in hoa cho tìm kiếm không phân biệt chữ hoa/thường
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN NormalizedUserName TEXT"; cmd.ExecuteNonQuery(); } catch { }
            // LockoutEnabled: có cho phép khóa tài khoản không (mặc định true)
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN LockoutEnabled INTEGER DEFAULT 1"; cmd.ExecuteNonQuery(); } catch { }
            // AccessFailedCount: đồng bộ với FailedLoginCount
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN AccessFailedCount INTEGER DEFAULT 0"; cmd.ExecuteNonQuery(); } catch { }
            // LockoutEnd: thời gian hết lockout (ISO 8601 format, đồng bộ với LockoutUntil)
            try { cmd.CommandText = "ALTER TABLE Users ADD COLUMN LockoutEnd TEXT NULL"; cmd.ExecuteNonQuery(); } catch { }

            // --- BACKFILL: Cập nhật các user cũ chưa có SecurityStamp & NormalizedUserName ---
            // Đảm bảo user cũ vẫn hoạt động bình thường, không bị mất quyền đăng nhập
            try
            {
                cmd.CommandText = @"
                    UPDATE Users 
                    SET SecurityStamp = lower(hex(randomblob(16)))
                    WHERE SecurityStamp IS NULL OR SecurityStamp = ''";
                cmd.ExecuteNonQuery();

                cmd.CommandText = @"
                    UPDATE Users 
                    SET NormalizedUserName = upper(Username)
                    WHERE NormalizedUserName IS NULL OR NormalizedUserName = ''";
                cmd.ExecuteNonQuery();

                // Đồng bộ AccessFailedCount từ FailedLoginCount cũ
                cmd.CommandText = @"
                    UPDATE Users 
                    SET AccessFailedCount = COALESCE(FailedLoginCount, 0)
                    WHERE AccessFailedCount = 0 AND COALESCE(FailedLoginCount, 0) > 0";
                cmd.ExecuteNonQuery();

                // Đồng bộ LockoutEnd từ LockoutUntil cũ
                cmd.CommandText = @"
                    UPDATE Users 
                    SET LockoutEnd = LockoutUntil
                    WHERE LockoutEnd IS NULL AND LockoutUntil IS NOT NULL";
                cmd.ExecuteNonQuery();

                Console.WriteLine("[DB Migration] ✅ Identity columns migrated successfully. All existing users preserved.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DB Migration Warning] Backfill Identity columns: {ex.Message}");
            }

            // --- MIGRATION: Documents Schema Update (All Columns) ---
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN SoVanBan TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN TenCongVan TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN TrichYeu TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN FullText TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN OcrPagesJson TEXT DEFAULT '[]'"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN NgayBanHanh TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN CoQuanBanHanh TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN CoQuanChuQuan TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN ThoiHan TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN DonViChiDao TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN FilePath TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN Status TEXT DEFAULT 'Chưa xử lý'"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN Priority TEXT DEFAULT 'Thường'"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN DepartmentId INTEGER"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN AssignedTo INTEGER"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN EvidencePaths TEXT DEFAULT '[]'"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN EvidenceNotes TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN CompletionDate TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN LabelId INTEGER"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN NgayThem TEXT"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN DaTaoLich INTEGER DEFAULT 0"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN UploadedByUserId INTEGER DEFAULT 1"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN AssignedUserIds TEXT DEFAULT '[]'"; cmd.ExecuteNonQuery(); } catch { }
            try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN AssignedDepartmentIds TEXT DEFAULT '[]'"; cmd.ExecuteNonQuery(); } catch { }

            try { cmd.CommandText = "ALTER TABLE Departments ADD COLUMN IsActive INTEGER DEFAULT 1"; cmd.ExecuteNonQuery(); } catch { }

            // Migration cho phòng ban mới
            try { 
                cmd.CommandText = "INSERT INTO Departments (Name, Description, IsActive) SELECT 'Phòng Kinh tế', 'Phòng ban Phòng Kinh tế', 1 WHERE NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Phòng Kinh tế')"; 
                cmd.ExecuteNonQuery(); 
                cmd.CommandText = "INSERT INTO Departments (Name, Description, IsActive) SELECT 'Phòng Xây dựng, Nông nghiệp và môi trường', 'Phòng ban Phòng Xây dựng, Nông nghiệp và môi trường', 1 WHERE NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Phòng Xây dựng, Nông nghiệp và môi trường')"; 
                cmd.ExecuteNonQuery(); 
                cmd.CommandText = "UPDATE Departments SET IsActive = 0 WHERE Name = 'Phòng Kinh tế hạ tầng và đô thị'"; 
                cmd.ExecuteNonQuery(); 
            } catch { }

            // Chỉ tạo admin lần đầu — KHÔNG BAO GIỜ reset password tự động
            cmd.CommandText = "SELECT COUNT(*) FROM Users WHERE Username='admin'";
            if (Convert.ToInt32(cmd.ExecuteScalar()) == 0)
            {
                // Mật khẩu mặc định được mã hóa BCrypt (work factor 12 — chuẩn công nghiệp)
                                var defaultAdminPwd = BCrypt.Net.BCrypt.HashPassword("DEFAULT_PASSWORD_REDACTED", workFactor: 12);
                cmd.CommandText = "INSERT INTO Users (Username, PasswordHash, Role, CreatedAt) VALUES ('admin', @pwd, 'Admin', datetime('now', 'localtime'))";
                cmd.Parameters.Clear();
                cmd.Parameters.AddWithValue("@pwd", defaultAdminPwd);
                cmd.ExecuteNonQuery();
                cmd.Parameters.Clear();
            }
            // Không có else — không bao giờ reset password tự động!

            // --- SEED DEPARTMENTS ---
            cmd.CommandText = "SELECT COUNT(*) FROM Departments";
            if (Convert.ToInt32(cmd.ExecuteScalar()) == 0)
            {
                var deps = new[] { "Văn phòng HĐND và UBND", "Phòng Kinh tế hạ tầng và đô thị", "Phòng văn hóa xã hội" };
                foreach (var name in deps)
                {
                    cmd.CommandText = "INSERT INTO Departments (Name, Description) VALUES (@name, @desc)";
                    cmd.Parameters.Clear();
                    cmd.Parameters.AddWithValue("@name", name);
                    cmd.Parameters.AddWithValue("@desc", $"Phòng ban {name}");
                    cmd.ExecuteNonQuery();
                }
            }

            // --- SEED LABELS ---
            cmd.CommandText = "SELECT COUNT(*) FROM Labels";
            if (Convert.ToInt32(cmd.ExecuteScalar()) == 0)
            {
                var labels = new[] {
                    new { n = "Dự án", c = "#3b82f6" },
                    new { n = "Khiếu nại", c = "#ef4444" },
                    new { n = "Môi trường", c = "#10b981" },
                    new { n = "Hợp tác", c = "#8b5cf6" }
                };
                foreach (var l in labels)
                {
                    cmd.CommandText = "INSERT INTO Labels (Name, Color) VALUES (@n, @c)";
                    cmd.Parameters.Clear();
                    cmd.Parameters.AddWithValue("@n", l.n);
                    cmd.Parameters.AddWithValue("@c", l.c);
                    cmd.ExecuteNonQuery();
                }
            }

            // =========================================================
            // --- PERFORMANCE INDEXES (tự động thêm nếu chưa có) ---
            // Composite index: tăng tốc mọi dashboard query dùng ThoiHan + Status
            cmd.Parameters.Clear();
            cmd.CommandText = "CREATE INDEX IF NOT EXISTS idx_documents_thoihan_status ON Documents(ThoiHan, Status)";
            cmd.ExecuteNonQuery();
            // Index cho GROUP BY / ORDER BY DepartmentId
            cmd.CommandText = "CREATE INDEX IF NOT EXISTS idx_documents_department ON Documents(DepartmentId)";
            cmd.ExecuteNonQuery();
            // Index cho ORDER BY NgayThem (newest / oldest sort)
            cmd.CommandText = "CREATE INDEX IF NOT EXISTS idx_documents_ngaythem ON Documents(NgayThem DESC)";
            cmd.ExecuteNonQuery();
            // Index cho AuditLogs ORDER BY Timestamp DESC
            cmd.CommandText = "CREATE INDEX IF NOT EXISTS idx_auditlogs_timestamp ON AuditLogs(Timestamp DESC)";
            cmd.ExecuteNonQuery();
            // Index cho Notifications per user
            cmd.CommandText = "CREATE INDEX IF NOT EXISTS idx_notifications_user ON Notifications(UserId, CreatedAt DESC)";
            cmd.ExecuteNonQuery();

            // --- LOGIN AUDIT LOG TABLE (bảng mới, tách riêng để không ảnh hưởng AuditLogs cũ) ---
            cmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS LoginAuditLog (
                    Id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    Username   TEXT NOT NULL,
                    UserId     INTEGER NULL,
                    IpAddress  TEXT,
                    UserAgent  TEXT,
                    IsSuccess  INTEGER DEFAULT 0,
                    FailReason TEXT NULL,
                    CreatedAt  TEXT NOT NULL
                )";
            cmd.ExecuteNonQuery();
            // Index để query nhanh theo thời gian và username
            cmd.CommandText = "CREATE INDEX IF NOT EXISTS idx_loginaudit_created  ON LoginAuditLog(CreatedAt DESC)";
            cmd.ExecuteNonQuery();
            cmd.CommandText = "CREATE INDEX IF NOT EXISTS idx_loginaudit_username ON LoginAuditLog(Username)";
            cmd.ExecuteNonQuery();
            // =========================================================
        }

        // --- USER MANAGEMENT ---
        public static List<User> GetUsers()
        {
            var list = new List<User>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "SELECT u.Id, u.Username, u.FullName, u.Email, u.PhoneNumber, u.Role, u.DepartmentId, d.Name as DepartmentName, u.SessionId FROM Users u LEFT JOIN Departments d ON u.DepartmentId = d.Id";
            using var cmd = new SqliteCommand(sql, connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new User
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Username = reader["Username"].ToString() ?? "",
                    FullName = reader["FullName"]?.ToString() ?? "",
                    Email = reader["Email"]?.ToString() ?? "",
                    PhoneNumber = reader["PhoneNumber"]?.ToString() ?? "",
                    Role = reader["Role"].ToString() ?? "",
                    DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),
                    DepartmentName = reader["DepartmentName"]?.ToString(),
                    SessionId = reader["SessionId"]?.ToString()
                });
            }
            return list;
        }

        public static void DeleteUser(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                using var cmd = connection.CreateCommand();
                cmd.Transaction = transaction;

                // 1. Gá»¡ ngÆ°á»i dÃ¹ng khá»i cÃ¡c vÄƒn báº£n Ä‘ang Ä‘Æ°á»£c gÃ¡n (chuyá»ƒn AssignedTo vá» NULL)
                // 1. Gá»¡ ngÆ°á» i dÃ¹ng khá» i cÃ¡c vÄƒn báº£n Ä‘ang Ä‘Æ°á»£c gÃ¡n (chuyá»ƒn AssignedTo vá»  NULL)
                // LÆ°u Ã½: ChÃºng ta lá» c theo ID ngÆ°á» i dÃ¹ng trong danh sÃ¡ch AssignedUserIds hoáº·c AssignedTo
                cmd.CommandText = "UPDATE Documents SET AssignedTo = NULL WHERE AssignedTo = (SELECT Username FROM Users WHERE Id = @id)";
                cmd.Parameters.AddWithValue("@id", id);
                cmd.ExecuteNonQuery();

                // 2. XÃ³a ngÆ°á» i dÃ¹ng (khÃ´ng cho phÃ©p xÃ³a admin Ä‘á»ƒ báº£o máº­t há»‡ thÃ‘ng)
                cmd.CommandText = "DELETE FROM Users WHERE Id = @id AND Username != 'admin'";
                cmd.ExecuteNonQuery();

                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public static User? Login(string username, string password)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string sql = @"SELECT Id, Username, PasswordHash, FullName, Role, DepartmentId,
                                  COALESCE(FailedLoginCount, 0) as FailedLoginCount, LockoutUntil
                           FROM Users WHERE Username=@u";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@u", username);
            using var reader = cmd.ExecuteReader();

            if (!reader.Read()) return null;

            int userId         = Convert.ToInt32(reader["Id"]);
            var storedHash     = reader["PasswordHash"]?.ToString() ?? "";
            string? lockoutRaw = reader["LockoutUntil"]?.ToString();

            // ── Bước 1: Kiểm tra Account Lockout ──────────────────────────────
            if (!string.IsNullOrEmpty(lockoutRaw) &&
                DateTime.TryParse(lockoutRaw, out DateTime lockoutUntil) &&
                lockoutUntil > DateTime.UtcNow)
            {
                return null; // Không tiết lộ lý do (chống user enumeration)
            }

            var user = new User
            {
                Id           = userId,
                Username     = reader["Username"].ToString() ?? "",
                FullName     = reader["FullName"]?.ToString() ?? "",
                Role         = reader["Role"].ToString() ?? "Guest",
                DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"])
            };
            reader.Close();

            // ── Bước 2: Xác minh mật khẩu (Timing-Safe) ──────────────────────
            bool isValid;
            if (storedHash.StartsWith("$2a$") || storedHash.StartsWith("$2b$") || storedHash.StartsWith("$2y$"))
            {
                isValid = BCrypt.Net.BCrypt.Verify(password, storedHash);
            }
            else
            {
                var storedBytes = System.Text.Encoding.UTF8.GetBytes(storedHash);
                var inputBytes  = System.Text.Encoding.UTF8.GetBytes(password);
                var paddedInput = inputBytes.Length == storedBytes.Length
                    ? inputBytes
                    : System.Text.Encoding.UTF8.GetBytes(password.PadRight(storedHash.Length));
                isValid = System.Security.Cryptography.CryptographicOperations
                              .FixedTimeEquals(storedBytes, paddedInput);
            }

            // ── Bước 3: Xử lý kết quả ─────────────────────────────────────────
            if (!isValid)
            {
                using var incCmd = new SqliteCommand(@"
                    UPDATE Users SET
                        FailedLoginCount = COALESCE(FailedLoginCount, 0) + 1,
                        LockoutUntil = CASE
                            WHEN COALESCE(FailedLoginCount, 0) + 1 >= 5
                            THEN datetime('now', '+15 minutes')
                            ELSE LockoutUntil
                        END
                    WHERE Id = @id", connection);
                incCmd.Parameters.AddWithValue("@id", userId);
                incCmd.ExecuteNonQuery();
                return null;
            }

            // ── Bước 4: Đăng nhập thành công ─────────────────────────────────
            if (!storedHash.StartsWith("$2"))
            {
                var newHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
                using var migrateCmd = new SqliteCommand(
                    "UPDATE Users SET PasswordHash=@h WHERE Id=@id", connection);
                migrateCmd.Parameters.AddWithValue("@h", newHash);
                migrateCmd.Parameters.AddWithValue("@id", userId);
                migrateCmd.ExecuteNonQuery();
                Console.WriteLine($"[Security] Đã tự động migrate mật khẩu plain-text sang BCrypt cho user: {user.Username}");
            }

            user.SessionId = Guid.NewGuid().ToString();
            using var updateCmd = new SqliteCommand(@"
                UPDATE Users
                SET SessionId = @s, FailedLoginCount = 0, LockoutUntil = NULL
                WHERE Id = @id", connection);
            updateCmd.Parameters.AddWithValue("@s",  user.SessionId);
            updateCmd.Parameters.AddWithValue("@id", userId);
            updateCmd.ExecuteNonQuery();

            return user;
        }

        public static User? GetUserById(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = @"
                SELECT u.*, d.Name as DepartmentName 
                FROM Users u 
                LEFT JOIN Departments d ON u.DepartmentId = d.Id 
                WHERE u.Id=@id";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@id", id);
            using var reader = cmd.ExecuteReader();
            if (reader.Read())
            {
                return new User
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Username = reader["Username"].ToString() ?? "",
                    FullName = reader["FullName"]?.ToString() ?? "",
                    Email = reader["Email"]?.ToString() ?? "",
                    PhoneNumber = reader["PhoneNumber"]?.ToString() ?? "",
                    Role = reader["Role"].ToString() ?? "Guest",
                    DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),
                    DepartmentName = reader["DepartmentName"]?.ToString(),
                    SessionId = reader["SessionId"]?.ToString()
                };
            }
            return null;
        }

        public static bool CreateUser(User user)
        {
            try
            {
                using var connection = new SqliteConnection(_connectionString);
                connection.Open();
                string sql = @"
                    INSERT INTO Users (Username, PasswordHash, FullName, Email, PhoneNumber, Role, DepartmentId, CreatedAt) 
                    VALUES (@u, @p, @f, @e, @pn, @r, @d, @now)";
                using var cmd = new SqliteCommand(sql, connection);
                cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));
                cmd.Parameters.AddWithValue("@u", user.Username);

                // MÃ£ hÃ³a máº­t kháº©u báº±ng BCrypt náº¿u chÆ°a Ä‘Æ°á»£c hash
                var passwordToStore = (user.PasswordHash?.StartsWith("$2") == true)
                    ? user.PasswordHash  // ÄÃ£ hash rá»“i (nhÆ° tá»« admin seed)
                    : BCrypt.Net.BCrypt.HashPassword(user.PasswordHash ?? "ChangeMe@123", workFactor: 12);
                cmd.Parameters.AddWithValue("@p", passwordToStore);

                cmd.Parameters.AddWithValue("@f", (object?)user.FullName ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@e", (object?)user.Email ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@pn", (object?)user.PhoneNumber ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@r", (object?)user.Role ?? "Guest");
                cmd.Parameters.AddWithValue("@d", (object?)user.DepartmentId ?? DBNull.Value);
                cmd.ExecuteNonQuery();
                return true;
            }
            catch { return false; }
        }

        public static void UpdateUser(User user)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = @"
                UPDATE Users SET 
                    FullName = @f, 
                    Email = @e, 
                    PhoneNumber = @pn, 
                    Role = @r, 
                    DepartmentId = @d 
                WHERE Id = @id";

            // Note: Not updating Username/Password here for simplicity, can add separate methods or logic
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@f", (object?)user.FullName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@e", (object?)user.Email ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@pn", (object?)user.PhoneNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@r", (object?)user.Role ?? "Guest");
            cmd.Parameters.AddWithValue("@d", (object?)user.DepartmentId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@id", user.Id);
            cmd.ExecuteNonQuery();
        }

        public static bool Register(string username, string password, string role = "Guest")
        {
            // Hash máº­t kháº©u trÆ°á»›c khi táº¡o user
            var hashedPassword = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
            return CreateUser(new User { Username = username, PasswordHash = hashedPassword, Role = role });
        }

        // --- SETTINGS & LOGS ---
        public static string GetAppSetting(string key, string defaultVal = "")
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("SELECT [Value] FROM AppSettings WHERE [Key]=@k", connection);
            cmd.Parameters.AddWithValue("@k", key);
            var result = cmd.ExecuteScalar();
            return result?.ToString() ?? defaultVal;
        }

        public static void SaveAppSetting(string key, string val)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand(@"
                INSERT INTO AppSettings ([Key], [Value]) 
                VALUES (@k, @v) 
                ON CONFLICT([Key]) DO UPDATE SET [Value]=@v", connection);
            cmd.Parameters.AddWithValue("@k", key);
            cmd.Parameters.AddWithValue("@v", val);
            cmd.ExecuteNonQuery();
        }

        public static (List<AuditLog> items, int total) GetAuditLogs(int page = 1, int pageSize = 20, string? roleFilter = null)
        {
            var list = new List<AuditLog>();
            int total = 0;
            try
            {
                using var connection = new SqliteConnection(_connectionString);
                connection.Open();

                string whereSql = string.IsNullOrWhiteSpace(roleFilter) ? "" : "WHERE u.Role = @role";

                using var totalCmd = new SqliteCommand($@"
                    SELECT COUNT(*)
                    FROM AuditLogs a
                    LEFT JOIN Users u ON a.UserId = u.Id
                    {whereSql}", connection);
                if (!string.IsNullOrWhiteSpace(roleFilter)) totalCmd.Parameters.AddWithValue("@role", roleFilter);
                total = Convert.ToInt32(totalCmd.ExecuteScalar());

                string sql = $@"
                    SELECT a.*, u.FullName as UserFullName 
                    FROM AuditLogs a 
                    LEFT JOIN Users u ON a.UserId = u.Id 
                    {whereSql}
                    ORDER BY a.Timestamp DESC 
                    LIMIT @limit OFFSET @offset";
                using var cmd = new SqliteCommand(sql, connection);
                if (!string.IsNullOrWhiteSpace(roleFilter)) cmd.Parameters.AddWithValue("@role", roleFilter);
                cmd.Parameters.AddWithValue("@limit", pageSize);
                cmd.Parameters.AddWithValue("@offset", (page - 1) * pageSize);
                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    list.Add(new AuditLog
                    {
                        Id = Convert.ToInt32(reader["Id"]),
                        UserId = reader["UserId"] == DBNull.Value ? null : Convert.ToInt32(reader["UserId"]),
                        UserFullName = reader["UserFullName"]?.ToString() ?? "Hệ thống",
                        Action = reader["Action"].ToString() ?? "",
                        Timestamp = DateTime.Parse(reader["Timestamp"].ToString() ?? DateTime.UtcNow.AddHours(7).ToString())
                    });
                }
            }
            catch { }
            return (list, total);
        }

        public static void InsertAuditLog(int? userId, string action)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("INSERT INTO AuditLogs (UserId, Action, Timestamp) VALUES (@u, @a, @now)", connection);
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));
            cmd.Parameters.AddWithValue("@u", (object?)userId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@a", action);
            cmd.ExecuteNonQuery();
        }

        /// <summary>Ghi log mỗi lần đăng nhập (thành công hoặc thất bại) kèm IP và User-Agent.</summary>
        public static void InsertLoginAuditLog(
            string username, int? userId,
            string? ipAddress, string? userAgent,
            bool isSuccess, string? failReason = null)
        {
            try
            {
                using var connection = new SqliteConnection(_connectionString);
                connection.Open();
                using var cmd = new SqliteCommand(@"
                    INSERT INTO LoginAuditLog (Username, UserId, IpAddress, UserAgent, IsSuccess, FailReason, CreatedAt)
                    VALUES (@u, @uid, @ip, @ua, @ok, @reason, @now)", connection);
                cmd.Parameters.AddWithValue("@u",      username);
                cmd.Parameters.AddWithValue("@uid",    (object?)userId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@ip",     (object?)ipAddress ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@ua",     (object?)userAgent ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@ok",     isSuccess ? 1 : 0);
                cmd.Parameters.AddWithValue("@reason", (object?)failReason ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@now",    DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));
                cmd.ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                // Không để lỗi ghi log phá vỡ luồng đăng nhập chính
                Console.WriteLine($"[LoginAudit] Lỗi ghi log: {ex.Message}");
            }
        }

        /// <summary>Tăng FailedLoginCount. Nếu >= 5 thì set LockoutUntil = now + 15 phút.</summary>
        public static void IncrementFailedLogin(int userId)
        {
            try
            {
                using var connection = new SqliteConnection(_connectionString);
                connection.Open();
                // Tăng đếm và tự động khóa nếu đủ 5 lần sai
                using var cmd = new SqliteCommand(@"
                    UPDATE Users SET
                        FailedLoginCount = COALESCE(FailedLoginCount, 0) + 1,
                        LockoutUntil = CASE
                            WHEN COALESCE(FailedLoginCount, 0) + 1 >= 5
                            THEN datetime('now', '+15 minutes')
                            ELSE LockoutUntil
                        END
                    WHERE Id = @id", connection);
                cmd.Parameters.AddWithValue("@id", userId);
                cmd.ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[LoginLockout] Lỗi IncrementFailedLogin: {ex.Message}");
            }
        }

        /// <summary>Reset FailedLoginCount và xóa LockoutUntil sau khi đăng nhập thành công.</summary>
        public static void ResetFailedLogin(int userId)
        {
            try
            {
                using var connection = new SqliteConnection(_connectionString);
                connection.Open();
                using var cmd = new SqliteCommand(
                    "UPDATE Users SET FailedLoginCount = 0, LockoutUntil = NULL WHERE Id = @id", connection);
                cmd.Parameters.AddWithValue("@id", userId);
                cmd.ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[LoginLockout] Lỗi ResetFailedLogin: {ex.Message}");
            }
        }

        public static void ClearAuditLogs()
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                using var cmd = connection.CreateCommand();
                cmd.Transaction = transaction;
                cmd.CommandText = "DELETE FROM AuditLogs";
                cmd.ExecuteNonQuery();
                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public static int DeleteOldAuditLogs(int daysToKeep)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                using var cmd = connection.CreateCommand();
                cmd.Transaction = transaction;
                cmd.CommandText = "DELETE FROM AuditLogs WHERE Timestamp < datetime('now', '-' || @days || ' days')";
                cmd.Parameters.AddWithValue("@days", daysToKeep);
                int rows = cmd.ExecuteNonQuery();
                transaction.Commit();
                return rows;
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }


        // --- DEPARTMENT MANAGEMENT ---
        public static List<Department> GetDepartments(bool includeInactive = false)
        {
            var list = new List<Department>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = includeInactive ? "SELECT Id, Name, Description, IsActive FROM Departments" : "SELECT Id, Name, Description, IsActive FROM Departments WHERE IsActive = 1";
            using var cmd = new SqliteCommand(sql, connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new Department
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Name = reader["Name"].ToString() ?? "",
                    Description = reader["Description"]?.ToString() ?? "",
                    IsActive = reader.HasColumn("IsActive") && reader["IsActive"] != DBNull.Value ? Convert.ToInt32(reader["IsActive"]) == 1 : true
                });
            }
            return list;
        }

        public static int InsertDepartment(Department d)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("INSERT INTO Departments (Name, Description, IsActive) VALUES (@n, @d, @ia); SELECT last_insert_rowid();", connection);
            cmd.Parameters.AddWithValue("@n", d.Name);
            cmd.Parameters.AddWithValue("@d", d.Description);
            cmd.Parameters.AddWithValue("@ia", d.IsActive ? 1 : 0);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public static void UpdateDepartment(Department d)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("UPDATE Departments SET Name = @n, Description = @d, IsActive = @ia WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@n", d.Name);
            cmd.Parameters.AddWithValue("@d", d.Description);
            cmd.Parameters.AddWithValue("@ia", d.IsActive ? 1 : 0);
            cmd.Parameters.AddWithValue("@id", d.Id);
            cmd.ExecuteNonQuery();
        }

        public static void DeleteDepartment(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("UPDATE Departments SET IsActive = 0 WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.ExecuteNonQuery();
        }

        // --- LABEL MANAGEMENT ---
        public static List<DocumentLabel> GetLabels()
        {
            var list = new List<DocumentLabel>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("SELECT Id, Name, Color FROM Labels", connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new DocumentLabel
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Name = reader["Name"].ToString() ?? "",
                    Color = reader["Color"]?.ToString() ?? ""
                });
            }
            return list;
        }

        public static int InsertLabel(DocumentLabel l)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("INSERT INTO Labels (Name, Color) VALUES (@n, @c); SELECT last_insert_rowid();", connection);
            cmd.Parameters.AddWithValue("@n", l.Name);
            cmd.Parameters.AddWithValue("@c", l.Color);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public static void DeleteLabel(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                using var cmd = connection.CreateCommand();
                cmd.Transaction = transaction;

                // 1. Gá»¡ nhÃ£n khá»i cÃ¡c vÄƒn báº£n
                cmd.CommandText = "UPDATE Documents SET LabelId = NULL WHERE LabelId = @id";
                cmd.Parameters.AddWithValue("@id", id);
                cmd.ExecuteNonQuery();

                // 2. Gá»¡ nhÃ£n khá»i AutoRules
                cmd.CommandText = "UPDATE AutoRules SET LabelId = NULL WHERE LabelId = @id";
                cmd.ExecuteNonQuery();

                // 3. XÃ³a nhÃ£n
                cmd.CommandText = "DELETE FROM Labels WHERE Id = @id";
                cmd.ExecuteNonQuery();

                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        // --- AUTO RULE MANAGEMENT ---
        public static List<AutoRule> GetAutoRules()
        {
            var list = new List<AutoRule>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("SELECT r.Id, r.Keyword, r.LabelId, r.DepartmentId, r.DefaultDeadlineDays, d.Name as DepartmentName FROM AutoRules r LEFT JOIN Departments d ON r.DepartmentId = d.Id", connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new AutoRule
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Keyword = reader["Keyword"].ToString() ?? "",
                    LabelId = reader["LabelId"] == DBNull.Value ? null : Convert.ToInt32(reader["LabelId"]),
                    DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),
                    DepartmentName = reader["DepartmentName"]?.ToString(),
                    DefaultDeadlineDays = Convert.ToInt32(reader["DefaultDeadlineDays"])
                });
            }
            return list;
        }

        public static int InsertAutoRule(AutoRule r)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "INSERT INTO AutoRules (Keyword, LabelId, DepartmentId, DefaultDeadlineDays) VALUES (@k, @l, @dept, @d); SELECT last_insert_rowid();";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@k", r.Keyword);
            cmd.Parameters.AddWithValue("@l", (object?)r.LabelId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@dept", (object?)r.DepartmentId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@d", r.DefaultDeadlineDays);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public static void DeleteAutoRule(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("DELETE FROM AutoRules WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.ExecuteNonQuery();
        }



        // --- DASHBOARD STATS (Optimized: 8 queries → 2) ---
        public static object GetDashboardStats()
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            // ✅ QUERY 1: Tất cả scalar counters trong 1 lượt dùng CASE WHEN
            // Thay thế cho 5 queries riêng lẻ (Total, Overdue, Today, Urgent, TopUrgent)
            int total = 0, overdue = 0, today = 0, urgent = 0;
            var topUrgent = new List<object>();

            using (var cmdCounters = new SqliteCommand(@"
                SELECT
                    COUNT(*) AS Total,
                    SUM(CASE WHEN ThoiHan IS NOT NULL
                              AND ThoiHan < date('now')
                              AND Status != 'Đã hoàn thành' THEN 1 ELSE 0 END) AS Overdue,
                    SUM(CASE WHEN ThoiHan >= date('now')
                              AND ThoiHan < date('now', '+1 day')
                              AND Status != 'Đã hoàn thành' THEN 1 ELSE 0 END) AS Today,
                    SUM(CASE WHEN ThoiHan >= date('now')
                              AND ThoiHan <= date('now', '+7 days')
                              AND Status != 'Đã hoàn thành' THEN 1 ELSE 0 END) AS Urgent
                FROM Documents
            ", connection))
            {
                using var r = cmdCounters.ExecuteReader();
                if (r.Read())
                {
                    total   = r["Total"]   == DBNull.Value ? 0 : Convert.ToInt32(r["Total"]);
                    overdue = r["Overdue"] == DBNull.Value ? 0 : Convert.ToInt32(r["Overdue"]);
                    today   = r["Today"]   == DBNull.Value ? 0 : Convert.ToInt32(r["Today"]);
                    urgent  = r["Urgent"]  == DBNull.Value ? 0 : Convert.ToInt32(r["Urgent"]);
                }
            }

            // ✅ QUERY 2: Group-by status, priority, department + top urgent — 1 connection, sequential
            var statusDict = new Dictionary<string, int>();
            using (var cmdStatus = new SqliteCommand(
                "SELECT COALESCE(Status,'Chưa xử lý'), COUNT(*) FROM Documents GROUP BY Status", connection))
            {
                using var r = cmdStatus.ExecuteReader();
                while (r.Read()) statusDict[r[0]?.ToString() ?? "Chưa xử lý"] = Convert.ToInt32(r[1]);
            }

            var prioDict = new Dictionary<string, int>();
            using (var cmdPrio = new SqliteCommand(
                "SELECT COALESCE(Priority,'Thường'), COUNT(*) FROM Documents GROUP BY Priority", connection))
            {
                using var r = cmdPrio.ExecuteReader();
                while (r.Read()) prioDict[r[0]?.ToString() ?? "Thường"] = Convert.ToInt32(r[1]);
            }

            var deptDict = new Dictionary<string, int>();
            using (var cmdDept = new SqliteCommand(@"
                SELECT IFNULL(d.Name,'Chưa phân loại'), COUNT(doc.Id)
                FROM Documents doc
                LEFT JOIN Departments d ON doc.DepartmentId = d.Id
                GROUP BY d.Name
            ", connection))
            {
                using var r = cmdDept.ExecuteReader();
                while (r.Read())
                    deptDict[r[0]?.ToString() ?? "Chưa phân loại"] = Convert.ToInt32(r[1]);
            }

            using (var cmdTop = new SqliteCommand(@"
                SELECT Id, SoVanBan, TenCongVan, TrichYeu, ThoiHan FROM Documents
                WHERE Status != 'Đã hoàn thành'
                ORDER BY CASE WHEN ThoiHan IS NULL THEN 1 ELSE 0 END, ThoiHan ASC
                LIMIT 3
            ", connection))
            {
                using var r = cmdTop.ExecuteReader();
                while (r.Read())
                    topUrgent.Add(new {
                        Id         = Convert.ToInt32(r["Id"]),
                        SoVanBan   = r["SoVanBan"]?.ToString()   ?? "",
                        TenCongVan = r["TenCongVan"]?.ToString() ?? "",
                        TrichYeu   = r["TrichYeu"]?.ToString()   ?? "",
                        ThoiHan    = r["ThoiHan"]?.ToString()
                    });
            }

            return new {
                Total        = total,
                ByStatus     = statusDict,
                ByPriority   = prioDict,
                Overdue      = overdue,
                Urgent       = urgent,
                Today        = today,
                ByDepartment = deptDict,
                TopUrgent    = topUrgent
            };
        }

        // ✅ OPTIMIZED: N+1 loop (15 queries) → 1 query grouped by ThoiHan
        public static object GetDashboardDeadlineSeries(int days = 14)
        {
            if (days < 1) days = 14;
            if (days > 60) days = 60;

            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            var today   = DateTime.Today;
            var endDate = today.AddDays(days);
            var todayStr  = today.ToString("yyyy-MM-dd");
            var endStr    = endDate.ToString("yyyy-MM-dd");

            // Một query duy nhất lấy toàn bộ dữ liệu:
            //   - Bucket '__overdue__' = tất cả văn bản quá hạn (ThoiHan < today)
            //   - Các ngày còn lại = from today → today+days
            // Dùng được composite index idx_documents_thoihan_status
            var buckets = new Dictionary<string, int>();
            using (var cmd = new SqliteCommand(@"
                SELECT
                    CASE WHEN ThoiHan < @today THEN '__overdue__' ELSE ThoiHan END AS Bucket,
                    COUNT(*) AS Cnt
                FROM Documents
                WHERE Status != 'Đã hoàn thành'
                  AND ThoiHan IS NOT NULL
                  AND ThoiHan < @endDate
                GROUP BY Bucket
            ", connection))
            {
                cmd.Parameters.AddWithValue("@today",   todayStr);
                cmd.Parameters.AddWithValue("@endDate", endStr);
                using var r = cmd.ExecuteReader();
                while (r.Read())
                {
                    var key = r["Bucket"]?.ToString() ?? "";
                    buckets[key] = Convert.ToInt32(r["Cnt"]);
                }
            }

            // Lắp ráp kết quả theo format frontend mong đợi
            var items = new List<object>();

            int overdueCount = buckets.TryGetValue("__overdue__", out int ov) ? ov : 0;
            items.Add(new {
                Date         = "overdue",
                Label        = "Quá hạn",
                Count        = overdueCount,
                OverdueCount = overdueCount,
                TodayCount   = 0,
                UpcomingCount= 0
            });

            for (int i = 0; i < days; i++)
            {
                var date  = today.AddDays(i);
                var key   = date.ToString("yyyy-MM-dd");
                int count = buckets.TryGetValue(key, out int c) ? c : 0;
                items.Add(new {
                    Date         = key,
                    Label        = i == 0 ? "Hôm nay" : $"+{i}",
                    Count        = count,
                    OverdueCount = 0,
                    TodayCount   = i == 0 ? count : 0,
                    UpcomingCount= i > 0  ? count : 0
                });
            }

            return items;
        }

        // --- PUSH SUBSCRIPTION MANAGEMENT ---
        public static List<PushSubscription> GetPushSubscriptions(int userId)
        {
            var list = new List<PushSubscription>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "SELECT Id, UserId, Endpoint, P256dh, Auth, CreatedAt FROM PushSubscriptions WHERE UserId=@uId";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@uId", userId);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new PushSubscription
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    UserId = Convert.ToInt32(reader["UserId"]),
                    Endpoint = reader["Endpoint"].ToString() ?? "",
                    P256dh = reader["P256dh"].ToString() ?? "",
                    Auth = reader["Auth"].ToString() ?? "",
                    CreatedAt = DateTime.Parse(reader["CreatedAt"].ToString() ?? DateTime.UtcNow.AddHours(7).ToString())
                });
            }
            return list;
        }

        public static void InsertPushSubscription(PushSubscription sub)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = @"
                INSERT INTO PushSubscriptions (UserId, Endpoint, P256dh, Auth, CreatedAt) 
                VALUES (@uId, @e, @p, @a, datetime('now', 'localtime'))
                ON CONFLICT(Endpoint) DO UPDATE SET UserId=@uId, P256dh=@p, Auth=@a, CreatedAt=datetime('now', 'localtime')";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@uId", sub.UserId);
            cmd.Parameters.AddWithValue("@e", sub.Endpoint);
            cmd.Parameters.AddWithValue("@p", sub.P256dh);
            cmd.Parameters.AddWithValue("@a", sub.Auth);
            cmd.ExecuteNonQuery();
        }

        public static void DeletePushSubscription(string endpoint)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("DELETE FROM PushSubscriptions WHERE Endpoint=@e", connection);
            cmd.Parameters.AddWithValue("@e", endpoint);
            cmd.ExecuteNonQuery();
        }

        public static bool UpdateUserPassword(int userId, string newPassword)
        {
            try
            {
                // MÃ£ hÃ³a máº­t kháº©u má»›i báº±ng BCrypt trÆ°á»›c khi lÆ°u
                var hashedPassword = BCrypt.Net.BCrypt.HashPassword(newPassword, workFactor: 12);

                using var connection = new SqliteConnection(_connectionString);
                connection.Open();
                using var cmd = new SqliteCommand("UPDATE Users SET PasswordHash=@p WHERE Id=@id", connection);
                cmd.Parameters.AddWithValue("@p", hashedPassword);
                cmd.Parameters.AddWithValue("@id", userId);
                return cmd.ExecuteNonQuery() > 0;
            }
            catch { return false; }
        }

        private static string EscapeCsv(string? val)
        {
            if (string.IsNullOrEmpty(val)) return "";
            return val.Replace("\"", "\"\"");
        }

        private static DateTime? TryParseDate(string? value)
        {
            if (string.IsNullOrEmpty(value)) return null;
            if (DateTime.TryParse(value, out DateTime dt)) return dt;
            return null;
        }
        // --- NOTIFICATION MANAGEMENT ---
        public static List<Core.Models.NotificationRecord> GetNotifications(int userId, int limit = 50)
        {
            var list = new List<Core.Models.NotificationRecord>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "SELECT Id, UserId, Title, Body, Type, DocId, IsRead, CreatedAt FROM Notifications WHERE UserId=@uId ORDER BY CreatedAt DESC LIMIT @limit";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@uId", userId);
            cmd.Parameters.AddWithValue("@limit", limit);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new Core.Models.NotificationRecord
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    UserId = Convert.ToInt32(reader["UserId"]),
                    Title = reader["Title"]?.ToString() ?? "",
                    Body = reader["Body"]?.ToString() ?? "",
                    Type = reader["Type"]?.ToString() ?? "",
                    DocId = reader["DocId"] != DBNull.Value ? Convert.ToInt32(reader["DocId"]) : (int?)null,
                    IsRead = Convert.ToInt32(reader["IsRead"]) == 1,
                    CreatedAt = DateTime.Parse(reader["CreatedAt"]?.ToString() ?? DateTime.UtcNow.AddHours(7).ToString())
                });
            }
            return list;
        }

        public static void InsertNotification(Core.Models.NotificationRecord n)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "INSERT INTO Notifications (UserId, Title, Body, Type, DocId, IsRead, CreatedAt) VALUES (@uId, @t, @b, @type, @docId, 0, @now)";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));
            cmd.Parameters.AddWithValue("@uId", n.UserId);
            cmd.Parameters.AddWithValue("@t", n.Title);
            cmd.Parameters.AddWithValue("@b", n.Body);
            cmd.Parameters.AddWithValue("@type", n.Type);
            cmd.Parameters.AddWithValue("@docId", (object?)n.DocId ?? DBNull.Value);
            cmd.ExecuteNonQuery();
        }

        public static void MarkNotificationAsRead(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("UPDATE Notifications SET IsRead=1 WHERE Id=@id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.ExecuteNonQuery();
        }

        public static void MarkAllNotificationsAsRead(int userId)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("UPDATE Notifications SET IsRead=1 WHERE UserId=@uId", connection);
            cmd.Parameters.AddWithValue("@uId", userId);
            cmd.ExecuteNonQuery();
        }

        // --- REPORTS ---
        public static object GetMonthlyDepartmentReport(int month, int year)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string monthStr = month.ToString("D2");
            string yearStr = year.ToString();
            string prefix = $"{yearStr}-{monthStr}";

            string sql = @"
                SELECT 
                    d.Id,
                    d.Name,
                    COUNT(doc.Id) AS Total,
                    SUM(CASE WHEN doc.Status = 'Đã hoàn thành' AND (doc.ThoiHan IS NULL OR doc.CompletionDate IS NULL OR date(doc.CompletionDate) <= date(doc.ThoiHan)) THEN 1 ELSE 0 END) AS OnTime,
                    SUM(CASE WHEN doc.Status = 'Đã hoàn thành' AND doc.ThoiHan IS NOT NULL AND doc.CompletionDate IS NOT NULL AND date(doc.CompletionDate) > date(doc.ThoiHan) THEN 1 ELSE 0 END) AS Overdue,
                    SUM(CASE WHEN doc.Status != 'Đã hoàn thành' AND (doc.ThoiHan IS NULL OR doc.ThoiHan >= date('now')) THEN 1 ELSE 0 END) AS ProcessingOnTime,
                    SUM(CASE WHEN doc.Status != 'Đã hoàn thành' AND doc.ThoiHan IS NOT NULL AND doc.ThoiHan < date('now') THEN 1 ELSE 0 END) AS ProcessingOverdue
                FROM Departments d
                LEFT JOIN Documents doc ON d.Id = doc.DepartmentId AND doc.NgayThem LIKE @prefix
                WHERE d.IsActive = 1
                GROUP BY d.Id, d.Name
                ORDER BY d.Id
            ";

            var list = new List<object>();
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@prefix", prefix + "%");
            using var reader = cmd.ExecuteReader();
            
            while (reader.Read())
            {
                list.Add(new
                {
                    id = Convert.ToInt32(reader["Id"]),
                    name = reader["Name"]?.ToString() ?? "",
                    total = reader["Total"] == DBNull.Value ? 0 : Convert.ToInt32(reader["Total"]),
                    onTime = reader["OnTime"] == DBNull.Value ? 0 : Convert.ToInt32(reader["OnTime"]),
                    overdue = reader["Overdue"] == DBNull.Value ? 0 : Convert.ToInt32(reader["Overdue"]),
                    processingOnTime = reader["ProcessingOnTime"] == DBNull.Value ? 0 : Convert.ToInt32(reader["ProcessingOnTime"]),
                    processingOverdue = reader["ProcessingOverdue"] == DBNull.Value ? 0 : Convert.ToInt32(reader["ProcessingOverdue"])
                });
            }

            return list;
        }
    }
}



