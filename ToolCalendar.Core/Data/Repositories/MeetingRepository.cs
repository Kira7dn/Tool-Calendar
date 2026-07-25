using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public interface IMeetingRepository
    {
        Task<List<Meeting>> GetAllAsync();
        Task<Meeting?> GetByIdAsync(int id);
        Task<List<Meeting>> GetByCreatorAsync(int creatorId);
        Task<List<Meeting>> GetByParticipantAsync(int userId);
        Task<List<MeetingParticipant>> GetParticipantsByMeetingIdAsync(int meetingId);
        Task<int> CreateAsync(CreateMeetingRequest request, int creatorId);
        Task<bool> UpdateAsync(int id, CreateMeetingRequest request);
        Task<bool> UpdateAttendanceAsync(int meetingId, int userId, string status);
        Task<bool> CancelAsync(int id);
        Task<bool> DeleteAsync(int id);
    }

    public class MeetingRepository : IMeetingRepository
    {
        private readonly string _connectionString;

        public MeetingRepository(IConfiguration configuration)
        {
            var dbPath = Environment.GetEnvironmentVariable("DB_PATH")
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ToolCalendar", "documents.db");
            _connectionString = $"Data Source={dbPath};Pooling=True;Default Timeout=30;Cache=Shared";
        }

        private static Meeting MapMeeting(SqliteDataReader r) => new()
        {
            Id = Convert.ToInt32(r["Id"]),
            Title = r["Title"]?.ToString() ?? "",
            StartTime = DateTime.Parse(r["StartTime"]?.ToString() ?? DateTime.UtcNow.ToString()),
            EndTime = DateTime.Parse(r["EndTime"]?.ToString() ?? DateTime.UtcNow.ToString()),
            RoomId = r["RoomId"] == DBNull.Value ? 0 : Convert.ToInt32(r["RoomId"]),
            RoomName = r["RoomName"]?.ToString(),
            Status = r["Status"]?.ToString() ?? "Sắp diễn ra",
            CreatorId = r["CreatorId"] == DBNull.Value ? 0 : Convert.ToInt32(r["CreatorId"]),
            CreatorName = r["CreatorName"]?.ToString(),
            CreatedAt = DateTime.Parse(r["CreatedAt"]?.ToString() ?? DateTime.UtcNow.ToString()),
            Location = r["Location"]?.ToString(),
            Presider = r["Presider"]?.ToString(),
            PreparingUnit = r["PreparingUnit"]?.ToString(),
            Content = r["Content"]?.ToString(),
            Notes = r["Notes"]?.ToString(),
            OrganizingUnit = r["OrganizingUnit"]?.ToString(),
            ExpectedAttendees = r["ExpectedAttendees"] == DBNull.Value ? 0 : Convert.ToInt32(r["ExpectedAttendees"]),
            ExternalParticipants = r["ExternalParticipants"]?.ToString(),
        };

        private const string BASE_SELECT = @"
            SELECT m.Id, m.Title, m.StartTime, m.EndTime, m.RoomId, m.Status, m.CreatorId, m.CreatedAt, m.Location, m.Presider, m.PreparingUnit, m.Content, m.Notes, m.OrganizingUnit, m.ExpectedAttendees, m.ExternalParticipants, r.Name as RoomName, u.FullName as CreatorName 
            FROM Meetings m 
            LEFT JOIN Rooms r ON m.RoomId = r.Id 
            LEFT JOIN Users u ON m.CreatorId = u.Id";

        public async Task<List<Meeting>> GetAllAsync()
        {
            var list = new List<Meeting>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = new SqliteCommand($"{BASE_SELECT} ORDER BY m.StartTime ASC", connection);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                list.Add(MapMeeting(reader));

            return list;
        }

        public async Task<Meeting?> GetByIdAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = new SqliteCommand($"{BASE_SELECT} WHERE m.Id = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var meeting = MapMeeting(reader);
                reader.Close();
                meeting.Participants = await GetParticipantsByMeetingIdAsync(id, connection);
                return meeting;
            }
            return null;
        }

        public async Task<List<Meeting>> GetByCreatorAsync(int creatorId)
        {
            var list = new List<Meeting>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = new SqliteCommand($"{BASE_SELECT} WHERE m.CreatorId = @cid ORDER BY m.StartTime DESC", connection);
            cmd.Parameters.AddWithValue("@cid", creatorId);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                list.Add(MapMeeting(reader));

            return list;
        }

        public async Task<List<Meeting>> GetByParticipantAsync(int userId)
        {
            var list = new List<Meeting>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            // Lấy phiên họp mà user được mời tham dự + lấy kèm trạng thái tham dự của user đó
            var sql = $@"
                SELECT m.Id, m.Title, m.StartTime, m.EndTime, m.RoomId, m.Status, m.CreatorId, m.CreatedAt,
                       m.Location, m.Presider, m.PreparingUnit, m.Content, m.Notes, m.OrganizingUnit,
                       COALESCE(m.ExpectedAttendees, 0) as ExpectedAttendees,
                       m.ExternalParticipants,
                       r.Name as RoomName, u.FullName as CreatorName,
                       mp.AttendanceStatus as MyAttendanceStatus
                FROM MeetingParticipants mp
                JOIN Meetings m ON mp.MeetingId = m.Id
                LEFT JOIN Rooms r ON m.RoomId = r.Id
                LEFT JOIN Users u ON m.CreatorId = u.Id
                WHERE mp.UserId = @userId
                ORDER BY m.StartTime DESC";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@userId", userId);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var meeting = MapMeeting(reader);
                // Gắn thêm trạng thái tham dự riêng của user hiện tại vào Participants
                meeting.Participants = new List<MeetingParticipant>
                {
                    new()
                    {
                        MeetingId = meeting.Id,
                        UserId = userId,
                        AttendanceStatus = reader["MyAttendanceStatus"]?.ToString() ?? "Chưa xác nhận"
                    }
                };
                list.Add(meeting);
            }
            return list;
        }

        public async Task<bool> UpdateAttendanceAsync(int meetingId, int userId, string status)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var cmd = new SqliteCommand(
                "UPDATE MeetingParticipants SET AttendanceStatus = @status WHERE MeetingId = @m AND UserId = @u",
                connection);
            cmd.Parameters.AddWithValue("@status", status);
            cmd.Parameters.AddWithValue("@m", meetingId);
            cmd.Parameters.AddWithValue("@u", userId);
            return await cmd.ExecuteNonQueryAsync() > 0;
        }

        public async Task<List<MeetingParticipant>> GetParticipantsByMeetingIdAsync(int meetingId)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            return await GetParticipantsByMeetingIdAsync(meetingId, connection);
        }

        private static async Task<List<MeetingParticipant>> GetParticipantsByMeetingIdAsync(int meetingId, SqliteConnection connection)
        {
            var list = new List<MeetingParticipant>();
            string sql = @"
                SELECT mp.MeetingId, mp.UserId, mp.AttendanceStatus, u.FullName as UserFullName, d.Name as DepartmentName 
                FROM MeetingParticipants mp 
                JOIN Users u ON mp.UserId = u.Id 
                LEFT JOIN Departments d ON u.DepartmentId = d.Id 
                WHERE mp.MeetingId = @mId";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@mId", meetingId);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new MeetingParticipant
                {
                    MeetingId = Convert.ToInt32(reader["MeetingId"]),
                    UserId = Convert.ToInt32(reader["UserId"]),
                    UserFullName = reader["UserFullName"]?.ToString(),
                    DepartmentName = reader["DepartmentName"]?.ToString(),
                    AttendanceStatus = reader["AttendanceStatus"]?.ToString() ?? "Chưa xác nhận"
                });
            }
            return list;
        }

        public async Task<int> CreateAsync(CreateMeetingRequest req, int creatorId)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var tx = connection.BeginTransaction();
            try
            {
                string sql = @"
                    INSERT INTO Meetings 
                        (Title, StartTime, EndTime, RoomId, Status, CreatorId, CreatedAt,
                         Location, Presider, PreparingUnit, Content, Notes, OrganizingUnit, ExpectedAttendees, ExternalParticipants)
                    VALUES 
                        (@title, @start, @end, @roomId, 'Sắp diễn ra', @creator, @now,
                         @location, @presider, @preparingUnit, @content, @notes, @orgUnit, @expected, @external);
                    SELECT last_insert_rowid();";

                using var cmd = new SqliteCommand(sql, connection, tx);
                cmd.Parameters.AddWithValue("@title", req.Title);
                cmd.Parameters.AddWithValue("@start", req.StartTime.ToString("yyyy-MM-dd HH:mm:ss"));
                cmd.Parameters.AddWithValue("@end", req.EndTime.ToString("yyyy-MM-dd HH:mm:ss"));
                cmd.Parameters.AddWithValue("@roomId", req.RoomId);
                cmd.Parameters.AddWithValue("@creator", creatorId);
                cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));
                cmd.Parameters.AddWithValue("@location", (object?)req.Location ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@presider", (object?)req.Presider ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@preparingUnit", (object?)req.PreparingUnit ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@content", (object?)req.Content ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@notes", (object?)req.Notes ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@orgUnit", (object?)req.OrganizingUnit ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@expected", req.ExpectedAttendees);
                cmd.Parameters.AddWithValue("@external", (object?)req.ExternalParticipants ?? DBNull.Value);

                var newId = Convert.ToInt32(cmd.ExecuteScalar());

                // Thêm danh sách tham dự
                foreach (var userId in req.ParticipantUserIds.Distinct())
                {
                    using var pCmd = new SqliteCommand(
                        "INSERT OR IGNORE INTO MeetingParticipants (MeetingId, UserId, AttendanceStatus) VALUES (@m, @u, 'Chưa xác nhận')",
                        connection, tx);
                    pCmd.Parameters.AddWithValue("@m", newId);
                    pCmd.Parameters.AddWithValue("@u", userId);
                    pCmd.ExecuteNonQuery();
                }

                tx.Commit();
                return newId;
            }
            catch
            {
                tx.Rollback(); // Hoàn tác toàn bộ nếu có lỗi giữa chừng
                throw;
            }
        }

        public async Task<bool> UpdateAsync(int id, CreateMeetingRequest req)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var tx = connection.BeginTransaction();
            try
            {
                string sql = @"
                    UPDATE Meetings SET
                        Title = @title, StartTime = @start, EndTime = @end, RoomId = @roomId,
                        Location = @location, Presider = @presider, PreparingUnit = @preparingUnit,
                        Content = @content, Notes = @notes, OrganizingUnit = @orgUnit,
                        ExpectedAttendees = @expected, ExternalParticipants = @external
                    WHERE Id = @id";

                using var cmd = new SqliteCommand(sql, connection, tx);
                cmd.Parameters.AddWithValue("@title", req.Title);
                cmd.Parameters.AddWithValue("@start", req.StartTime.ToString("yyyy-MM-dd HH:mm:ss"));
                cmd.Parameters.AddWithValue("@end", req.EndTime.ToString("yyyy-MM-dd HH:mm:ss"));
                cmd.Parameters.AddWithValue("@roomId", req.RoomId);
                cmd.Parameters.AddWithValue("@location", (object?)req.Location ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@presider", (object?)req.Presider ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@preparingUnit", (object?)req.PreparingUnit ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@content", (object?)req.Content ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@notes", (object?)req.Notes ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@orgUnit", (object?)req.OrganizingUnit ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@expected", req.ExpectedAttendees);
                cmd.Parameters.AddWithValue("@external", (object?)req.ExternalParticipants ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@id", id);

                int rows = cmd.ExecuteNonQuery();

                // Cập nhật lại danh sách tham dự nếu có thay đổi
                if (req.ParticipantUserIds.Count > 0)
                {
                    using var delCmd = new SqliteCommand("DELETE FROM MeetingParticipants WHERE MeetingId = @m", connection, tx);
                    delCmd.Parameters.AddWithValue("@m", id);
                    delCmd.ExecuteNonQuery();

                    foreach (var userId in req.ParticipantUserIds.Distinct())
                    {
                        using var pCmd = new SqliteCommand(
                            "INSERT INTO MeetingParticipants (MeetingId, UserId, AttendanceStatus) VALUES (@m, @u, 'Chưa xác nhận')",
                            connection, tx);
                        pCmd.Parameters.AddWithValue("@m", id);
                        pCmd.Parameters.AddWithValue("@u", userId);
                        pCmd.ExecuteNonQuery();
                    }
                }

                tx.Commit();
                return rows > 0;
            }
            catch
            {
                tx.Rollback(); // Hoàn tác toàn bộ nếu có lỗi giữa chừng
                throw;
            }
        }

        public async Task<bool> CancelAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var cmd = new SqliteCommand("UPDATE Meetings SET Status = 'Hủy' WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            return await cmd.ExecuteNonQueryAsync() > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var tx = connection.BeginTransaction();
            try
            {
                using var delP = new SqliteCommand("DELETE FROM MeetingParticipants WHERE MeetingId = @id", connection, tx);
                delP.Parameters.AddWithValue("@id", id);
                delP.ExecuteNonQuery();

                using var delM = new SqliteCommand("DELETE FROM Meetings WHERE Id = @id", connection, tx);
                delM.Parameters.AddWithValue("@id", id);
                int rows = delM.ExecuteNonQuery();

                tx.Commit();
                return rows > 0;
            }
            catch
            {
                tx.Rollback(); // Hoàn tác toàn bộ nếu có lỗi giữa chừng
                throw;
            }
        }
    }
}
