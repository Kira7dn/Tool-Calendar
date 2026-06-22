using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly string _connectionString;

        public UserRepository(IConfiguration configuration)
        {
            // Lấy từ appsettings.json (ưu tiên cao nhất)
            string? configConnString = configuration.GetConnectionString("DefaultConnection");

            if (!string.IsNullOrEmpty(configConnString))
            {
                _connectionString = configConnString;
            }
            else
            {
                // Fallback về logic cũ để không làm mất dữ liệu hiện tại nếu chưa cấu hình appsettings.json
                string dbPath;
                string? envPath = Environment.GetEnvironmentVariable("DB_PATH");

                if (!string.IsNullOrEmpty(envPath))
                {
                    dbPath = envPath;
                }
                else
                {
                    string appData = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                        "ToolCalendar"
                    );
                    dbPath = Path.Combine(appData, "documents.db");
                }
                _connectionString = $"Data Source={dbPath};Pooling=False;Default Timeout=30";
            }
        }

        // Helper: Map một SqliteDataReader row → User object (kể cả các cột Identity mới)
        private static User MapUser(SqliteDataReader reader, bool includeSensitive = false)
        {
            var user = new User
            {
                Id           = Convert.ToInt32(reader["Id"]),
                Username     = reader["Username"]?.ToString() ?? "",
                FullName     = reader["FullName"]?.ToString() ?? "",
                Email        = reader["Email"]?.ToString() ?? "",
                PhoneNumber  = reader["PhoneNumber"]?.ToString() ?? "",
                Role         = reader["Role"]?.ToString() ?? "Guest",
                DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),
                DepartmentName = HasColumn(reader, "DepartmentName") ? reader["DepartmentName"]?.ToString() : null,
                SessionId    = reader["SessionId"]?.ToString(),
                CreatedAt    = reader["CreatedAt"] != DBNull.Value && DateTime.TryParse(reader["CreatedAt"]?.ToString(), out DateTime dt) ? dt : DateTime.UtcNow,

                // --- Account Lockout cũ ---
                FailedLoginCount = reader["FailedLoginCount"] == DBNull.Value ? 0 : Convert.ToInt32(reader["FailedLoginCount"]),
                LockoutUntil     = ParseNullableDateTime(reader["LockoutUntil"]?.ToString()),

                // --- Identity columns mới — dùng HasColumn() đề phòng migration chưa chạy ---
                SecurityStamp       = HasColumn(reader, "SecurityStamp")
                                        ? (reader["SecurityStamp"]?.ToString() ?? Guid.NewGuid().ToString())
                                        : Guid.NewGuid().ToString(),
                NormalizedUserName  = HasColumn(reader, "NormalizedUserName")
                                        ? (reader["NormalizedUserName"]?.ToString() ?? (reader["Username"]?.ToString() ?? "").ToUpperInvariant())
                                        : (reader["Username"]?.ToString() ?? "").ToUpperInvariant(),
                LockoutEnabled      = HasColumn(reader, "LockoutEnabled")
                                        && reader["LockoutEnabled"] != DBNull.Value
                                        && Convert.ToInt32(reader["LockoutEnabled"]) == 1,
                AccessFailedCount   = HasColumn(reader, "AccessFailedCount") && reader["AccessFailedCount"] != DBNull.Value
                                        ? Convert.ToInt32(reader["AccessFailedCount"]) : 0,
                LockoutEnd          = HasColumn(reader, "LockoutEnd")
                                        ? ParseNullableDateTimeOffset(reader["LockoutEnd"]?.ToString()) : null,
            };

            if (includeSensitive)
            {
                user.PasswordHash = reader["PasswordHash"]?.ToString() ?? "";
            }

            return user;
        }

        private static bool HasColumn(SqliteDataReader reader, string columnName)
        {
            for (int i = 0; i < reader.FieldCount; i++)
                if (reader.GetName(i).Equals(columnName, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        private static DateTime? ParseNullableDateTime(string? raw)
        {
            if (string.IsNullOrEmpty(raw)) return null;
            return DateTime.TryParse(raw, out DateTime result) ? result : null;
        }

        private static DateTimeOffset? ParseNullableDateTimeOffset(string? raw)
        {
            if (string.IsNullOrEmpty(raw)) return null;
            return DateTimeOffset.TryParse(raw, out DateTimeOffset result) ? result : null;
        }

        // ─── READ ────────────────────────────────────────────────────────────────

        public List<User> GetUsers()
        {
            var users = new List<User>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = @"
                SELECT u.Id, u.Username, u.FullName, u.Email, u.PhoneNumber, u.Role,
                       u.DepartmentId, d.Name as DepartmentName, u.SessionId, u.CreatedAt,
                       u.FailedLoginCount, u.LockoutUntil,
                       u.SecurityStamp, u.NormalizedUserName, u.LockoutEnabled, u.AccessFailedCount, u.LockoutEnd
                FROM Users u 
                LEFT JOIN Departments d ON u.DepartmentId = d.Id";
            using var cmd = new SqliteCommand(sql, connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
                users.Add(MapUser(reader));
            return users;
        }

        public User? GetUserById(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = @"
                SELECT u.Id, u.Username, u.PasswordHash, u.FullName, u.Email, u.PhoneNumber, u.Role,
                       u.DepartmentId, d.Name as DepartmentName, u.SessionId, u.CreatedAt,
                       u.FailedLoginCount, u.LockoutUntil,
                       u.SecurityStamp, u.NormalizedUserName, u.LockoutEnabled, u.AccessFailedCount, u.LockoutEnd
                FROM Users u 
                LEFT JOIN Departments d ON u.DepartmentId = d.Id 
                WHERE u.Id=@id";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@id", id);
            using var reader = cmd.ExecuteReader();
            return reader.Read() ? MapUser(reader, includeSensitive: true) : null;
        }

        /// <summary>
        /// Tìm user theo username (case-insensitive qua NormalizedUserName).
        /// Được dùng bởi CustomUserStore của Identity.
        /// </summary>
        public User? GetUserByUsername(string username)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            // Tìm theo NormalizedUserName (in hoa) trước, fallback về Username thường
            string sql = @"
                SELECT u.Id, u.Username, u.PasswordHash, u.FullName, u.Email, u.PhoneNumber, u.Role,
                       u.DepartmentId, u.SessionId, u.CreatedAt,
                       u.FailedLoginCount, u.LockoutUntil,
                       u.SecurityStamp, u.NormalizedUserName, u.LockoutEnabled, u.AccessFailedCount, u.LockoutEnd
                FROM Users u 
                WHERE u.NormalizedUserName = @norm OR u.Username = @raw";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@norm", username.ToUpperInvariant());
            cmd.Parameters.AddWithValue("@raw", username);
            using var reader = cmd.ExecuteReader();
            return reader.Read() ? MapUser(reader, includeSensitive: true) : null;
        }

        // ─── LOGIN (giữ nguyên logic cũ, không thay đổi) ─────────────────────────

        public User? Login(string username, string password)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string sql = @"SELECT Id, Username, PasswordHash, FullName, Role, DepartmentId,
                                  FailedLoginCount, LockoutUntil, SecurityStamp, NormalizedUserName,
                                  LockoutEnabled, AccessFailedCount, LockoutEnd
                           FROM Users WHERE Username=@u OR NormalizedUserName=@norm";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@u", username);
            cmd.Parameters.AddWithValue("@norm", username.ToUpperInvariant());
            using var reader = cmd.ExecuteReader();

            if (!reader.Read()) return null;

            int userId            = Convert.ToInt32(reader["Id"]);
            string storedHash     = reader["PasswordHash"]?.ToString() ?? "";
            string? lockoutRaw    = reader["LockoutUntil"]?.ToString();

            // ── Bước 1: Kiểm tra Account Lockout ──────────────────────────────────
            if (!string.IsNullOrEmpty(lockoutRaw) &&
                DateTime.TryParse(lockoutRaw, out DateTime lockoutUntil) &&
                lockoutUntil > DateTime.UtcNow)
            {
                return null; // Không tiết lộ lý do (chống user enumeration)
            }

            var user = new User
            {
                Id           = userId,
                Username     = reader["Username"]?.ToString() ?? "",
                FullName     = reader["FullName"]?.ToString() ?? "",
                Role         = reader["Role"]?.ToString() ?? "Guest",
                DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),
                SecurityStamp = reader["SecurityStamp"]?.ToString() ?? Guid.NewGuid().ToString(),
            };
            reader.Close();

            // ── Bước 2: Xác minh mật khẩu (Timing-Safe) ──────────────────────────
            bool isValid = false;
            if (storedHash.StartsWith("$2"))
            {
                // BCrypt – timing-safe nội tại
                try { isValid = BCrypt.Net.BCrypt.Verify(password, storedHash); } catch { }
            }
            else
            {
                // Mật khẩu cũ plain-text: dùng FixedTimeEquals để chống Timing Attack
                var storedBytes = System.Text.Encoding.UTF8.GetBytes(storedHash);
                var inputBytes  = System.Text.Encoding.UTF8.GetBytes(password);
                var paddedInput = inputBytes.Length == storedBytes.Length
                    ? inputBytes
                    : System.Text.Encoding.UTF8.GetBytes(password.PadRight(storedHash.Length));
                isValid = System.Security.Cryptography.CryptographicOperations
                              .FixedTimeEquals(storedBytes, paddedInput);
            }

            // ── Bước 3: Xử lý kết quả xác minh ──────────────────────────────────
            if (!isValid)
            {
                using var incCmd = new SqliteCommand(@"
                    UPDATE Users SET
                        FailedLoginCount   = COALESCE(FailedLoginCount, 0) + 1,
                        AccessFailedCount  = COALESCE(AccessFailedCount, 0) + 1,
                        LockoutUntil = CASE
                            WHEN COALESCE(FailedLoginCount, 0) + 1 >= 5
                            THEN datetime('now', '+15 minutes')
                            ELSE LockoutUntil
                        END,
                        LockoutEnd = CASE
                            WHEN COALESCE(FailedLoginCount, 0) + 1 >= 5
                            THEN datetime('now', '+15 minutes')
                            ELSE LockoutEnd
                        END
                    WHERE Id = @id", connection);
                incCmd.Parameters.AddWithValue("@id", userId);
                incCmd.ExecuteNonQuery();
                return null;
            }

            // ── Bước 4: Đăng nhập thành công ─────────────────────────────────────
            // Tự động migrate plain-text → BCrypt nếu cần
            if (!storedHash.StartsWith("$2"))
            {
                var newHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
                using var migrateCmd = new SqliteCommand(
                    "UPDATE Users SET PasswordHash=@h WHERE Id=@id", connection);
                migrateCmd.Parameters.AddWithValue("@h", newHash);
                migrateCmd.Parameters.AddWithValue("@id", userId);
                migrateCmd.ExecuteNonQuery();
                Console.WriteLine($"[Security] Đã migrate mật khẩu plain-text → BCrypt cho user: {user.Username}");
            }

            // Reset bộ đếm sai + tạo SessionId mới
            user.SessionId = Guid.NewGuid().ToString();
            using var updateCmd = new SqliteCommand(@"
                UPDATE Users
                SET SessionId = @s, FailedLoginCount = 0, LockoutUntil = NULL,
                    AccessFailedCount = 0, LockoutEnd = NULL
                WHERE Id = @id", connection);
            updateCmd.Parameters.AddWithValue("@s",  user.SessionId);
            updateCmd.Parameters.AddWithValue("@id", userId);
            updateCmd.ExecuteNonQuery();

            return user;
        }

        // ─── CREATE / UPDATE / DELETE ────────────────────────────────────────────

        public bool CreateUser(User user)
        {
            try
            {
                using var connection = new SqliteConnection(_connectionString);
                connection.Open();

                // Hash mật khẩu nếu chưa hash
                var passwordToStore = (user.PasswordHash?.StartsWith("$2") == true)
                    ? user.PasswordHash
                    : BCrypt.Net.BCrypt.HashPassword(user.PasswordHash ?? "ChangeMe@123", workFactor: 12);

                // Tạo SecurityStamp ngay lúc tạo user để Identity hoạt động đúng
                var securityStamp     = Guid.NewGuid().ToString();
                var normalizedUserName = user.Username.ToUpperInvariant();

                string sql = @"
                    INSERT INTO Users (Username, PasswordHash, FullName, Email, PhoneNumber, Role, DepartmentId, CreatedAt,
                                       SecurityStamp, NormalizedUserName, LockoutEnabled) 
                    VALUES (@u, @p, @f, @e, @pn, @r, @d, @now, @stamp, @norm, 1)";
                using var cmd = new SqliteCommand(sql, connection);
                cmd.Parameters.AddWithValue("@now",   DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));
                cmd.Parameters.AddWithValue("@u",     user.Username);
                cmd.Parameters.AddWithValue("@p",     passwordToStore);
                cmd.Parameters.AddWithValue("@f",     (object?)user.FullName ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@e",     (object?)user.Email ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@pn",    (object?)user.PhoneNumber ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@r",     (object?)user.Role ?? "Guest");
                cmd.Parameters.AddWithValue("@d",     (object?)user.DepartmentId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@stamp", securityStamp);
                cmd.Parameters.AddWithValue("@norm",  normalizedUserName);
                cmd.ExecuteNonQuery();
                return true;
            }
            catch { return false; }
        }

        public void UpdateUser(User user)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            // Khi cập nhật Role → SecurityStamp thay đổi để vô hiệu hóa token cũ
            string sql = @"
                UPDATE Users SET 
                    FullName       = @f, 
                    Email          = @e, 
                    PhoneNumber    = @pn, 
                    Role           = @r, 
                    DepartmentId   = @d,
                    SecurityStamp  = @stamp,
                    NormalizedUserName = upper(Username),
                    PasswordHash   = @ph
                WHERE Id = @id";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@f",     (object?)user.FullName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@e",     (object?)user.Email ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@pn",    (object?)user.PhoneNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@r",     (object?)user.Role ?? "Guest");
            cmd.Parameters.AddWithValue("@d",     (object?)user.DepartmentId ?? DBNull.Value);
            // Tạo SecurityStamp mới mỗi khi thông tin user thay đổi (invalidate token cũ)
            cmd.Parameters.AddWithValue("@stamp", Guid.NewGuid().ToString());
            cmd.Parameters.AddWithValue("@ph",    user.PasswordHash ?? "");
            cmd.Parameters.AddWithValue("@id",    user.Id);
            cmd.ExecuteNonQuery();
        }

        public void DeleteUser(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("DELETE FROM Users WHERE Id=@id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.ExecuteNonQuery();
        }

        public bool Register(string username, string password, string role = "Guest")
        {
            var hashedPassword = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
            return CreateUser(new User { Username = username, PasswordHash = hashedPassword, Role = role });
        }

        public bool UpdateUserPassword(int userId, string newPassword)
        {
            try
            {
                var hashedPassword = BCrypt.Net.BCrypt.HashPassword(newPassword, workFactor: 12);
                using var connection = new SqliteConnection(_connectionString);
                connection.Open();
                // Khi đổi mật khẩu → bắt buộc cập nhật SecurityStamp để vô hiệu hóa tất cả token cũ
                using var cmd = new SqliteCommand(@"
                    UPDATE Users 
                    SET PasswordHash  = @p,
                        SecurityStamp = @stamp
                    WHERE Id = @id", connection);
                cmd.Parameters.AddWithValue("@p",     hashedPassword);
                cmd.Parameters.AddWithValue("@stamp", Guid.NewGuid().ToString());
                cmd.Parameters.AddWithValue("@id",    userId);
                return cmd.ExecuteNonQuery() > 0;
            }
            catch { return false; }
        }

        // ─── ASP.NET CORE IDENTITY SUPPORT METHODS ───────────────────────────────

        /// <summary>Cập nhật SecurityStamp — được gọi khi đổi mật khẩu, đổi role, hoặc bị kick</summary>
        public void UpdateSecurityStamp(int userId, string securityStamp)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand(
                "UPDATE Users SET SecurityStamp = @stamp WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@stamp", securityStamp);
            cmd.Parameters.AddWithValue("@id",    userId);
            cmd.ExecuteNonQuery();
        }

        /// <summary>Cập nhật AccessFailedCount và LockoutEnd (Identity format, đồng bộ với cột cũ)</summary>
        public void UpdateLockout(int userId, int accessFailedCount, DateTimeOffset? lockoutEnd)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand(@"
                UPDATE Users SET
                    AccessFailedCount = @count,
                    FailedLoginCount  = @count,
                    LockoutEnd        = @lockoutEnd,
                    LockoutUntil      = @lockoutUntil
                WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@count",       accessFailedCount);
            cmd.Parameters.AddWithValue("@lockoutEnd",  (object?)lockoutEnd?.ToString("O") ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@lockoutUntil",(object?)lockoutEnd?.UtcDateTime.ToString("yyyy-MM-dd HH:mm:ss") ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@id",          userId);
            cmd.ExecuteNonQuery();
        }

        /// <summary>Reset bộ đếm sai sau khi đăng nhập thành công</summary>
        public void ResetAccessFailedCount(int userId)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand(@"
                UPDATE Users SET 
                    AccessFailedCount = 0, FailedLoginCount = 0,
                    LockoutEnd        = NULL, LockoutUntil    = NULL
                WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@id", userId);
            cmd.ExecuteNonQuery();
        }
    }
}
