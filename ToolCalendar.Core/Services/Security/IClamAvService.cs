namespace ToolCalendar.Services.Security;

/// <summary>
/// Kết quả quét virus từ ClamAV
/// </summary>
public record ClamAvScanResult(bool IsClean, bool IsServiceUnavailable = false, string? VirusName = null)
{
    public static ClamAvScanResult Clean => new(true);
    public static ClamAvScanResult Infected(string virusName) => new(false, false, virusName);
    public static ClamAvScanResult ServiceUnavailable => new(false, true, "ClamAV unavailable");
}

/// <summary>
/// Interface cho dịch vụ quét virus ClamAV
/// </summary>
public interface IClamAvService
{
    Task<ClamAvScanResult> ScanFileAsync(string filePath, CancellationToken ct = default);
}
