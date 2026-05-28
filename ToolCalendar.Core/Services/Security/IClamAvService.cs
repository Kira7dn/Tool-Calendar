namespace ToolCalendar.Services.Security;

/// <summary>
/// Kết quả quét virus từ ClamAV
/// </summary>
public record ClamAvScanResult(bool IsClean, string? VirusName = null)
{
    public static ClamAvScanResult Clean => new(true);
    public static ClamAvScanResult Infected(string virusName) => new(false, virusName);
    public static ClamAvScanResult ServiceUnavailable => new(true, "ClamAV unavailable — skipped");
}

/// <summary>
/// Interface cho dịch vụ quét virus ClamAV
/// </summary>
public interface IClamAvService
{
    Task<ClamAvScanResult> ScanFileAsync(string filePath, CancellationToken ct = default);
}
