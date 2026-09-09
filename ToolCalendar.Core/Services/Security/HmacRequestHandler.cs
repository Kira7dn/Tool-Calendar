using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ToolCalendar.Services.Security;

/// <summary>
/// DelegatingHandler — tự động ký mọi outgoing request đến python-ai-service.
///
/// Cơ chế (AWS SigV4-inspired, phù hợp internal Docker service):
///   X-API-Key:        Shared secret để python service verify caller identity
///   X-Timestamp:      Unix milliseconds — python service reject nếu lệch >30s (replay protection)
///   X-Signature:      HMAC-SHA256(secret, "METHOD:PATH:TIMESTAMP") — chống tampering
///   X-Correlation-ID: Propagate từ user HTTP request để trace cross-service
///
/// Nếu PythonAiService:ApiKey rỗng → chỉ gắn X-Correlation-ID, bỏ qua signing
/// (backward compat với môi trường dev/test không có key).
/// </summary>
public sealed class HmacRequestHandler : DelegatingHandler
{
    private readonly string _apiKey;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<HmacRequestHandler> _logger;

    public HmacRequestHandler(
        IConfiguration configuration,
        IHttpContextAccessor httpContextAccessor,
        ILogger<HmacRequestHandler> logger)
    {
        _apiKey = configuration["PythonAiService:ApiKey"] ?? string.Empty;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        // --- Correlation ID (luôn propagate, kể cả khi không có key) ---
        var correlationId = _httpContextAccessor.HttpContext?.Items["X-Correlation-ID"] as string
            ?? Guid.NewGuid().ToString("N")[..16];
        request.Headers.TryAddWithoutValidation("X-Correlation-ID", correlationId);

        // --- HMAC Signing (chỉ khi có key) ---
        if (!string.IsNullOrEmpty(_apiKey))
        {
            var timestampMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
            var method = request.Method.Method.ToUpperInvariant();

            // PathAndQuery = "/api/extract?foo=bar" hoặc "/api/embed/batch"
            var path = request.RequestUri?.PathAndQuery ?? "/";
            var signature = ComputeHmac(_apiKey, $"{method}:{path}:{timestampMs}");

            request.Headers.TryAddWithoutValidation("X-API-Key", _apiKey);
            request.Headers.TryAddWithoutValidation("X-Timestamp", timestampMs);
            request.Headers.TryAddWithoutValidation("X-Signature", signature);

            _logger.LogDebug(
                "[HMAC] Signed request {Method} {Path} | ts={Timestamp} | corr={CorrelationId}",
                method, path, timestampMs, correlationId);
        }

        return await base.SendAsync(request, cancellationToken);
    }

    /// <summary>Tính HMAC-SHA256(key, message), trả về hex lowercase.</summary>
    private static string ComputeHmac(string key, string message)
    {
        var keyBytes = Encoding.UTF8.GetBytes(key);
        var msgBytes = Encoding.UTF8.GetBytes(message);
        using var hmac = new HMACSHA256(keyBytes);
        return Convert.ToHexString(hmac.ComputeHash(msgBytes)).ToLowerInvariant();
    }
}
