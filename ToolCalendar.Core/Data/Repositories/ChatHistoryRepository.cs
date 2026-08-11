using System;
using System.Collections.Generic;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Core.Data.Repositories
{
    public class ChatHistoryRepository : IChatHistoryRepository
    {
        private readonly string _connectionString;

        public ChatHistoryRepository(IConfiguration configuration)
        {
            var dbPath = configuration.GetValue<string>("Database:Path") ?? "documents.db";
            _connectionString = $"Data Source={dbPath}";
        }

        public List<ChatMessageDto> GetHistoryByUserId(int userId, int limit = 20)
        {
            var list = new List<ChatMessageDto>();
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            // Lấy `limit` tin nhắn gần nhất nhưng theo thứ tự cũ trước, mới sau
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT * FROM (
                    SELECT Id, UserId, Role, Content, CreatedAt
                    FROM ChatMessages
                    WHERE UserId = @UserId
                    ORDER BY Id DESC
                    LIMIT @Limit
                ) sub
                ORDER BY Id ASC";
            cmd.Parameters.AddWithValue("@UserId", userId);
            cmd.Parameters.AddWithValue("@Limit", limit);

            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new ChatMessageDto
                {
                    Id = reader.GetInt32(0),
                    UserId = reader.GetInt32(1),
                    Role = reader.GetString(2),
                    Content = reader.GetString(3),
                    CreatedAt = reader.IsDBNull(4) ? "" : reader.GetString(4)
                });
            }

            return list;
        }

        public void AddMessage(int userId, string role, string content)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO ChatMessages (UserId, Role, Content, CreatedAt)
                VALUES (@UserId, @Role, @Content, datetime('now', 'localtime'))";
            cmd.Parameters.AddWithValue("@UserId", userId);
            cmd.Parameters.AddWithValue("@Role", role);
            cmd.Parameters.AddWithValue("@Content", content);

            cmd.ExecuteNonQuery();
        }

        public void ClearHistory(int userId)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM ChatMessages WHERE UserId = @UserId";
            cmd.Parameters.AddWithValue("@UserId", userId);

            cmd.ExecuteNonQuery();
        }
    }
}
