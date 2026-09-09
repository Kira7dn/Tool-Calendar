namespace ToolCalendar.Api.Middleware;

/// <summary>
/// Middleware đảm bảo mọi HTTP request đều có Correlation ID cho end-to-end tracing.
///
/// Behavior:
///   - Đọc X-Correlation-ID từ incoming request header (nếu client/gateway gửi kèm)
///   - Nếu không có → tự sinh UUID 16 chars
///   - Lưu vào HttpContext.Items["X-Correlation-ID"] để các service và handler khác dùng
///   - Gắn vào response header để client có thể trace
///
/// Phải đăng ký TRƯỚC tất cả middleware khác trong pipeline (Program.cs).
/// </summary>
public sealed class CorrelationIdMiddleware
{
    private const string HeaderName = "X-Correlation-ID";
    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        // Ưu tiên lấy từ incoming header (API Gateway, browser có thể gửi)
        var correlationId = context.Request.Headers[HeaderName].FirstOrDefault();

        // Nếu không có hoặc rỗng → sinh mới
        if (string.IsNullOrWhiteSpace(correlationId))
        {
            correlationId = Guid.NewGuid().ToString("N")[..16];
        }

        // Lưu vào Items để HmacRequestHandler và các service khác đọc được
        context.Items[HeaderName] = correlationId;

        // Gắn vào response để client trace
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        await _next(context);
    }
}
