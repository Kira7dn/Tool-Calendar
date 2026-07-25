using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public interface IMeetingProceedingRepository
    {
        Task<List<MeetingProceeding>> GetAllAsync();
        Task<MeetingProceeding?> GetByIdWithMeetingsAsync(int id);
        Task<int> CreateAsync(CreateProceedingRequest request, int creatorId);
        Task<bool> AddMeetingAsync(int proceedingId, int meetingId);
        Task<bool> RemoveMeetingAsync(int proceedingId, int meetingId);
        Task<bool> DeleteAsync(int id);
    }

    public class MeetingProceedingRepository : IMeetingProceedingRepository
    {
        private readonly string _connectionString;

        public MeetingProceedingRepository(IConfiguration configuration)
        {
            var dbPath = Environment.GetEnvironmentVariable("DB_PATH")
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ToolCalendar", "documents.db");
            _connectionString = $"Data Source={dbPath};Pooling=True;Default Timeout=30;Cache=Shared";
        }

        public async Task<List<MeetingProceeding>> GetAllAsync()
        {
            var list = new List<MeetingProceeding>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            const string sql = @"
                SELECT p.Id, p.Name, p.Description, p.CreatorId, p.CreatedAt, u.FullName as CreatorName
                FROM MeetingProceedings p
                LEFT JOIN Users u ON p.CreatorId = u.Id
                ORDER BY p.CreatedAt DESC";

            using var cmd = new SqliteCommand(sql, connection);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new MeetingProceeding
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Name = reader["Name"]?.ToString() ?? "",
                    Description = reader["Description"]?.ToString(),
                    CreatorId = reader["CreatorId"] == DBNull.Value ? 0 : Convert.ToInt32(reader["CreatorId"]),
                    CreatorName = reader["CreatorName"]?.ToString(),
                    CreatedAt = reader["CreatedAt"] == DBNull.Value
                        ? DateTime.UtcNow : DateTime.Parse(reader["CreatedAt"].ToString()!)
                });
            }
            return list;
        }

        public async Task<MeetingProceeding?> GetByIdWithMeetingsAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            const string sql = @"
                SELECT p.Id, p.Name, p.Description, p.CreatorId, p.CreatedAt, u.FullName as CreatorName
                FROM MeetingProceedings p
                LEFT JOIN Users u ON p.CreatorId = u.Id
                WHERE p.Id = @id";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@id", id);
            using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync()) return null;

            var proceeding = new MeetingProceeding
            {
                Id = Convert.ToInt32(reader["Id"]),
                Name = reader["Name"]?.ToString() ?? "",
                Description = reader["Description"]?.ToString(),
                CreatorId = reader["CreatorId"] == DBNull.Value ? 0 : Convert.ToInt32(reader["CreatorId"]),
                CreatorName = reader["CreatorName"]?.ToString(),
                CreatedAt = reader["CreatedAt"] == DBNull.Value
                    ? DateTime.UtcNow : DateTime.Parse(reader["CreatedAt"].ToString()!)
            };
            reader.Close();

            // Load meetings in this proceeding
            const string meetingSql = @"
                SELECT m.Id, m.Title, m.StartTime, m.EndTime, m.Status, m.Presider, r.Name as RoomName
                FROM MeetingProceedingItems pi
                JOIN Meetings m ON pi.MeetingId = m.Id
                LEFT JOIN Rooms r ON m.RoomId = r.Id
                WHERE pi.ProceedingId = @pid
                ORDER BY m.StartTime DESC";

            using var mCmd = new SqliteCommand(meetingSql, connection);
            mCmd.Parameters.AddWithValue("@pid", id);
            using var mReader = await mCmd.ExecuteReaderAsync();
            while (await mReader.ReadAsync())
            {
                proceeding.Meetings.Add(new Meeting
                {
                    Id = Convert.ToInt32(mReader["Id"]),
                    Title = mReader["Title"]?.ToString() ?? "",
                    StartTime = DateTime.Parse(mReader["StartTime"]?.ToString() ?? DateTime.UtcNow.ToString()),
                    EndTime = DateTime.Parse(mReader["EndTime"]?.ToString() ?? DateTime.UtcNow.ToString()),
                    Status = mReader["Status"]?.ToString() ?? "Sắp diễn ra",
                    Presider = mReader["Presider"]?.ToString(),
                    RoomName = mReader["RoomName"]?.ToString(),
                });
            }

            return proceeding;
        }

        public async Task<int> CreateAsync(CreateProceedingRequest req, int creatorId)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var tx = connection.BeginTransaction();
            try
            {
                const string sql = @"
                    INSERT INTO MeetingProceedings (Name, Description, CreatorId, CreatedAt)
                    VALUES (@name, @desc, @creator, @now);
                    SELECT last_insert_rowid();";

                using var cmd = new SqliteCommand(sql, connection, tx);
                cmd.Parameters.AddWithValue("@name", req.Name);
                cmd.Parameters.AddWithValue("@desc", (object?)req.Description ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@creator", creatorId);
                cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));

                var newId = Convert.ToInt32(cmd.ExecuteScalar());

                foreach (var meetingId in req.MeetingIds.Distinct())
                {
                    using var iCmd = new SqliteCommand(
                        "INSERT OR IGNORE INTO MeetingProceedingItems (ProceedingId, MeetingId) VALUES (@p, @m)",
                        connection, tx);
                    iCmd.Parameters.AddWithValue("@p", newId);
                    iCmd.Parameters.AddWithValue("@m", meetingId);
                    iCmd.ExecuteNonQuery();
                }

                tx.Commit();
                return newId;
            }
            catch
            {
                tx.Rollback();
                throw;
            }
        }

        public async Task<bool> AddMeetingAsync(int proceedingId, int meetingId)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var cmd = new SqliteCommand(
                "INSERT OR IGNORE INTO MeetingProceedingItems (ProceedingId, MeetingId) VALUES (@p, @m)",
                connection);
            cmd.Parameters.AddWithValue("@p", proceedingId);
            cmd.Parameters.AddWithValue("@m", meetingId);
            return await cmd.ExecuteNonQueryAsync() > 0;
        }

        public async Task<bool> RemoveMeetingAsync(int proceedingId, int meetingId)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var cmd = new SqliteCommand(
                "DELETE FROM MeetingProceedingItems WHERE ProceedingId = @p AND MeetingId = @m",
                connection);
            cmd.Parameters.AddWithValue("@p", proceedingId);
            cmd.Parameters.AddWithValue("@m", meetingId);
            return await cmd.ExecuteNonQueryAsync() > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var tx = connection.BeginTransaction();
            try
            {
                using var delItems = new SqliteCommand(
                    "DELETE FROM MeetingProceedingItems WHERE ProceedingId = @id", connection, tx);
                delItems.Parameters.AddWithValue("@id", id);
                delItems.ExecuteNonQuery();

                using var delP = new SqliteCommand(
                    "DELETE FROM MeetingProceedings WHERE Id = @id", connection, tx);
                delP.Parameters.AddWithValue("@id", id);
                var rows = delP.ExecuteNonQuery();

                tx.Commit();
                return rows > 0;
            }
            catch
            {
                tx.Rollback();
                throw;
            }
        }
    }
}
