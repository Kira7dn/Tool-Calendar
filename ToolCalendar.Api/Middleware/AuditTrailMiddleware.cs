using System.Diagnostics;
using System.Security.Claims;
using ToolCalendar.Api.Logging;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Api.Middleware;

/// <summary>
/// Nhật ký truy cập tập trung (Audit Trail) — trả lời câu hỏi "AI làm GÌ, TỪ ĐÂU, LÚC NÀO, KẾT QUẢ RA SAO".
///
/// Mỗi request đáng ghi nhận sẽ được ghi vào:
///   1. File audit-YYYYMMDD.jsonl (Serilog, JSON, rolling theo ngày) — nằm NGOÀI database nên admin
///      xoá bảng AuditLogs cũng không xoá được dấu vết; dùng để ingest vào SIEM/ELK.
///   2. Bảng AuditLogs (chỉ thay đổi dữ liệu, truy cập nhạy cảm, bị từ chối, lỗi) — hiển thị trên màn hình admin.
///
/// Không ghi body request/response, không ghi mật khẩu/token (query string được che).
/// Phải đặt SAU ForwardedHeaders (để có IP thật) và TRƯỚC UseAuthentication (để bắt cả 401/403/429).
/// </summary>
public sealed class AuditTrailMiddleware
{
    private const string CorrelationHeader = "X-Correlation-ID";

    private readonly RequestDelegate _next;
    private readonly ILogger _auditLogger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AuditTrailMiddleware> _logger;

    public AuditTrailMiddleware(
        RequestDelegate next,
        ILoggerFactory loggerFactory,
        IServiceScopeFactory scopeFactory)
    {
        _next = next;
        _auditLogger = loggerFactory.CreateLogger(AuditLogChannel.Name);
        _logger = loggerFactory.CreateLogger<AuditTrailMiddleware>();
        _scopeFactory = scopeFactory;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        Exception? failure = null;

        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            failure = ex;
            throw; // GlobalExceptionMiddleware sẽ tạo response 500 chuẩn
        }
        finally
        {
            stopwatch.Stop();
            try
            {
                Record(context, failure != null ? StatusCodes.Status500InternalServerError : context.Response.StatusCode,
                    stopwatch.ElapsedMilliseconds);
            }
            catch (Exception ex)
            {
                // Lỗi ghi nhật ký tuyệt đối không được làm hỏng request
                _logger.LogError(ex, "Không thể ghi audit trail");
            }
        }
    }

    private void Record(HttpContext context, int statusCode, long elapsedMs)
    {
        var request = context.Request;
        var path = AuditLogSanitizer.Clean(request.Path.Value, 300);
        var decision = AuditEventPolicy.Evaluate(request.Method, path, statusCode);
        if (!decision.WriteToFile) return;

        var userIdText = context.User.FindFirst("uid")?.Value
                      ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int? userId = int.TryParse(userIdText, out var parsedId) ? parsedId : null;
        var username = AuditLogSanitizer.Clean(context.User.Identity?.Name, 100);
        var role = AuditLogSanitizer.Clean(context.User.FindFirst(ClaimTypes.Role)?.Value, 50);
        var ip = GetClientIp(context);
        var userAgent = AuditLogSanitizer.Clean(request.Headers.UserAgent.ToString(), 300);
        var query = AuditLogSanitizer.RedactQuery(request.QueryString.Value);
        var correlationId = AuditLogSanitizer.Clean(context.Items[CorrelationHeader] as string, 64);

        _auditLogger.Log(decision.Level,
            "AUDIT {Category} {Method} {Path}{Query} => {StatusCode} in {ElapsedMs}ms " +
            "user={Username} uid={UserId} role={Role} ip={ClientIp} cid={CorrelationId} ua={UserAgent}",
            decision.Category, request.Method, path, query, statusCode, elapsedMs,
            username, userId, role, ip, correlationId, userAgent);

        if (!decision.PersistToDb) return;

        var action = $"[{CategoryLabel(decision.Category)}] {request.Method} {path} → HTTP {statusCode}";
        var failReason = decision.IsSuccess ? null : $"{decision.Category} (HTTP {statusCode})";

        // Fire-and-forget: không chặn response. Dùng scope riêng vì scope của request sắp bị huỷ.
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<IAuditLogRepository>();
                await repo.InsertAuditEventAsync(userId, action, ip, userAgent, decision.IsSuccess, failReason);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Không thể ghi audit event vào DB");
            }
        });
    }

    internal static string GetClientIp(HttpContext context)
    {
        var address = context.Connection.RemoteIpAddress;
        if (address == null) return "unknown";
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        return address.ToString();
    }

    internal static string CategoryLabel(AuditCategory category) => category switch
    {
        AuditCategory.DataChange => "API",
        AuditCategory.SensitiveAccess => "TRUY CẬP NHẠY CẢM",
        AuditCategory.AccessDenied => "TỪ CHỐI TRUY CẬP",
        AuditCategory.RateLimited => "GIỚI HẠN TỐC ĐỘ",
        AuditCategory.ServerError => "LỖI HỆ THỐNG",
        _ => "TRUY CẬP"
    };
}
