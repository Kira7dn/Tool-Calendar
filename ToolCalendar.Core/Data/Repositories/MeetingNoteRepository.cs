using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public interface IMeetingNoteRepository
    {
        Task<List<MeetingNote>> GetByUserAsync(int userId, string? search);
        Task<MeetingNote?> GetByIdAsync(int id);
        Task<int> CreateAsync(CreateNoteRequest request, int userId);
        Task<bool> DeleteAsync(int id, int userId);
    }

    public class MeetingNoteRepository : IMeetingNoteRepository
    {
        private readonly string _connectionString;

        public MeetingNoteRepository(IConfiguration configuration)
        {
            var dbPath = Environment.GetEnvironmentVariable("DB_PATH")
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ToolCalendar", "documents.db");
            _connectionString = $"Data Source={dbPath};Pooling=True;Default Timeout=30;Cache=Shared";
        }

        private const string BASE_SELECT = @"
            SELECT n.Id, n.MeetingId, n.UserId, n.Content, n.AttachmentPaths, n.CreatedAt,
                   m.Title as MeetingTitle, m.StartTime as MeetingStartTime,
                   u.FullName as UserFullName
            FROM MeetingNotes n
            JOIN Meetings m ON n.MeetingId = m.Id
            JOIN Users u ON n.UserId = u.Id";

        private static MeetingNote Map(SqliteDataReader r) => new()
        {
            Id = Convert.ToInt32(r["Id"]),
            MeetingId = Convert.ToInt32(r["MeetingId"]),
            MeetingTitle = r["MeetingTitle"]?.ToString(),
            MeetingStartTime = r["MeetingStartTime"] == DBNull.Value
                ? null : DateTime.Parse(r["MeetingStartTime"].ToString()!),
            UserId = Convert.ToInt32(r["UserId"]),
            UserFullName = r["UserFullName"]?.ToString(),
            Content = r["Content"]?.ToString(),
            AttachmentPaths = r["AttachmentPaths"]?.ToString() ?? "[]",
            CreatedAt = r["CreatedAt"] == DBNull.Value
                ? DateTime.UtcNow : DateTime.Parse(r["CreatedAt"].ToString()!),
        };

        public async Task<List<MeetingNote>> GetByUserAsync(int userId, string? search)
        {
            var list = new List<MeetingNote>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            var where = "WHERE n.UserId = @userId";
            if (!string.IsNullOrWhiteSpace(search))
                where += " AND (m.Title LIKE @search OR n.Content LIKE @search)";

            using var cmd = new SqliteCommand($"{BASE_SELECT} {where} ORDER BY n.CreatedAt DESC", connection);
            cmd.Parameters.AddWithValue("@userId", userId);
            if (!string.IsNullOrWhiteSpace(search))
                cmd.Parameters.AddWithValue("@search", $"%{search}%");

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                list.Add(Map(reader));

            return list;
        }

        public async Task<MeetingNote?> GetByIdAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = new SqliteCommand($"{BASE_SELECT} WHERE n.Id = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            using var reader = await cmd.ExecuteReaderAsync();

            return await reader.ReadAsync() ? Map(reader) : null;
        }

        public async Task<int> CreateAsync(CreateNoteRequest req, int userId)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            var pathsJson = System.Text.Json.JsonSerializer.Serialize(req.AttachmentPaths);

            const string sql = @"
                INSERT INTO MeetingNotes (MeetingId, UserId, Content, AttachmentPaths, CreatedAt)
                VALUES (@meetingId, @userId, @content, @paths, @now);
                SELECT last_insert_rowid();";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@meetingId", req.MeetingId);
            cmd.Parameters.AddWithValue("@userId", userId);
            cmd.Parameters.AddWithValue("@content", (object?)req.Content ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@paths", pathsJson);
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));

            return Convert.ToInt32(await cmd.ExecuteScalarAsync());
        }

        public async Task<bool> DeleteAsync(int id, int userId)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            // Chỉ người tạo mới được xóa ghi chú của mình
            using var cmd = new SqliteCommand(
                "DELETE FROM MeetingNotes WHERE Id = @id AND UserId = @userId", connection);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@userId", userId);
            return await cmd.ExecuteNonQueryAsync() > 0;
        }
    }
}
