using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Threading.Tasks;
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
            var dbPath = Environment.GetEnvironmentVariable("DB_PATH")
                      ?? configuration.GetValue<string>("Database:Path")
                      ?? "documents.db";
            _connectionString = $"Data Source={dbPath};Pooling=True;Default Timeout=30;Cache=Shared";
        }
        public async Task<List<ChatMessageDto>> GetHistoryByUserIdAsync(int userId, int limit = 20)
        {
            var list = new List<ChatMessageDto>();
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

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

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
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
        public async Task AddMessageAsync(int userId, string role, string content)
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO ChatMessages (UserId, Role, Content, CreatedAt)
                VALUES (@UserId, @Role, @Content, datetime('now', 'localtime'))";
            cmd.Parameters.AddWithValue("@UserId", userId);
            cmd.Parameters.AddWithValue("@Role", role);
            cmd.Parameters.AddWithValue("@Content", content);

            await cmd.ExecuteNonQueryAsync();
        }
        public async Task ClearHistoryAsync(int userId)
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM ChatMessages WHERE UserId = @UserId";
            cmd.Parameters.AddWithValue("@UserId", userId);

            await cmd.ExecuteNonQueryAsync();
        }
    }
}
