using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public interface IMeetingConclusionRepository
    {
        Task<List<MeetingConclusion>> GetAllAsync(string? search, int page, int pageSize);
        Task<int> CountAllAsync(string? search);
        Task<MeetingConclusion?> GetByIdAsync(int id);
        Task<int> CreateAsync(CreateConclusionRequest request);
        Task<bool> UpdateAsync(int id, UpdateConclusionRequest request);
        Task<bool> DeleteAsync(int id);
    }

    public class MeetingConclusionRepository : IMeetingConclusionRepository
    {
        private readonly string _connectionString;

        public MeetingConclusionRepository(IConfiguration configuration)
        {
            var dbPath = Environment.GetEnvironmentVariable("DB_PATH")
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ToolCalendar", "documents.db");
            _connectionString = $"Data Source={dbPath};Pooling=True;Default Timeout=30;Cache=Shared";
        }

        private const string BASE_SELECT = @"
            SELECT c.Id, c.MeetingId, c.FileName, c.Status, c.LastHandlerId, c.Progress, c.UpdatedAt,
                   m.Title as MeetingTitle,
                   u.FullName as LastHandlerName,
                   u.Role as LastHandlerRole
            FROM MeetingConclusions c
            JOIN Meetings m ON c.MeetingId = m.Id
            LEFT JOIN Users u ON c.LastHandlerId = u.Id";

        private static MeetingConclusion Map(SqliteDataReader r) => new()
        {
            Id = Convert.ToInt32(r["Id"]),
            MeetingId = Convert.ToInt32(r["MeetingId"]),
            MeetingTitle = r["MeetingTitle"]?.ToString(),
            FileName = r["FileName"]?.ToString(),
            Status = r["Status"]?.ToString() ?? "Chưa xử lý",
            LastHandlerId = r["LastHandlerId"] == DBNull.Value ? null : Convert.ToInt32(r["LastHandlerId"]),
            LastHandlerName = r["LastHandlerName"]?.ToString(),
            LastHandlerRole = r["LastHandlerRole"]?.ToString(),
            Progress = r["Progress"] == DBNull.Value ? 0 : Convert.ToInt32(r["Progress"]),
            UpdatedAt = r["UpdatedAt"] == DBNull.Value ? null : DateTime.Parse(r["UpdatedAt"].ToString()!),
        };

        public async Task<List<MeetingConclusion>> GetAllAsync(string? search, int page, int pageSize)
        {
            var list = new List<MeetingConclusion>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            var where = string.IsNullOrWhiteSpace(search) ? "" : "WHERE m.Title LIKE @search OR c.FileName LIKE @search";
            var sql = $"{BASE_SELECT} {where} ORDER BY c.UpdatedAt DESC LIMIT @limit OFFSET @offset";

            using var cmd = new SqliteCommand(sql, connection);
            if (!string.IsNullOrWhiteSpace(search))
                cmd.Parameters.AddWithValue("@search", $"%{search}%");
            cmd.Parameters.AddWithValue("@limit", pageSize);
            cmd.Parameters.AddWithValue("@offset", (page - 1) * pageSize);

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                list.Add(Map(reader));

            return list;
        }

        public async Task<int> CountAllAsync(string? search)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            var where = string.IsNullOrWhiteSpace(search) ? "" : "WHERE m.Title LIKE @search OR c.FileName LIKE @search";
            var sql = $"SELECT COUNT(*) FROM MeetingConclusions c JOIN Meetings m ON c.MeetingId = m.Id {where}";

            using var cmd = new SqliteCommand(sql, connection);
            if (!string.IsNullOrWhiteSpace(search))
                cmd.Parameters.AddWithValue("@search", $"%{search}%");

            return Convert.ToInt32(await cmd.ExecuteScalarAsync());
        }

        public async Task<MeetingConclusion?> GetByIdAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = new SqliteCommand($"{BASE_SELECT} WHERE c.Id = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            using var reader = await cmd.ExecuteReaderAsync();

            return await reader.ReadAsync() ? Map(reader) : null;
        }

        public async Task<int> CreateAsync(CreateConclusionRequest req)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            const string sql = @"
                INSERT INTO MeetingConclusions (MeetingId, FileName, Status, LastHandlerId, Progress, UpdatedAt)
                VALUES (@meetingId, @fileName, @status, @lastHandlerId, @progress, @now);
                SELECT last_insert_rowid();";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@meetingId", req.MeetingId);
            cmd.Parameters.AddWithValue("@fileName", (object?)req.FileName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@status", req.Status);
            cmd.Parameters.AddWithValue("@lastHandlerId", (object?)req.LastHandlerId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@progress", req.Progress);
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));

            return Convert.ToInt32(await cmd.ExecuteScalarAsync());
        }

        public async Task<bool> UpdateAsync(int id, UpdateConclusionRequest req)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            var sets = new List<string> { "UpdatedAt = @now" };
            if (req.Status != null) sets.Add("Status = @status");
            if (req.Progress.HasValue) sets.Add("Progress = @progress");
            if (req.LastHandlerId.HasValue) sets.Add("LastHandlerId = @lastHandlerId");

            var sql = $"UPDATE MeetingConclusions SET {string.Join(", ", sets)} WHERE Id = @id";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));
            cmd.Parameters.AddWithValue("@id", id);
            if (req.Status != null) cmd.Parameters.AddWithValue("@status", req.Status);
            if (req.Progress.HasValue) cmd.Parameters.AddWithValue("@progress", req.Progress.Value);
            if (req.LastHandlerId.HasValue) cmd.Parameters.AddWithValue("@lastHandlerId", req.LastHandlerId.Value);

            return await cmd.ExecuteNonQueryAsync() > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var cmd = new SqliteCommand("DELETE FROM MeetingConclusions WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            return await cmd.ExecuteNonQueryAsync() > 0;
        }
    }
}
