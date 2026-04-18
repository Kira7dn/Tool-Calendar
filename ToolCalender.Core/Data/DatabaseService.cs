using Microsoft.Data.Sqlite;
using ToolCalender.Models;
using System.Text;

namespace ToolCalender.Data
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
                    "ToolCalender"
                );
                Directory.CreateDirectory(appData);
                dbPath = Path.Combine(appData, "documents.db");
            }

            _connectionString = $"Data Source={dbPath}";

            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string createDocumentsTable = @"
                CREATE TABLE IF NOT EXISTS Documents (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    SoVanBan TEXT,
                    TenCongVan TEXT,
                    TrichYeu TEXT,
                    FullText TEXT,
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
                    CreatedAt TEXT
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

            string createCommentsTable = @"
                CREATE TABLE IF NOT EXISTS Comments (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    DocumentId INTEGER,
                    UserId INTEGER,
                    Username TEXT,
                    Content TEXT,
                    CreatedAt TEXT,
                    FOREIGN KEY(DocumentId) REFERENCES Documents(Id)
                )";

            using var cmd = new SqliteCommand(createDocumentsTable, connection);
            cmd.ExecuteNonQuery();

            cmd.CommandText = createUsersTable;
            cmd.ExecuteNonQuery();

            cmd.CommandText = createCommentsTable;
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

            // --- SEED SETTINGS ---
            cmd.CommandText = "SELECT COUNT(*) FROM AppSettings WHERE [Key] = 'Notification_ScanTime'";
            if (Convert.ToInt32(cmd.ExecuteScalar()) == 0)
            {
                cmd.CommandText = "INSERT INTO AppSettings ([Key], [Value]) VALUES ('Notification_ScanTime', '08:30')";
                cmd.ExecuteNonQuery();
            }

            // Đảm bảo tài khoản admin luôn đúng mật khẩu admin@123456
            cmd.CommandText = "SELECT COUNT(*) FROM Users WHERE Username='admin'";
            if (Convert.ToInt32(cmd.ExecuteScalar()) == 0)
            {
                cmd.CommandText = "INSERT INTO Users (Username, PasswordHash, Role, CreatedAt) VALUES ('admin', 'admin@123456', 'Admin', datetime('now'))";
                cmd.ExecuteNonQuery();
            }
            else
            {
                // Nếu đã có admin, ép cập nhật mật khẩu mới cho chắc chắn
                cmd.CommandText = "UPDATE Users SET PasswordHash='admin@123456' WHERE Username='admin'";
                cmd.ExecuteNonQuery();
            }

            // --- SEED DEPARTMENTS ---
            cmd.CommandText = "SELECT COUNT(*) FROM Departments";
            if (Convert.ToInt32(cmd.ExecuteScalar()) == 0)
            {
                var deps = new[] { "Văn phòng", "Kinh tế - Hạ tầng", "Văn hóa - Xã hội", "Tư pháp - Hộ tịch", "Địa chính - Xây dựng" };
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
            string sql = "SELECT Id, Username, FullName, Email, Role, DepartmentId FROM Users";
            using var cmd = new SqliteCommand(sql, connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new User {
                    Id = Convert.ToInt32(reader["Id"]),
                    Username = reader["Username"].ToString() ?? "",
                    FullName = reader["FullName"]?.ToString() ?? "",
                    Email = reader["Email"]?.ToString() ?? "",
                    Role = reader["Role"].ToString() ?? "",
                    DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"])
                });
            }
            return list;
        }

        public static void DeleteUser(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("DELETE FROM Users WHERE Id=@Id AND Username != 'admin'", connection);
            cmd.Parameters.AddWithValue("@Id", id);
            cmd.ExecuteNonQuery();
        }

        public static User? Login(string username, string password)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "SELECT * FROM Users WHERE Username=@u AND PasswordHash=@p";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@u", username);
            cmd.Parameters.AddWithValue("@p", password); // Đang để text cho đơn giản, có thể nâng cấp băm mật khẩu sau
            using var reader = cmd.ExecuteReader();
            if (reader.Read())
            {
                return new User {
                    Id = Convert.ToInt32(reader["Id"]),
                    Username = reader["Username"].ToString() ?? "",
                    FullName = reader["FullName"]?.ToString() ?? "",
                    Role = reader["Role"].ToString() ?? "Guest",
                    DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"])
                };
            }
            return null;
        }

        public static bool Register(string username, string password, string role = "Guest")
        {
            try {
                using var connection = new SqliteConnection(_connectionString);
                connection.Open();
                string sql = "INSERT INTO Users (Username, PasswordHash, FullName, Role, CreatedAt) VALUES (@u, @p, @f, @r, datetime('now'))";
                using var cmd = new SqliteCommand(sql, connection);
                cmd.Parameters.AddWithValue("@u", username);
                cmd.Parameters.AddWithValue("@p", password);
                cmd.Parameters.AddWithValue("@f", username); // Tạm thời dùng username cho FullName
                cmd.Parameters.AddWithValue("@r", role);
                cmd.ExecuteNonQuery();
                return true;
            } catch { return false; }
        }

        // --- COMMENT MANAGEMENT ---
        public static List<Comment> GetComments(int docId)
        {
            var list = new List<Comment>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "SELECT * FROM Comments WHERE DocumentId=@id ORDER BY CreatedAt ASC";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@id", docId);
            using var reader = cmd.ExecuteReader();
            while(reader.Read())
            {
                list.Add(new Comment {
                    Id = Convert.ToInt32(reader["Id"]),
                    DocumentId = Convert.ToInt32(reader["DocumentId"]),
                    UserId = Convert.ToInt32(reader["UserId"]),
                    Username = reader["Username"].ToString() ?? "",
                    Content = reader["Content"].ToString() ?? "",
                    CreatedAt = DateTime.Parse(reader["CreatedAt"].ToString() ?? DateTime.Now.ToString())
                });
            }
            return list;
        }

        public static void InsertComment(Comment c)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "INSERT INTO Comments (DocumentId, UserId, Username, Content, CreatedAt) VALUES (@docId, @uId, @uName, @c, datetime('now'))";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@docId", c.DocumentId);
            cmd.Parameters.AddWithValue("@uId", c.UserId);
            cmd.Parameters.AddWithValue("@uName", c.Username);
            cmd.Parameters.AddWithValue("@c", c.Content);
            cmd.ExecuteNonQuery();
        }

        public static List<DocumentRecord> GetAll()
        {
            var records = new List<DocumentRecord>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string sql = "SELECT * FROM Documents ORDER BY ThoiHan ASC NULLS LAST";
            using var cmd = new SqliteCommand(sql, connection);
            using var reader = cmd.ExecuteReader();

            while (reader.Read())
                records.Add(MapRecord(reader));

            return records;
        }

        public static int Insert(DocumentRecord record)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string sql = @"
                INSERT INTO Documents (SoVanBan, TenCongVan, TrichYeu, FullText, NgayBanHanh, CoQuanBanHanh, CoQuanChuQuan, ThoiHan, DonViChiDao, FilePath, Status, Priority, DepartmentId, AssignedTo, EvidencePaths, EvidenceNotes, CompletionDate, LabelId, NgayThem, DaTaoLich)
                VALUES (@SoVanBan, @TenCongVan, @TrichYeu, @FullText, @NgayBanHanh, @CoQuanBanHanh, @CoQuanChuQuan, @ThoiHan, @DonViChiDao, @FilePath, @Status, @Priority, @DepartmentId, @AssignedTo, @EvidencePaths, @EvidenceNotes, @CompletionDate, @LabelId, @NgayThem, @DaTaoLich);
                SELECT last_insert_rowid();";

            using var cmd = new SqliteCommand(sql, connection);
            AddParams(cmd, record);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public static void Update(DocumentRecord record)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string sql = @"
                UPDATE Documents SET
                    SoVanBan=@SoVanBan, TenCongVan=@TenCongVan, TrichYeu=@TrichYeu, FullText=@FullText, 
                    NgayBanHanh=@NgayBanHanh, CoQuanBanHanh=@CoQuanBanHanh, CoQuanChuQuan=@CoQuanChuQuan,
                    ThoiHan=@ThoiHan, DonViChiDao=@DonViChiDao, FilePath=@FilePath, 
                    Status=@Status, Priority=@Priority, DepartmentId=@DepartmentId, 
                    AssignedTo=@AssignedTo, EvidencePaths=@EvidencePaths, EvidenceNotes=@EvidenceNotes, 
                    CompletionDate=@CompletionDate, LabelId=@LabelId, DaTaoLich=@DaTaoLich
                WHERE Id=@Id";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@Id", record.Id);
            AddParams(cmd, record);
            cmd.ExecuteNonQuery();
        }

        public static void AssignDocument(int docId, int? departmentId, int? userId)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "UPDATE Documents SET DepartmentId=@deptId, AssignedTo=@uId, Status='Chưa xử lý' WHERE Id=@docId";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@deptId", (object?)departmentId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@uId", (object?)userId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@docId", docId);
            cmd.ExecuteNonQuery();
        }

        public static void SubmitEvidence(int docId, string evidenceJson, string notes)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = @"
                UPDATE Documents SET 
                    EvidencePaths=@paths, 
                    EvidenceNotes=@notes, 
                    Status='Đã hoàn thành', 
                    CompletionDate=datetime('now') 
                WHERE Id=@docId";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@paths", evidenceJson);
            cmd.Parameters.AddWithValue("@notes", notes);
            cmd.Parameters.AddWithValue("@docId", docId);
            cmd.ExecuteNonQuery();
        }

        public static void Delete(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("DELETE FROM Documents WHERE Id=@Id", connection);
            cmd.Parameters.AddWithValue("@Id", id);
            cmd.ExecuteNonQuery();
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

        public static void InsertAuditLog(int? userId, string action)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("INSERT INTO AuditLogs (UserId, Action, Timestamp) VALUES (@u, @a, datetime('now'))", connection);
            cmd.Parameters.AddWithValue("@u", (object?)userId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@a", action);
            cmd.ExecuteNonQuery();
        }

        private static void AddParams(SqliteCommand cmd, DocumentRecord r)
        {
            cmd.Parameters.AddWithValue("@SoVanBan", (object?)r.SoVanBan ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@TenCongVan", (object?)r.TenCongVan ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@TrichYeu", (object?)r.TrichYeu ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@FullText", (object?)r.FullText ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@NgayBanHanh", r.NgayBanHanh.HasValue ? (object)r.NgayBanHanh.Value.ToString("yyyy-MM-dd") : DBNull.Value);
            cmd.Parameters.AddWithValue("@CoQuanBanHanh", (object?)r.CoQuanBanHanh ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@CoQuanChuQuan", (object?)r.CoQuanChuQuan ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ThoiHan", r.ThoiHan.HasValue ? (object)r.ThoiHan.Value.ToString("yyyy-MM-dd") : DBNull.Value);
            cmd.Parameters.AddWithValue("@DonViChiDao", (object?)r.DonViChiDao ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@FilePath", (object?)r.FilePath ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Status", (object?)r.Status ?? "Chưa xử lý");
            cmd.Parameters.AddWithValue("@Priority", (object?)r.Priority ?? "Thường");
            cmd.Parameters.AddWithValue("@DepartmentId", (object?)r.DepartmentId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@AssignedTo", (object?)r.AssignedTo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@EvidencePaths", (object?)r.EvidencePaths ?? "[]");
            cmd.Parameters.AddWithValue("@EvidenceNotes", (object?)r.EvidenceNotes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@CompletionDate", r.CompletionDate.HasValue ? (object)r.CompletionDate.Value.ToString("yyyy-MM-dd") : DBNull.Value);
            cmd.Parameters.AddWithValue("@LabelId", (object?)r.LabelId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@NgayThem", r.NgayThem.ToString("yyyy-MM-dd HH:mm:ss"));
            cmd.Parameters.AddWithValue("@DaTaoLich", r.DaTaoLich ? 1 : 0);
        }

        private static DocumentRecord MapRecord(SqliteDataReader r)
        {
            return new DocumentRecord
            {
                Id = Convert.ToInt32(r["Id"]),
                SoVanBan = r["SoVanBan"]?.ToString() ?? "",
                TenCongVan = r["TenCongVan"]?.ToString() ?? "",
                TrichYeu = r["TrichYeu"]?.ToString() ?? "",
                FullText = r["FullText"]?.ToString() ?? "",
                NgayBanHanh = TryParseDate(r["NgayBanHanh"]?.ToString()),
                CoQuanBanHanh = r["CoQuanBanHanh"]?.ToString() ?? "",
                CoQuanChuQuan = r["CoQuanChuQuan"]?.ToString() ?? "",
                ThoiHan = TryParseDate(r["ThoiHan"]?.ToString()),
                DonViChiDao = r["DonViChiDao"]?.ToString() ?? "",
                FilePath = r["FilePath"]?.ToString() ?? "",
                Status = r["Status"]?.ToString() ?? "Chưa xử lý",
                Priority = r["Priority"]?.ToString() ?? "Thường",
                DepartmentId = r["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(r["DepartmentId"]),
                AssignedTo = r["AssignedTo"] == DBNull.Value ? null : Convert.ToInt32(r["AssignedTo"]),
                EvidencePaths = r["EvidencePaths"]?.ToString() ?? "[]",
                EvidenceNotes = r["EvidenceNotes"]?.ToString() ?? "",
                CompletionDate = TryParseDate(r["CompletionDate"]?.ToString()),
                LabelId = r["LabelId"] == DBNull.Value ? null : Convert.ToInt32(r["LabelId"]),
                NgayThem = TryParseDate(r["NgayThem"]?.ToString()) ?? DateTime.Now,
                DaTaoLich = Convert.ToInt32(r["DaTaoLich"]) == 1
            };
        }

        // --- DEPARTMENT MANAGEMENT ---
        public static List<Department> GetDepartments()
        {
            var list = new List<Department>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("SELECT * FROM Departments", connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new Department {
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

        public static void DeleteDepartment(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            // Gỡ phòng ban khỏi các văn bản liên quan
            using var cmd = new SqliteCommand("UPDATE Documents SET DepartmentId = NULL WHERE DepartmentId = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.ExecuteNonQuery();

            cmd.CommandText = "DELETE FROM Departments WHERE Id = @id";
            cmd.ExecuteNonQuery();
        }

        // --- LABEL MANAGEMENT ---
        public static List<DocumentLabel> GetLabels()
        {
            var list = new List<DocumentLabel>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("SELECT * FROM Labels", connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new DocumentLabel {
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
            // Xóa nhãn khỏi các văn bản liên quan (Theo yêu cầu người dùng)
            using var cmd = new SqliteCommand("UPDATE Documents SET LabelId = NULL WHERE LabelId = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.ExecuteNonQuery();

            cmd.CommandText = "DELETE FROM Labels WHERE Id = @id";
            cmd.ExecuteNonQuery();
        }

        // --- AUTO RULE MANAGEMENT ---
        public static List<AutoRule> GetAutoRules()
        {
            var list = new List<AutoRule>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("SELECT * FROM AutoRules", connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new AutoRule {
                    Id = Convert.ToInt32(reader["Id"]),
                    Keyword = reader["Keyword"].ToString() ?? "",
                    LabelId = Convert.ToInt32(reader["LabelId"]),
                    DefaultDeadlineDays = Convert.ToInt32(reader["DefaultDeadlineDays"])
                });
            }
            return list;
        }

        public static int InsertAutoRule(AutoRule r)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("INSERT INTO AutoRules (Keyword, LabelId, DefaultDeadlineDays) VALUES (@k, @l, @d); SELECT last_insert_rowid();", connection);
            cmd.Parameters.AddWithValue("@k", r.Keyword);
            cmd.Parameters.AddWithValue("@l", r.LabelId);
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

        // --- EXPORT CSV ---
        public static byte[] ExportDocumentsToCsv()
        {
            var sb = new StringBuilder();
            // UTF-8 BOM để Excel hiển thị đúng tiếng Việt
            sb.Append('\uFEFF');
            
            // Header
            sb.AppendLine("ID,Số Văn Bản,Tên Công Văn,Trích Yếu,Ngày Ban Hành,Cơ Quan Ban Hành,Thời Hạn,Trạng Thái,Độ Khẩn,Ngày Thêm");

            var docs = GetAll();
            foreach (var d in docs)
            {
                var line = $"{d.Id}," +
                           $"\"{EscapeCsv(d.SoVanBan)}\"," +
                           $"\"{EscapeCsv(d.TenCongVan)}\"," +
                           $"\"{EscapeCsv(d.TrichYeu)}\"," +
                           $"\"{d.NgayBanHanh:dd/MM/yyyy}\"," +
                           $"\"{EscapeCsv(d.CoQuanBanHanh)}\"," +
                           $"\"{d.ThoiHan:dd/MM/yyyy}\"," +
                           $"\"{EscapeCsv(d.Status)}\"," +
                           $"\"{EscapeCsv(d.Priority)}\"," +
                           $"\"{d.NgayThem:dd/MM/yyyy HH:mm}\"";
                sb.AppendLine(line);
            }

            return Encoding.UTF8.GetBytes(sb.ToString());
        }

        // --- DASHBOARD STATS ---
        public static object GetDashboardStats()
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            var stats = new {
                Total = 0,
                ByStatus = new Dictionary<string, int>(),
                ByPriority = new Dictionary<string, int>(),
                Overdue = 0,
                ByDepartment = new Dictionary<string, int>()
            };

            // 1. Tổng số
            using var cmdTotal = new SqliteCommand("SELECT COUNT(*) FROM Documents", connection);
            int total = Convert.ToInt32(cmdTotal.ExecuteScalar());

            // 2. Theo Trạng thái
            using var cmdStatus = new SqliteCommand("SELECT Status, COUNT(*) FROM Documents GROUP BY Status", connection);
            using var rStatus = cmdStatus.ExecuteReader();
            var statusDict = new Dictionary<string, int>();
            while (rStatus.Read()) statusDict[rStatus[0].ToString() ?? "N/A"] = Convert.ToInt32(rStatus[1]);

            // 3. Theo Độ khẩn
            using var cmdPrio = new SqliteCommand("SELECT Priority, COUNT(*) FROM Documents GROUP BY Priority", connection);
            using var rPrio = cmdPrio.ExecuteReader();
            var prioDict = new Dictionary<string, int>();
            while (rPrio.Read()) prioDict[rPrio[0].ToString() ?? "N/A"] = Convert.ToInt32(rPrio[1]);

            // 4. Quá hạn
            using var cmdOverdue = new SqliteCommand("SELECT COUNT(*) FROM Documents WHERE ThoiHan < date('now') AND Status != 'Đã hoàn thành' AND ThoiHan IS NOT NULL", connection);
            int overdue = Convert.ToInt32(cmdOverdue.ExecuteScalar());

            // 5. Theo Phòng ban
            using var cmdDept = new SqliteCommand(@"
                SELECT d.Name, COUNT(doc.Id) 
                FROM Departments d 
                LEFT JOIN Documents doc ON d.Id = doc.DepartmentId 
                GROUP BY d.Name", connection);
            using var rDept = cmdDept.ExecuteReader();
            var deptDict = new Dictionary<string, int>();
            while (rDept.Read()) deptDict[rDept[0].ToString() ?? "N/A"] = Convert.ToInt32(rDept[1]);

            return new {
                Total = total,
                ByStatus = statusDict,
                ByPriority = prioDict,
                Overdue = overdue,
                ByDepartment = deptDict
            };
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
    }
}
