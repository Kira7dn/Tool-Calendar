using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;

namespace ToolCalendar.Core.Data.Repositories;

public class SecurityLog
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string? IpAddress { get; set; }
    public string EventType { get; set; } = "";
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; }
}

public interface ISecurityLogRepository
{
    Task LogEventAsync(int? userId, string ipAddress, string eventType, string userAgent);
}

public class SecurityLogRepository : ISecurityLogRepository
{
    private readonly string _connectionString;

    public SecurityLogRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? "Data Source=/app/data/documents.db";
    }

    public async Task LogEventAsync(int? userId, string ipAddress, string eventType, string userAgent)
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        string sql = @"
            INSERT INTO SecurityLogs (UserId, IpAddress, EventType, UserAgent)
            VALUES (@userId, @ip, @eventType, @userAgent)";
        
        using var cmd = new SqliteCommand(sql, connection);
        cmd.Parameters.AddWithValue("@userId", userId.HasValue ? (object)userId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("@ip", ipAddress ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@eventType", eventType);
        cmd.Parameters.AddWithValue("@userAgent", userAgent ?? (object)DBNull.Value);
        
        await cmd.ExecuteNonQueryAsync();
    }
}
