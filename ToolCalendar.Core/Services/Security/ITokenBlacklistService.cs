namespace ToolCalendar.Core.Services.Security;

/// <summary>
/// Quản lý danh sách JWT đã bị thu hồi (JTI Blacklist).
/// Sau khi Logout, JTI của Access Token cũ được đưa vào blacklist
/// để ngăn chặn việc dùng lại token dù chưa hết TTL 15 phút.
/// </summary>
public interface ITokenBlacklistService
{
    /// <summary>Thêm JTI vào blacklist với TTL bằng thời gian còn lại của token.</summary>
    void Blacklist(string jti, TimeSpan ttl);

    /// <summary>Kiểm tra JTI có trong blacklist không.</summary>
    bool IsBlacklisted(string jti);
}
