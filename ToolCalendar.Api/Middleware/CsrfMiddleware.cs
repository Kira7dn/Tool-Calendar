using System.Security.Cryptography;

namespace ToolCalendar.Api.Middleware;

/// <summary>
/// CSRF Protection bằng Double-Submit Cookie pattern (stateless).
///
/// Flow:
/// - GET request (authenticated): nếu chưa có cookie csrf_token → tự động sinh và set cookie.
/// - POST/PUT/DELETE request (authenticated): kiểm tra X-CSRF-Token header == csrf_token cookie.
///   Không khớp → 403 Forbidden.
///
/// Các path được miễn kiểm tra:
///   - /api/auth/login, /api/auth/refresh, /api/auth/logout  (pre/post-auth, không có session)
///   - /notificationHub                                        (SignalR WebSocket)
///   - OPTIONS preflight
///   - Mọi request không có JWT (anonymous)
/// </summary>
public class CsrfMiddleware
{
    private const string CookieName = "csrf_token";
    private const string HeaderName = "X-CSRF-Token";

    // Các path được miễn CSRF check
    private static readonly HashSet<string> _bypassPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/auth/logout",
        "/health",
        "/.well-known/jwks.json"
    };

    private static readonly HashSet<string> _bypassPrefixes = new(StringComparer.OrdinalIgnoreCase)
    {
        "/notificationHub"
    };

    private readonly RequestDelegate _next;

    public CsrfMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";
        var method = context.Request.Method;

        // Bỏ qua OPTIONS preflight
        if (method.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // Bỏ qua bypass paths / prefixes
        if (_bypassPaths.Contains(path) || _bypassPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
        {
            await _next(context);
            return;
        }

        // Chỉ áp dụng cho request đã authenticated
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        // GET: sinh csrf_token cookie nếu chưa có
        if (method.Equals("GET", StringComparison.OrdinalIgnoreCase) ||
            method.Equals("HEAD", StringComparison.OrdinalIgnoreCase))
        {
            EnsureCsrfCookie(context);
            await _next(context);
            return;
        }

        // POST/PUT/DELETE: kiểm tra header == cookie (constant-time compare)
        if (!ValidateCsrf(context))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(
                "{\"success\":false,\"message\":\"CSRF token không hợp lệ hoặc bị thiếu.\"}");
            return;
        }

        // Renew cookie mỗi request mutating để tránh token cũ bị replay
        EnsureCsrfCookie(context);
        await _next(context);
    }

    private static bool ValidateCsrf(HttpContext context)
    {
        if (!context.Request.Cookies.TryGetValue(CookieName, out var cookieValue) ||
            string.IsNullOrEmpty(cookieValue))
            return false;

        var headerValue = context.Request.Headers[HeaderName].FirstOrDefault();
        if (string.IsNullOrEmpty(headerValue))
            return false;

        // Constant-time compare để chống timing attack
        var cookieBytes = System.Text.Encoding.UTF8.GetBytes(cookieValue);
        var headerBytes = System.Text.Encoding.UTF8.GetBytes(headerValue);

        if (cookieBytes.Length != headerBytes.Length)
            return false;

        return CryptographicOperations.FixedTimeEquals(cookieBytes, headerBytes);
    }

    private static void EnsureCsrfCookie(HttpContext context)
    {
        if (context.Request.Cookies.ContainsKey(CookieName))
            return;

        // Sinh 32 bytes random → base64 URL-safe
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToBase64String(tokenBytes)
            .Replace("+", "-").Replace("/", "_").Replace("=", "");

        context.Response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = false,         // JS PHẢI đọc được để gửi vào header
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddHours(8) // Cùng TTL với session
        });
    }
}

public static class CsrfMiddlewareExtensions
{
    public static IApplicationBuilder UseCsrfProtection(this IApplicationBuilder app)
        => app.UseMiddleware<CsrfMiddleware>();
}
