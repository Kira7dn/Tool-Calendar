using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading.Tasks;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IAuditLogRepository
    {
        Task<(List<AuditLog> items, int total)> GetAuditLogsAsync(int page = 1, int pageSize = 20, string? roleFilter = null);
        Task InsertAuditLogAsync(int? userId, string action);
        Task InsertLoginAuditLogAsync(string username, int? userId, string? ipAddress, string? userAgent, bool isSuccess, string? failReason = null);
        Task<string?> GetLastLoginTimeAsync(int userId);
        Task ClearAuditLogsAsync();
        Task<int> DeleteOldAuditLogsAsync(int daysToKeep);
    }
}
