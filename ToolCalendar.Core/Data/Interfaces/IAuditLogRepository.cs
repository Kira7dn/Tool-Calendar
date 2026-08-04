using System.Collections.Generic;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IAuditLogRepository
    {
        (List<AuditLog> items, int total) GetAuditLogs(int page = 1, int pageSize = 20, string? roleFilter = null);
        void InsertAuditLog(int? userId, string action);
        void InsertLoginAuditLog(string username, int? userId, string? ipAddress, string? userAgent, bool isSuccess, string? failReason = null);
        string? GetLastLoginTime(int userId);
        void ClearAuditLogs();
        int DeleteOldAuditLogs(int daysToKeep);
    }
}
