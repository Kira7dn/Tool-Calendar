using System.Text;
using System.Text.RegularExpressions;

namespace ToolCalendar.Api.Logging;

/// <summary>
/// Làm sạch dữ liệu đầu vào từ client trước khi ghi vào nhật ký (CWE-117 Log Injection)
/// và che các tham số nhạy cảm (token, mật khẩu) khỏi query string.
/// </summary>
public static class AuditLogSanitizer
{
    public const int MaxFieldLength = 300;

    private static readonly Regex SensitiveQueryParam = new(
        @"(?<key>(?:^|[?&])(?:access_token|token|refresh_token|password|pass|pwd|secret|apikey|api_key|key|signature|sig)=)(?<value>[^&]*)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>
    /// Loại bỏ ký tự điều khiển (CR/LF/TAB...) — ngăn kẻ tấn công chèn dòng log giả — và cắt độ dài.
    /// </summary>
    public static string Clean(string? value, int maxLength = MaxFieldLength)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;

        var sb = new StringBuilder(Math.Min(value.Length, maxLength));
        foreach (var ch in value)
        {
            if (sb.Length >= maxLength) break;
            sb.Append(char.IsControl(ch) ? '_' : ch);
        }
        return sb.ToString();
    }

    /// <summary>
    /// Che giá trị của các tham số nhạy cảm trong query string: "?token=abc&amp;x=1" → "?token=***&amp;x=1".
    /// </summary>
    public static string RedactQuery(string? queryString)
    {
        if (string.IsNullOrEmpty(queryString)) return string.Empty;
        var redacted = SensitiveQueryParam.Replace(queryString, m => m.Groups["key"].Value + "***");
        return Clean(redacted, 500);
    }
}
