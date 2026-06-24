using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public interface IMeetingRepository
    {
        Task<List<Meeting>> GetAllAsync();
        Task<List<MeetingParticipant>> GetParticipantsByMeetingIdAsync(int meetingId);
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

        public async Task<List<Meeting>> GetAllAsync()
        {
            var list = new List<Meeting>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = @"
                SELECT m.*, r.Name as RoomName, u.FullName as CreatorName 
                FROM Meetings m 
                LEFT JOIN Rooms r ON m.RoomId = r.Id 
                LEFT JOIN Users u ON m.CreatorId = u.Id 
                ORDER BY m.StartTime ASC";

            using var cmd = new SqliteCommand(sql, connection);
            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                list.Add(new Meeting
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Title = reader["Title"]?.ToString() ?? "",
                    StartTime = DateTime.Parse(reader["StartTime"]?.ToString() ?? DateTime.UtcNow.ToString()),
                    EndTime = DateTime.Parse(reader["EndTime"]?.ToString() ?? DateTime.UtcNow.ToString()),
                    RoomId = Convert.ToInt32(reader["RoomId"]),
                    RoomName = reader["RoomName"]?.ToString(),
                    Status = reader["Status"]?.ToString() ?? "Sắp diễn ra",
                    CreatorId = Convert.ToInt32(reader["CreatorId"]),
                    CreatorName = reader["CreatorName"]?.ToString(),
                    CreatedAt = DateTime.Parse(reader["CreatedAt"]?.ToString() ?? DateTime.UtcNow.ToString())
                });
            }

            return list;
        }

        public async Task<List<MeetingParticipant>> GetParticipantsByMeetingIdAsync(int meetingId)
        {
            var list = new List<MeetingParticipant>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = @"
                SELECT mp.*, u.FullName as UserFullName, d.Name as DepartmentName 
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
    }
}
