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

            // Sử dụng WAL (Write-Ahead Logging) để tăng cường khả năng xử lý song song (concurrency)
            // Đây là cấu hình "Hardening" giúp tránh lỗi "Database is locked" khi Worker đang quét và User đang thao tác.
            try 
            {
                using var walCmd = new SqliteCommand("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;", connection);
                walCmd.ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                // Fallback về DELETE nếu môi trường (Docker Windows cũ) không hỗ trợ WAL
                Console.WriteLine($"[DB Warning] Could not set WAL mode: {ex.Message}. Falling back to DELETE.");
                using var fallbackCmd = new SqliteCommand("PRAGMA journal_mode=DELETE;", connection);
                fallbackCmd.ExecuteNonQuery();
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
                    UploadedByUserId INTEGER DEFAULT 1
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
                    Description TEXT
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
                // LÆ°u Ã½: ChÃºng ta lá»c theo ID ngÆ°á»i dÃ¹ng trong danh sÃ¡ch AssignedUserIds hoáº·c AssignedTo
                cmd.CommandText = "UPDATE Documents SET AssignedTo = NULL WHERE AssignedTo = (SELECT Username FROM Users WHERE Id = @id)";
                cmd.Parameters.AddWithValue("@id", id);
                cmd.ExecuteNonQuery();

                // 2. XÃ³a ngÆ°á»i dÃ¹ng (khÃ´ng cho phÃ©p xÃ³a admin Ä‘á»ƒ báº£o máº­t há»‡ thá»‘ng)
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

            // BÆ°á»›c 1: Láº¥y user theo username (khÃ´ng so sÃ¡nh password trá»±c tiáº¿p trong SQL)
            string sql = "SELECT Id, Username, PasswordHash, FullName, Role, DepartmentId, SessionId FROM Users WHERE Username=@u";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@u", username);
            using var reader = cmd.ExecuteReader();

            if (reader.Read())
            {
                var storedHash = reader["PasswordHash"]?.ToString() ?? "";

                // BÆ°á»›c 2: XÃ¡c minh máº­t kháº©u báº±ng BCrypt (timing-safe, chá»‘ng timing attack)
                // TÆ°Æ¡ng thÃ­ch ngÆ°á»£c: náº¿u hash cÅ© lÃ  plain-text, váº«n cho Ä‘Äƒng nháº­p vÃ  tá»± Ä‘á»™ng migrate
                bool isValid;
                if (storedHash.StartsWith("$2a$") || storedHash.StartsWith("$2b$") || storedHash.StartsWith("$2y$"))
                {
                    // Máº­t kháº©u Ä‘Ã£ Ä‘Æ°á»£c hash BCrypt â€” verify Ä‘Ãºng chuáº©n
                    isValid = BCrypt.Net.BCrypt.Verify(password, storedHash);
                }
                else
                {
                    // Máº­t kháº©u cÅ© plain-text â€” so sÃ¡nh táº¡m thá»i vÃ  tá»± Ä‘á»™ng migrate
                    isValid = storedHash == password;
                }

                if (!isValid)
                {
                    return null;
                }

                var user = new User
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Username = reader["Username"].ToString() ?? "",
                    FullName = reader["FullName"]?.ToString() ?? "",
                    Role = reader["Role"].ToString() ?? "Guest",
                    DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"])
                };

                reader.Close(); // ÄÃ³ng reader trÆ°á»›c khi thá»±c thi update

                // BÆ°á»›c 3: Náº¿u máº­t kháº©u cÅ© lÃ  plain-text -> tá»± Ä‘á»™ng migrate sang BCrypt
                if (!storedHash.StartsWith("$2"))
                {
                    var newHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
                    using var migrateCmd = new SqliteCommand("UPDATE Users SET PasswordHash=@h WHERE Id=@id", connection);
                    migrateCmd.Parameters.AddWithValue("@h", newHash);
                    migrateCmd.Parameters.AddWithValue("@id", user.Id);
                    migrateCmd.ExecuteNonQuery();
                    Console.WriteLine($"[Security] ÄÃ£ tá»± Ä‘á»™ng migrate máº­t kháº©u plain-text sang BCrypt cho user: {user.Username}");
                }

                // BÆ°á»›c 4: Táº¡o Session ID má»›i
                user.SessionId = Guid.NewGuid().ToString();
                using var updateCmd = new SqliteCommand("UPDATE Users SET SessionId=@s WHERE Id=@id", connection);
                updateCmd.Parameters.AddWithValue("@s", user.SessionId);
                updateCmd.Parameters.AddWithValue("@id", user.Id);
                updateCmd.ExecuteNonQuery();

                return user;
            }
            return null;
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
        public static List<Department> GetDepartments()
        {
            var list = new List<Department>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("SELECT Id, Name, Description FROM Departments", connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new Department
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Name = reader["Name"].ToString() ?? "",
                    Description = reader["Description"]?.ToString() ?? ""
                });
            }
            return list;
        }

        public static int InsertDepartment(Department d)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("INSERT INTO Departments (Name, Description) VALUES (@n, @d); SELECT last_insert_rowid();", connection);
            cmd.Parameters.AddWithValue("@n", d.Name);
            cmd.Parameters.AddWithValue("@d", d.Description);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public static void UpdateDepartment(Department d)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("UPDATE Departments SET Name = @n, Description = @d WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@n", d.Name);
            cmd.Parameters.AddWithValue("@d", d.Description);
            cmd.Parameters.AddWithValue("@id", d.Id);
            cmd.ExecuteNonQuery();
        }

        public static void DeleteDepartment(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                using var cmd = connection.CreateCommand();
                cmd.Transaction = transaction;

                // 1. Gá»¡ phÃ²ng ban khá»i cÃ¡c vÄƒn báº£n liÃªn quan
                cmd.CommandText = "UPDATE Documents SET DepartmentId = NULL WHERE DepartmentId = @id";
                cmd.Parameters.AddWithValue("@id", id);
                cmd.ExecuteNonQuery();

                // 2. Gá»¡ phÃ²ng ban khá»i cÃ¡c nhÃ¢n sá»± liÃªn quan
                cmd.CommandText = "UPDATE Users SET DepartmentId = NULL WHERE DepartmentId = @id";
                cmd.ExecuteNonQuery();

                // 3. XÃ³a phÃ²ng ban
                cmd.CommandText = "DELETE FROM Departments WHERE Id = @id";
                cmd.ExecuteNonQuery();

                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
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
            using var cmd = new SqliteCommand("SELECT Id, Keyword, LabelId, DepartmentId, DefaultDeadlineDays FROM AutoRules", connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new AutoRule
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Keyword = reader["Keyword"].ToString() ?? "",
                    LabelId = reader["LabelId"] == DBNull.Value ? null : Convert.ToInt32(reader["LabelId"]),
                    DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),
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



        // --- DASHBOARD STATS ---
        public static object GetDashboardStats()
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            var stats = new
            {
                Total = 0,
                ByStatus = new Dictionary<string, int>(),
                ByPriority = new Dictionary<string, int>(),
                Overdue = 0,
                ByDepartment = new Dictionary<string, int>()
            };

            // 1. Tá»•ng sá»‘
            using var cmdTotal = new SqliteCommand("SELECT COUNT(*) FROM Documents", connection);
            int total = Convert.ToInt32(cmdTotal.ExecuteScalar());

            // 2. Theo Tráº¡ng thÃ¡i
            using var cmdStatus = new SqliteCommand("SELECT COALESCE(Status, 'ChÆ°a xá»­ lÃ½'), COUNT(*) FROM Documents GROUP BY Status", connection);
            using var rStatus = cmdStatus.ExecuteReader();
            var statusDict = new Dictionary<string, int>();
            while (rStatus.Read()) statusDict[rStatus[0]?.ToString() ?? "ChÆ°a xá»­ lÃ½"] = Convert.ToInt32(rStatus[1]);

            // 3. Theo Äá»™ kháº©n
            using var cmdPrio = new SqliteCommand("SELECT COALESCE(Priority, 'ThÆ°á»ng'), COUNT(*) FROM Documents GROUP BY Priority", connection);
            using var rPrio = cmdPrio.ExecuteReader();
            var prioDict = new Dictionary<string, int>();
            while (rPrio.Read()) prioDict[rPrio[0]?.ToString() ?? "ThÆ°á»ng"] = Convert.ToInt32(rPrio[1]);

            // 4. QuÃ¡ háº¡n
            using var cmdOverdue = new SqliteCommand("SELECT COUNT(*) FROM Documents WHERE ThoiHan < date('now') AND Status != 'ÄÃ£ hoÃ n thÃ nh' AND ThoiHan IS NOT NULL", connection);
            int overdue = Convert.ToInt32(cmdOverdue.ExecuteScalar());

            // 5. Theo PhÃ²ng ban (Äáº¿m táº¥t cáº£ vÄƒn báº£n, bao gá»“m cáº£ chÆ°a phÃ¢n loáº¡i)
            using var cmdDept = new SqliteCommand(@"
                SELECT IFNULL(d.Name, 'ChÆ°a phÃ¢n loáº¡i'), COUNT(doc.Id) 
                FROM Documents doc 
                LEFT JOIN Departments d ON doc.DepartmentId = d.Id 
                GROUP BY d.Name", connection);
            using var rDept = cmdDept.ExecuteReader();
            var deptDict = new Dictionary<string, int>();
            while (rDept.Read())
            {
                var name = rDept[0]?.ToString() ?? "ChÆ°a phÃ¢n loáº¡i";
                deptDict[name] = Convert.ToInt32(rDept[1]);
            }

            // 6. Sáº¯p háº¿t háº¡n (7 ngÃ y tá»›i)
            using var cmdUrgent = new SqliteCommand(@"
                SELECT COUNT(*) FROM Documents 
                WHERE ThoiHan >= date('now') AND ThoiHan <= date('now', '+7 days') 
                AND Status != 'ÄÃ£ hoÃ n thÃ nh'", connection);
            int urgent = Convert.ToInt32(cmdUrgent.ExecuteScalar());

            // 7. Äáº¿n háº¡n hÃ´m nay
            using var cmdToday = new SqliteCommand(@"
                SELECT COUNT(*) FROM Documents 
                WHERE date(ThoiHan) = date('now') 
                AND Status != 'ÄÃ£ hoÃ n thÃ nh'", connection);
            int today = Convert.ToInt32(cmdToday.ExecuteScalar());

            // 8. Top 3 văn bản khẩn nhất
            using var cmdTopUrgent = new SqliteCommand(@"
                SELECT Id, SoVanBan, TenCongVan, TrichYeu, ThoiHan FROM Documents 
                WHERE Status != 'Ä Ã£ hoÃ n thÃ nh' 
                ORDER BY CASE WHEN ThoiHan IS NULL THEN 1 ELSE 0 END, ThoiHan ASC 
                LIMIT 3", connection);
            using var rTopUrgent = cmdTopUrgent.ExecuteReader();
            var topUrgent = new List<object>();
            while (rTopUrgent.Read())
            {
                topUrgent.Add(new
                {
                    Id = Convert.ToInt32(rTopUrgent["Id"]),
                    SoVanBan = rTopUrgent["SoVanBan"]?.ToString() ?? "",
                    TenCongVan = rTopUrgent["TenCongVan"]?.ToString() ?? "",
                    TrichYeu = rTopUrgent["TrichYeu"]?.ToString() ?? "",
                    ThoiHan = rTopUrgent["ThoiHan"]?.ToString()
                });
            }

            return new
            {
                Total = total,
                ByStatus = statusDict,
                ByPriority = prioDict,
                Overdue = overdue,
                Urgent = urgent,
                Today = today,
                ByDepartment = deptDict,
                TopUrgent = topUrgent
            };
        }

        public static object GetDashboardDeadlineSeries(int days = 14)
        {
            if (days < 1) days = 14;
            if (days > 60) days = 60;

            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            DateTime today = DateTime.Today;
            string completedStatus = "Đã hoàn thành";
            var items = new List<object>();

            using (var overdueCmd = new SqliteCommand(@"
                SELECT COUNT(*)
                FROM Documents
                WHERE ThoiHan < date(@today)
                AND Status != @completed
                AND ThoiHan IS NOT NULL", connection))
            {
                overdueCmd.Parameters.AddWithValue("@today", today.ToString("yyyy-MM-dd"));
                overdueCmd.Parameters.AddWithValue("@completed", completedStatus);
                int overdueCount = Convert.ToInt32(overdueCmd.ExecuteScalar());
                items.Add(new
                {
                    Date = "overdue",
                    Label = "Quá hạn",
                    Count = overdueCount,
                    OverdueCount = overdueCount,
                    TodayCount = 0,
                    UpcomingCount = 0
                });
            }

            for (int i = 0; i < days; i++)
            {
                DateTime date = today.AddDays(i);
                using var dayCmd = new SqliteCommand(@"
                    SELECT COUNT(*)
                    FROM Documents
                    WHERE date(ThoiHan) = date(@date)
                    AND Status != @completed", connection);
                dayCmd.Parameters.AddWithValue("@date", date.ToString("yyyy-MM-dd"));
                dayCmd.Parameters.AddWithValue("@completed", completedStatus);
                int count = Convert.ToInt32(dayCmd.ExecuteScalar());

                items.Add(new
                {
                    Date = date.ToString("yyyy-MM-dd"),
                    Label = i == 0 ? "Hôm nay" : $"+{i}",
                    Count = count,
                    OverdueCount = 0,
                    TodayCount = i == 0 ? count : 0,
                    UpcomingCount = i > 0 ? count : 0
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
    }
}

