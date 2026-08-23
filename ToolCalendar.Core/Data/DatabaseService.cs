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
                    Status TEXT DEFAULT 'Chưa xử lý',
                    Priority TEXT DEFAULT 'Thường',
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
                    SessionId TEXT,
                    SecurityStamp TEXT DEFAULT '',
                    AccessFailedCount INTEGER DEFAULT 0,
                    LockoutEnd TEXT
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
                    Timestamp TEXT,
                    IpAddress TEXT,
                    UserAgent TEXT,
                    IsSuccess INTEGER DEFAULT 1,
                    FailReason TEXT
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
                    Reaction TEXT,
                    CreatedAt TEXT,
                    FOREIGN KEY(CommentId) REFERENCES Comments(Id),
                    UNIQUE(CommentId, UserId, Reaction)
                )";

            string createDocumentRoutingsTable = @"
                CREATE TABLE IF NOT EXISTS DocumentRoutings (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    DocumentId INTEGER NOT NULL,
                    SenderId INTEGER NOT NULL,
                    ReceiverId INTEGER NOT NULL,
                    ParentRoutingId INTEGER,
                    ActionType TEXT,
                    Note TEXT,
                    Status TEXT DEFAULT 'Đang xử lý',
                    ProcessingContent TEXT,
                    CreatedAt TEXT,
                    UpdatedAt TEXT,
                    FOREIGN KEY(DocumentId) REFERENCES Documents(Id) ON DELETE CASCADE,
                    FOREIGN KEY(SenderId) REFERENCES Users(Id),
                    FOREIGN KEY(ReceiverId) REFERENCES Users(Id)
                )";

            string createPushSubscriptionsTable = @"
                CREATE TABLE IF NOT EXISTS PushSubscriptions (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    UserId INTEGER NOT NULL,
                    Endpoint TEXT UNIQUE NOT NULL,
                    P256dh TEXT NOT NULL,
                    Auth TEXT NOT NULL,
                    CreatedAt TEXT
                )";

            string createQuestionnaireTemplatesTable = @"
                CREATE TABLE IF NOT EXISTS QuestionnaireTemplates (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    Name TEXT NOT NULL,
                    CreatedAt TEXT DEFAULT (datetime('now', 'localtime')),
                    UpdatedAt TEXT
                )";

            string createChatMessagesTable = @"
                CREATE TABLE IF NOT EXISTS ChatMessages (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    UserId INTEGER NOT NULL,
                    Role TEXT NOT NULL,
                    Content TEXT NOT NULL,
                    CreatedAt TEXT DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY(UserId) REFERENCES Users(Id) ON DELETE CASCADE
                )";

            string createRemindersTable = @"
                CREATE TABLE IF NOT EXISTS Reminders (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    UserId INTEGER NOT NULL,
                    Content TEXT NOT NULL,
                    RemindAt TEXT NOT NULL,
                    IsSent INTEGER DEFAULT 0,
                    CreatedAt TEXT DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY(UserId) REFERENCES Users(Id) ON DELETE CASCADE
                )";

            string createAiSemanticCacheTable = @"
                CREATE TABLE IF NOT EXISTS AiSemanticCache (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    UserId INTEGER DEFAULT 0,
                    QuestionVectorJson TEXT NOT NULL,
                    Response TEXT NOT NULL,
                    CreatedAt TEXT DEFAULT (datetime('now', 'localtime')),
                    LastAccessedAt TEXT DEFAULT (datetime('now', 'localtime')),
                    HitCount INTEGER DEFAULT 0
                )";

            new SqliteCommand(createDocumentsTable, connection).ExecuteNonQuery();
            new SqliteCommand(createUsersTable, connection).ExecuteNonQuery();
            new SqliteCommand(createDepartmentsTable, connection).ExecuteNonQuery();
            new SqliteCommand(createLabelsTable, connection).ExecuteNonQuery();
            new SqliteCommand(createAutoRulesTable, connection).ExecuteNonQuery();
            new SqliteCommand(createSettingsTable, connection).ExecuteNonQuery();
            new SqliteCommand(createAuditLogsTable, connection).ExecuteNonQuery();
            new SqliteCommand(createNotificationsTable, connection).ExecuteNonQuery();
            new SqliteCommand(createCommentsTable, connection).ExecuteNonQuery();
            new SqliteCommand(createCommentReactionsTable, connection).ExecuteNonQuery();
            new SqliteCommand(createDocumentRoutingsTable, connection).ExecuteNonQuery();
            new SqliteCommand(createPushSubscriptionsTable, connection).ExecuteNonQuery();
            new SqliteCommand(createQuestionnaireTemplatesTable, connection).ExecuteNonQuery();
            new SqliteCommand(createChatMessagesTable, connection).ExecuteNonQuery();
            new SqliteCommand(createRemindersTable, connection).ExecuteNonQuery();
            new SqliteCommand(createAiSemanticCacheTable, connection).ExecuteNonQuery();

            // ── Safe Column Migrations (ALTER TABLE IF NOT EXISTS column) ──────────
            // SQLite không hỗ trợ IF NOT EXISTS cho ALTER TABLE, nên dùng try/catch.
            // Mỗi lần app khởi động sẽ tự thêm cột còn thiếu vào DB cũ, không bao giờ lỗi.
            var safeAlters = new[]
            {
                // Documents
                "ALTER TABLE Documents ADD COLUMN AssignedUserIds TEXT DEFAULT '[]'",
                "ALTER TABLE Documents ADD COLUMN AssignedDepartmentIds TEXT DEFAULT '[]'",
                "ALTER TABLE Documents ADD COLUMN UpdatedAt TEXT",
                // Users
                "ALTER TABLE Users ADD COLUMN NormalizedUserName TEXT",
                "ALTER TABLE Users ADD COLUMN LockoutEnabled INTEGER DEFAULT 1",
                "ALTER TABLE Users ADD COLUMN FailedLoginCount INTEGER DEFAULT 0",
                "ALTER TABLE Users ADD COLUMN LockoutUntil TEXT",
                // Departments
                "ALTER TABLE Departments ADD COLUMN Code TEXT",
                "ALTER TABLE Departments ADD COLUMN ParentId INTEGER",
                // Reminders — fix schema mismatch (IsSent thay vì IsCompleted)
                "ALTER TABLE Reminders ADD COLUMN IsSent INTEGER DEFAULT 0",
                // AiSemanticCache — GPTCache LRU: thêm LastAccessedAt và HitCount cho DB cũ
                "ALTER TABLE AiSemanticCache ADD COLUMN LastAccessedAt TEXT DEFAULT (datetime('now', 'localtime'))",
                "ALTER TABLE AiSemanticCache ADD COLUMN HitCount INTEGER DEFAULT 0",
                "ALTER TABLE AiSemanticCache ADD COLUMN UserId INTEGER DEFAULT 0",
            };

            foreach (var alterSql in safeAlters)
            {
                try
                {
                    new SqliteCommand(alterSql, connection).ExecuteNonQuery();
                }
                catch
                {
                    // Cột đã tồn tại — bỏ qua, không phải lỗi
                }
            }

            // Insert default admin if not exists
            using var checkCmd = new SqliteCommand("SELECT COUNT(*) FROM Users WHERE Role='Admin'", connection);
            long adminCount = (long)checkCmd.ExecuteScalar();
            if (adminCount == 0)
            {
                // Mật khẩu mặc định: admin
                string hash = BCrypt.Net.BCrypt.HashPassword("admin");
                string sql = @"
                    INSERT INTO Users (Username, PasswordHash, FullName, Role, CreatedAt, SecurityStamp) 
                    VALUES ('admin', @hash, 'Administrator', 'Admin', datetime('now', 'localtime'), @stamp)";
                using var insertCmd = new SqliteCommand(sql, connection);
                insertCmd.Parameters.AddWithValue("@hash", hash);
                insertCmd.Parameters.AddWithValue("@stamp", Guid.NewGuid().ToString());
                insertCmd.ExecuteNonQuery();
            }
        }
    }
}
