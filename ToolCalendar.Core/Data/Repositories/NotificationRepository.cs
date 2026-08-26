using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Models;
using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.IO;

namespace ToolCalendar.Core.Data.Repositories
{
    public class NotificationRepository : INotificationRepository
    {
        private readonly string _connectionString;

        public NotificationRepository(IConfiguration configuration)
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

        public async Task<List<Core.Models.NotificationRecord>> GetNotificationsAsync(int userId, int limit = 50)
        {
            var list = new List<Core.Models.NotificationRecord>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            string sql = "SELECT Id, UserId, Title, Body, Type, DocId, IsRead, CreatedAt FROM Notifications WHERE UserId=@uId ORDER BY CreatedAt DESC LIMIT @limit";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@uId", userId);
            cmd.Parameters.AddWithValue("@limit", limit);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
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
        public async Task InsertNotificationAsync(Core.Models.NotificationRecord n)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            string sql = "INSERT INTO Notifications (UserId, Title, Body, Type, DocId, IsRead, CreatedAt) VALUES (@uId, @t, @b, @type, @docId, 0, @now)";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));
            cmd.Parameters.AddWithValue("@uId", n.UserId);
            cmd.Parameters.AddWithValue("@t", n.Title);
            cmd.Parameters.AddWithValue("@b", n.Body);
            cmd.Parameters.AddWithValue("@type", n.Type);
            cmd.Parameters.AddWithValue("@docId", (object?)n.DocId ?? DBNull.Value);
            await cmd.ExecuteNonQueryAsync();
        }
        public async Task MarkNotificationAsReadAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var cmd = new SqliteCommand("UPDATE Notifications SET IsRead=1 WHERE Id=@id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync();
        }
        public async Task MarkAllNotificationsAsReadAsync(int userId)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var cmd = new SqliteCommand("UPDATE Notifications SET IsRead=1 WHERE UserId=@uId", connection);
            cmd.Parameters.AddWithValue("@uId", userId);
            await cmd.ExecuteNonQueryAsync();
        }
        public async Task<List<PushSubscription>> GetPushSubscriptionsAsync(int userId)
        {
            var list = new List<PushSubscription>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            string sql = "SELECT Id, UserId, Endpoint, P256dh, Auth, CreatedAt FROM PushSubscriptions WHERE UserId=@uId";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@uId", userId);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
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
        public async Task InsertPushSubscriptionAsync(PushSubscription sub)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            string sql = @"
                INSERT INTO PushSubscriptions (UserId, Endpoint, P256dh, Auth, CreatedAt) 
                VALUES (@uId, @e, @p, @a, datetime('now', 'localtime'))
                ON CONFLICT(Endpoint) DO UPDATE SET UserId=@uId, P256dh=@p, Auth=@a, CreatedAt=datetime('now', 'localtime')";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@uId", sub.UserId);
            cmd.Parameters.AddWithValue("@e", sub.Endpoint);
            cmd.Parameters.AddWithValue("@p", sub.P256dh);
            cmd.Parameters.AddWithValue("@a", sub.Auth);
            await cmd.ExecuteNonQueryAsync();
        }
        public async Task DeletePushSubscriptionAsync(string endpoint)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var cmd = new SqliteCommand("DELETE FROM PushSubscriptions WHERE Endpoint=@e", connection);
            cmd.Parameters.AddWithValue("@e", endpoint);
            await cmd.ExecuteNonQueryAsync();
        }
    }
}
