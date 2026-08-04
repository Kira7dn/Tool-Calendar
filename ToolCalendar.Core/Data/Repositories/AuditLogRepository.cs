using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Models;
using System;
using System.Collections.Generic;
using System.IO;

namespace ToolCalendar.Core.Data.Repositories
{
    public class AuditLogRepository : IAuditLogRepository
    {
        private readonly string _connectionString;

        public AuditLogRepository(IConfiguration configuration)
        {
            string? configConnString = configuration.GetConnectionString("DefaultConnection");
            if (!string.IsNullOrEmpty(configConnString)) { _connectionString = configConnString; }
            else
            {
                string? envPath = Environment.GetEnvironmentVariable("DB_PATH");
                if (!string.IsNullOrEmpty(envPath)) { _connectionString = $"Data Source={envPath};Pooling=False;Default Timeout=30"; }
                else
                {
                    string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ToolCalendar");
                    _connectionString = $"Data Source={Path.Combine(appData, "documents.db")};Pooling=False;Default Timeout=30";
                }
            }
        }

        public (List<AuditLog> items, int total) GetAuditLogs(int page = 1, int pageSize = 20, string? roleFilter = null)
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

        public void InsertAuditLog(int? userId, string action)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("INSERT INTO AuditLogs (UserId, Action, Timestamp) VALUES (@u, @a, @now)", connection);
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));
            cmd.Parameters.AddWithValue("@u", (object?)userId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@a", action);
            cmd.ExecuteNonQuery();
        }

        public void InsertLoginAuditLog(string username, int? userId, string? ipAddress, string? userAgent, bool isSuccess, string? failReason = null)
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
                Console.WriteLine($"[LoginAudit] Lỗi ghi log: {ex.Message}");
            }
        }

        public string? GetLastLoginTime(int userId)
        {
            try
            {
                using var connection = new SqliteConnection(_connectionString);
                connection.Open();
                using var cmd = new SqliteCommand(@"
                    SELECT CreatedAt 
                    FROM LoginAuditLog 
                    WHERE UserId = @uid AND IsSuccess = 1 
                    ORDER BY CreatedAt DESC 
                    LIMIT 1", connection);
                cmd.Parameters.AddWithValue("@uid", userId);
                var result = cmd.ExecuteScalar();
                
                if (result != null && result != DBNull.Value)
                {
                    if (DateTime.TryParse(result.ToString(), out DateTime dt))
                    {
                        return dt.ToString("dd/MM/yyyy HH:mm:ss");
                    }
                    return result.ToString(); // fallback
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[LoginAudit] Lỗi đọc log: {ex.Message}");
            }
            return null;
        }

        public void ClearAuditLogs()
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

        public int DeleteOldAuditLogs(int daysToKeep)
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
    }
}
