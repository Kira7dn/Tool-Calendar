using Microsoft.Extensions.Caching.Memory;
using ToolCalendar.Core.Services.Security;

namespace ToolCalendar.Api.Services.Security;

/// <summary>
/// Implement JTI Blacklist bằng IMemoryCache (in-process).
/// Phù hợp cho single-instance deployment hiện tại.
/// Khi cần horizontal scale → thay bằng IDistributedCache (Redis) mà không cần đổi interface.
/// </summary>
public sealed class TokenBlacklistService : ITokenBlacklistService
{
    private readonly IMemoryCache _cache;

    public TokenBlacklistService(IMemoryCache cache)
    {
        _cache = cache;
    }

    public void Blacklist(string jti, TimeSpan ttl)
    {
        if (string.IsNullOrEmpty(jti) || ttl <= TimeSpan.Zero)
            return;

        // Key có prefix để tránh xung đột với các cache key khác
        _cache.Set($"jti_revoked:{jti}", true, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = ttl,
            // Cache entry nhỏ — không cần set Priority cao
            Priority = CacheItemPriority.Low,
            Size = 1
        });
    }

    public bool IsBlacklisted(string jti)
    {
        if (string.IsNullOrEmpty(jti))
            return false;

        return _cache.TryGetValue($"jti_revoked:{jti}", out _);
    }
}
