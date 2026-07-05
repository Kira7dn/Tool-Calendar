using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public interface IRoomRepository
    {
        Task<List<Room>> GetAllAsync();
        Task<Room?> GetByIdAsync(int id);
        Task<int> CreateAsync(Room room);
        Task<bool> UpdateAsync(int id, Room room);
        Task<bool> UpdateStatusAsync(int id, int status);
        Task<bool> DeleteAsync(int id);
    }

    public class RoomRepository : IRoomRepository
    {
        private readonly string _connectionString;

        public RoomRepository(IConfiguration configuration)
        {
            var dbPath = Environment.GetEnvironmentVariable("DB_PATH") 
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ToolCalendar", "documents.db");
            _connectionString = $"Data Source={dbPath};Pooling=True;Default Timeout=30;Cache=Shared";
        }

        public async Task<List<Room>> GetAllAsync()
        {
            var rooms = new List<Room>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = @"
                SELECT r.Id, r.Name, r.DepartmentId, r.Status, r.CreatedAt, 
                       d.Name as DepartmentName 
                FROM Rooms r 
                LEFT JOIN Departments d ON r.DepartmentId = d.Id 
                ORDER BY r.Id DESC";

            using var cmd = new SqliteCommand(sql, connection);
            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                rooms.Add(new Room
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Name = reader["Name"]?.ToString() ?? "",
                    DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),
                    DepartmentName = reader["DepartmentName"]?.ToString(),
                    Status = Convert.ToInt32(reader["Status"]),
                    CreatedAt = DateTime.Parse(reader["CreatedAt"]?.ToString() ?? DateTime.UtcNow.AddHours(7).ToString())
                });
            }

            return rooms;
        }

        public async Task<Room?> GetByIdAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = @"
                SELECT r.Id, r.Name, r.DepartmentId, r.Status, r.CreatedAt, 
                       d.Name as DepartmentName 
                FROM Rooms r 
                LEFT JOIN Departments d ON r.DepartmentId = d.Id 
                WHERE r.Id = @id";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@id", id);
            using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return new Room
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Name = reader["Name"]?.ToString() ?? "",
                    DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),
                    DepartmentName = reader["DepartmentName"]?.ToString(),
                    Status = Convert.ToInt32(reader["Status"]),
                    CreatedAt = DateTime.Parse(reader["CreatedAt"]?.ToString() ?? DateTime.UtcNow.AddHours(7).ToString())
                };
            }
            return null;
        }

        public async Task<int> CreateAsync(Room room)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = @"
                INSERT INTO Rooms (Name, DepartmentId, Status, CreatedAt) 
                VALUES (@name, @depId, @status, @now);
                SELECT last_insert_rowid();";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@name", room.Name);
            cmd.Parameters.AddWithValue("@depId", (object?)room.DepartmentId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@status", room.Status);
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));

            var result = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }

        public async Task<bool> UpdateAsync(int id, Room room)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = @"UPDATE Rooms 
                SET Name = @name, DepartmentId = @depId, Status = @status 
                WHERE Id = @id";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@name", room.Name);
            cmd.Parameters.AddWithValue("@depId", (object?)room.DepartmentId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@status", room.Status);
            cmd.Parameters.AddWithValue("@id", id);

            int rows = await cmd.ExecuteNonQueryAsync();
            return rows > 0;
        }

        public async Task<bool> UpdateStatusAsync(int id, int status)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = "UPDATE Rooms SET Status = @status WHERE Id = @id";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@status", status);
            cmd.Parameters.AddWithValue("@id", id);

            int rows = await cmd.ExecuteNonQueryAsync();
            return rows > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            // Kiểm tra phòng họp không có lịch đặt trong tương lai
            string checkSql = @"SELECT COUNT(*) FROM Meetings 
                WHERE RoomId = @id AND EndTime > datetime('now') AND Status != 'Hủy'";
            using var checkCmd = new SqliteCommand(checkSql, connection);
            checkCmd.Parameters.AddWithValue("@id", id);
            var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
            if (count > 0) return false; // Không xóa được vì đang có lịch họp

            string sql = "DELETE FROM Rooms WHERE Id = @id";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@id", id);

            int rows = await cmd.ExecuteNonQueryAsync();
            return rows > 0;
        }
    }
}
