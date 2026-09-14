using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Models; // assuming UserSession will be defined here, or I can define it in the same file if not yet existing.

namespace ToolCalendar.Core.Data.Repositories;

public class UserSession
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string RefreshTokenHash { get; set; } = "";
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? DeviceFingerprint { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public interface ISessionRepository
{
    Task CreateSessionAsync(UserSession session);
    Task<UserSession?> GetSessionByTokenHashAsync(string tokenHash);
    Task RevokeSessionAsync(string tokenHash);
    Task RevokeAllSessionsForUserAsync(int userId);
}

public class SessionRepository : ISessionRepository
{
    private readonly string _connectionString;

    public SessionRepository(IConfiguration configuration)
    {
        string? configConnString = configuration.GetConnectionString("DefaultConnection");
        if (!string.IsNullOrEmpty(configConnString))
        {
            _connectionString = configConnString;
        }
        else
        {
            _connectionString = $"Data Source={Environment.GetEnvironmentVariable("DB_PATH") ?? "/app/data/documents.db"};Pooling=False;Default Timeout=30";
        }
    }

    public async Task CreateSessionAsync(UserSession session)
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        string sql = @"
            INSERT INTO UserSessions (UserId, RefreshTokenHash, IpAddress, UserAgent, DeviceFingerprint, ExpiresAt, RevokedAt)
            VALUES (@userId, @hash, @ip, @ua, @fingerprint, @expires, NULL)";
        
        using var cmd = new SqliteCommand(sql, connection);
        cmd.Parameters.AddWithValue("@userId", session.UserId);
        cmd.Parameters.AddWithValue("@hash", session.RefreshTokenHash);
        cmd.Parameters.AddWithValue("@ip", session.IpAddress ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@ua", session.UserAgent ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@fingerprint", session.DeviceFingerprint ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("@expires", session.ExpiresAt.ToString("O"));
        
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<UserSession?> GetSessionByTokenHashAsync(string tokenHash)
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        string sql = "SELECT * FROM UserSessions WHERE RefreshTokenHash = @hash";
        
        using var cmd = new SqliteCommand(sql, connection);
        cmd.Parameters.AddWithValue("@hash", tokenHash);
        using var reader = await cmd.ExecuteReaderAsync();
        
        if (await reader.ReadAsync())
        {
            return new UserSession
            {
                Id = Convert.ToInt32(reader["Id"]),
                UserId = Convert.ToInt32(reader["UserId"]),
                RefreshTokenHash = reader["RefreshTokenHash"].ToString()!,
                IpAddress = reader["IpAddress"]?.ToString(),
                UserAgent = reader["UserAgent"]?.ToString(),
                DeviceFingerprint = reader["DeviceFingerprint"]?.ToString(),
                ExpiresAt = DateTime.Parse(reader["ExpiresAt"].ToString()!),
                RevokedAt = reader["RevokedAt"] != DBNull.Value ? DateTime.Parse(reader["RevokedAt"].ToString()!) : null,
                CreatedAt = DateTime.Parse(reader["CreatedAt"].ToString()!)
            };
        }
        return null;
    }

    public async Task RevokeSessionAsync(string tokenHash)
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        string sql = "UPDATE UserSessions SET RevokedAt = datetime('now', 'localtime') WHERE RefreshTokenHash = @hash";
        
        using var cmd = new SqliteCommand(sql, connection);
        cmd.Parameters.AddWithValue("@hash", tokenHash);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task RevokeAllSessionsForUserAsync(int userId)
    {
        using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        string sql = "UPDATE UserSessions SET RevokedAt = datetime('now', 'localtime') WHERE UserId = @userId AND RevokedAt IS NULL";
        
        using var cmd = new SqliteCommand(sql, connection);
        cmd.Parameters.AddWithValue("@userId", userId);
        await cmd.ExecuteNonQueryAsync();
    }
}
