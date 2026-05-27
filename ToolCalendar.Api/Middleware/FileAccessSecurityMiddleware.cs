using System.Net;

namespace ToolCalendar.Middleware
{
    /// <summary>
    /// ✅ SECURITY MIDDLEWARE: Bảo vệ thư mục Uploads khỏi truy cập trực tiếp.
    /// Mọi request đến /Uploads/* hoặc chứa path traversal đều bị chặn ngay tại đây,
    /// TRƯỚC khi đến controller — không cần phụ thuộc vào [Authorize] attribute.
    /// </summary>
    public class FileAccessSecurityMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<FileAccessSecurityMiddleware> _logger;

        // Danh sách các path bị cấm truy cập trực tiếp
        private static readonly string[] ProtectedPaths = new[]
        {
            "/uploads/",
            "/upload/",
            "/evidence/",
            "/comments/"
        };

        // Ký tự nguy hiểm trong path (Path Traversal Attack)
        private static readonly string[] DangerousPathPatterns = new[]
        {
            "..", "//", "\\\\", "%2e%2e", "%2f", "%5c",
            "..%2f", "%2e%2e%2f", "..%5c"
        };

        public FileAccessSecurityMiddleware(RequestDelegate next, ILogger<FileAccessSecurityMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";
            var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

            // ─── 1. Chặn Path Traversal Attack ──────────────────────────────────
            foreach (var pattern in DangerousPathPatterns)
            {
                if (path.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning(
                        "[SECURITY-BLOCK] Path Traversal detected! IP={IP} Path={Path}",
                        ip, context.Request.Path.Value);

                    context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsync(
                        "{\"error\":\"400\",\"message\":\"Yêu cầu không hợp lệ.\"}");
                    return;
                }
            }

            // ─── 2. Chặn mọi truy cập trực tiếp vào thư mục bảo vệ ─────────────
            bool isProtectedPath = ProtectedPaths.Any(p =>
                path.StartsWith(p, StringComparison.OrdinalIgnoreCase));

            if (isProtectedPath)
            {
                _logger.LogWarning(
                    "[SECURITY-BLOCK] Direct folder access blocked! IP={IP} Path={Path} User={User}",
                    ip,
                    context.Request.Path.Value,
                    context.User?.Identity?.Name ?? "anonymous");

                context.Response.StatusCode = (int)HttpStatusCode.Forbidden;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(
                    "{\"error\":\"403\",\"message\":\"Truy cập bị từ chối. Vui lòng đăng nhập để xem tài liệu.\"}");
                return;
            }

            // ─── 3. Thêm Security Headers cho mọi response ──────────────────────
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;

                // Chặn browser cache các API response nhạy cảm
                if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
                {
                    if (!headers.ContainsKey("Cache-Control"))
                        headers["Cache-Control"] = "no-store, private";
                }

                // Chống Clickjacking (Cho phép iframe cùng domain để xem PDF)
                headers["X-Frame-Options"] = "SAMEORIGIN";
                // Chống MIME sniffing
                headers["X-Content-Type-Options"] = "nosniff";
                // Chống XSS
                headers["X-XSS-Protection"] = "1; mode=block";
                // Referrer Policy
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
                // Content Security Policy
                headers["Content-Security-Policy"] =
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' wss: ws:; frame-src 'self' blob:; object-src 'self' blob:;";

                return Task.CompletedTask;
            });

            await _next(context);
        }
    }

    // Extension method để đăng ký middleware dễ dàng
    public static class FileAccessSecurityMiddlewareExtensions
    {
        public static IApplicationBuilder UseFileAccessSecurity(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<FileAccessSecurityMiddleware>();
        }
    }
}
