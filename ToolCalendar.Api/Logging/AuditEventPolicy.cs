namespace ToolCalendar.Api.Logging;

/// <summary>Phân loại của một sự kiện truy cập.</summary>
public enum AuditCategory
{
    Access,          // Truy cập thông thường (đọc dữ liệu)
    DataChange,      // Thay đổi dữ liệu (POST/PUT/PATCH/DELETE)
    SensitiveAccess, // Tải file, xuất dữ liệu, xem nhật ký, sao lưu
    AccessDenied,    // 401 / 403
    RateLimited,     // 429 — dấu hiệu brute force / DoS
    Probe,           // 4xx bất thường trên path lạ — dấu hiệu dò quét (scanner)
    ServerError      // 5xx
}

public readonly record struct AuditDecision(
    bool WriteToFile,
    bool PersistToDb,
    bool IsSuccess,
    AuditCategory Category,
    LogLevel Level);

/// <summary>
/// Quy tắc quyết định sự kiện nào cần ghi vào nhật ký audit (file JSON bất biến + bảng AuditLogs).
/// Tách riêng thành hàm thuần để unit test được.
/// </summary>
public static class AuditEventPolicy
{
    // Đã có nhật ký riêng (LoginAuditLog / SecurityLogs) hoặc quá ồn → không lặp vào AuditLogs (vẫn ghi file)
    private static readonly string[] DbSkipPrefixes =
    {
        "/api/auth/login", "/api/auth/refresh", "/api/chat", "/notificationHub"
    };

    // Không ghi gì cả: health check, tài nguyên tĩnh, jwks công khai
    private static readonly string[] IgnoredPrefixes =
    {
        "/health", "/favicon.ico", "/.well-known/jwks.json", "/assets/"
    };

    private static readonly string[] SensitiveGetMarkers =
    {
        "/file", "/export", "/download", "/backup", "/audit-logs", "/evidence"
    };

    public static AuditDecision Evaluate(string method, string path, int statusCode)
    {
        path ??= string.Empty;
        method = (method ?? string.Empty).ToUpperInvariant();

        if (IgnoredPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)) && statusCode < 400)
            return Skip();

        bool isApi = path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase);
        bool isMutating = method is "POST" or "PUT" or "PATCH" or "DELETE";
        bool isSuccess = statusCode is >= 200 and < 400;

        AuditCategory category;
        LogLevel level;

        if (statusCode >= 500) { category = AuditCategory.ServerError; level = LogLevel.Error; }
        else if (statusCode == 429) { category = AuditCategory.RateLimited; level = LogLevel.Warning; }
        else if (statusCode is 401 or 403) { category = AuditCategory.AccessDenied; level = LogLevel.Warning; }
        else if (statusCode is 404 or 405 || (statusCode >= 400 && !isApi)) { category = AuditCategory.Probe; level = LogLevel.Warning; }
        else if (isMutating) { category = AuditCategory.DataChange; level = LogLevel.Information; }
        else if (method == "GET" && SensitiveGetMarkers.Any(m => path.Contains(m, StringComparison.OrdinalIgnoreCase)))
        { category = AuditCategory.SensitiveAccess; level = LogLevel.Information; }
        else { category = AuditCategory.Access; level = LogLevel.Information; }

        // Chỉ ghi file: mọi request /api + mọi lỗi 4xx/5xx (kể cả path lạ) — static/SPA 2xx bị bỏ qua
        bool writeToFile = isApi || statusCode >= 400;
        if (!writeToFile) return Skip();

        bool dbSkip = DbSkipPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase));
        bool persistToDb = isApi && !dbSkip && category != AuditCategory.Access && category != AuditCategory.Probe;

        // Lỗi xác thực/giới hạn tốc độ trên /api/auth/login vẫn cần vào DB để admin thấy tấn công
        if (isApi && dbSkip && category is AuditCategory.RateLimited)
            persistToDb = true;

        return new AuditDecision(true, persistToDb, isSuccess, category, level);
    }

    private static AuditDecision Skip() =>
        new(false, false, true, AuditCategory.Access, LogLevel.None);
}
