using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IAuditLogRepository
    {
        Task<(List<AuditLog> items, int total)> GetAuditLogsAsync(int page = 1, int pageSize = 20, string? roleFilter = null);
        Task InsertAuditLogAsync(int? userId, string action);
        /// <summary>Ghi sự kiện audit kèm IP, User-Agent và kết quả (thành công/thất bại).</summary>
        Task InsertAuditEventAsync(int? userId, string action, string? ipAddress, string? userAgent, bool isSuccess, string? failReason = null);
        Task InsertLoginAuditLogAsync(string username, int? userId, string? ipAddress, string? userAgent, bool isSuccess, string? failReason = null);
        Task<string?> GetLastLoginTimeAsync(int userId);
        Task ClearAuditLogsAsync();
        Task<int> DeleteOldAuditLogsAsync(int daysToKeep);
    }
}
