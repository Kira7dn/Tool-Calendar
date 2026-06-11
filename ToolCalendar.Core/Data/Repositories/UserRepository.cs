using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly string _connectionString;

        public UserRepository(Microsoft.Extensions.Configuration.IConfiguration configuration)
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

        public List<User> GetUsers()
        {
            var users = new List<User>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = @"
                SELECT u.*, d.Name as DepartmentName 
                FROM Users u 
                LEFT JOIN Departments d ON u.DepartmentId = d.Id";
            using var cmd = new SqliteCommand(sql, connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                users.Add(new User
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Username = reader["Username"].ToString() ?? "",
                    FullName = reader["FullName"]?.ToString() ?? "",
                    Email = reader["Email"]?.ToString() ?? "",
                    PhoneNumber = reader["PhoneNumber"]?.ToString() ?? "",
                    Role = reader["Role"].ToString() ?? "Guest",
                    DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),
                    DepartmentName = reader["DepartmentName"]?.ToString(),
                    CreatedAt = reader["CreatedAt"] != DBNull.Value && DateTime.TryParse(reader["CreatedAt"]?.ToString(), out DateTime dt) ? dt : DateTime.UtcNow
                });
            }
            return users;
        }

        public User? GetUserById(int id)
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

        public User? Login(string username, string password)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            // Lấy user kèm thông tin lockout
            string sql = @"SELECT Id, Username, PasswordHash, FullName, Role, DepartmentId,
                                  FailedLoginCount, LockoutUntil
                           FROM Users WHERE Username=@u";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@u", username);
            using var reader = cmd.ExecuteReader();

            if (!reader.Read()) return null;

            int userId            = Convert.ToInt32(reader["Id"]);
            string storedHash     = reader["PasswordHash"]?.ToString() ?? "";
            string? lockoutUtilRaw = reader["LockoutUntil"]?.ToString();

            // ── Bước 1: Kiểm tra Account Lockout ──────────────────────────────
            if (!string.IsNullOrEmpty(lockoutUtilRaw) &&
                DateTime.TryParse(lockoutUtilRaw, out DateTime lockoutUntil) &&
                lockoutUntil > DateTime.UtcNow)
            {
                // Trả về null mà không tiết lộ lý do (chống user enumeration)
                return null;
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
                // Đệm về cùng độ dài để so sánh constant-time
                var paddedInput = inputBytes.Length == storedBytes.Length
                    ? inputBytes
                    : System.Text.Encoding.UTF8.GetBytes(password.PadRight(storedHash.Length));
                isValid = System.Security.Cryptography.CryptographicOperations
                              .FixedTimeEquals(storedBytes, paddedInput);
            }

            // ── Bước 3: Xử lý kết quả xác minh ──────────────────────────────
            if (!isValid)
            {
                // Tăng bộ đếm sai → tự động khóa sau 5 lần
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
            // Tự động migrate plain-text → BCrypt
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
                SET SessionId = @s, FailedLoginCount = 0, LockoutUntil = NULL
                WHERE Id = @id", connection);
            updateCmd.Parameters.AddWithValue("@s",  user.SessionId);
            updateCmd.Parameters.AddWithValue("@id", userId);
            updateCmd.ExecuteNonQuery();

            return user;
        }

        public bool CreateUser(User user)
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

                var passwordToStore = (user.PasswordHash?.StartsWith("$2") == true)
                    ? user.PasswordHash
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

        public void UpdateUser(User user)
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

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@f", (object?)user.FullName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@e", (object?)user.Email ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@pn", (object?)user.PhoneNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@r", (object?)user.Role ?? "Guest");
            cmd.Parameters.AddWithValue("@d", (object?)user.DepartmentId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@id", user.Id);
            cmd.ExecuteNonQuery();
        }

        public void DeleteUser(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "DELETE FROM Users WHERE Id=@id";
            using var cmd = new SqliteCommand(sql, connection);
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
                using var cmd = new SqliteCommand("UPDATE Users SET PasswordHash=@p WHERE Id=@id", connection);
                cmd.Parameters.AddWithValue("@p", hashedPassword);
                cmd.Parameters.AddWithValue("@id", userId);
                return cmd.ExecuteNonQuery() > 0;
            }
            catch { return false; }
        }
    }
}
