using System.Net.Sockets;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ToolCalendar.Services.Security;

/// <summary>
/// Kết nối tới ClamAV daemon qua TCP socket và quét file virus.
/// ClamAV chạy trong container riêng biệt (doc-clamav).
/// Protocol: INSTREAM — gửi file theo chunks 4096 bytes, nhận verdict.
/// </summary>
public class ClamAvService : IClamAvService
{
    private readonly string _host;
    private readonly int _port;
    private readonly ILogger<ClamAvService> _logger;

    public ClamAvService(IConfiguration config, ILogger<ClamAvService> logger)
    {
        _host = config["ClamAv:Host"] ?? "clamav";
        _port = int.TryParse(config["ClamAv:Port"], out var p) ? p : 3310;
        _logger = logger;
    }

    public async Task<ClamAvScanResult> ScanFileAsync(string filePath, CancellationToken ct = default)
    {
        if (!File.Exists(filePath))
        {
            _logger.LogWarning("[ClamAV] File không tồn tại để quét: {Path}", filePath);
            return ClamAvScanResult.Clean; // Không xử lý được → cho qua (fail-open)
        }

        try
        {
            using var tcp = new TcpClient();
            // Timeout kết nối 3 giây — nếu ClamAV không chạy thì không block upload
            var connectTask = tcp.ConnectAsync(_host, _port, ct).AsTask();
            if (await Task.WhenAny(connectTask, Task.Delay(3000, ct)) != connectTask || connectTask.IsFaulted)
            {
                _logger.LogWarning("[ClamAV] Không thể kết nối tới {Host}:{Port} — bỏ qua quét virus", _host, _port);
                return ClamAvScanResult.ServiceUnavailable;
            }

            await using var stream = tcp.GetStream();

            // Protocol: gửi lệnh "zINSTREAM\0"
            var command = Encoding.ASCII.GetBytes("zINSTREAM\0");
            await stream.WriteAsync(command, ct);

            // Gửi file theo chunks 4096 bytes
            await using (var fileStream = File.OpenRead(filePath))
            {
                var buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = await fileStream.ReadAsync(buffer, ct)) > 0)
                {
                    // Mỗi chunk: 4 bytes big-endian length + data
                    var lengthBytes = BitConverter.GetBytes(System.Net.IPAddress.HostToNetworkOrder(bytesRead));
                    await stream.WriteAsync(lengthBytes, ct);
                    await stream.WriteAsync(buffer.AsMemory(0, bytesRead), ct);
                }
            }

            // Kết thúc stream: gửi chunk rỗng (length = 0)
            await stream.WriteAsync(new byte[] { 0, 0, 0, 0 }, ct);
            await stream.FlushAsync(ct);

            // Đọc verdict từ ClamAV
            var responseBuffer = new byte[1024];
            var bytesReceived = await stream.ReadAsync(responseBuffer, ct);
            var response = Encoding.ASCII.GetString(responseBuffer, 0, bytesReceived).Trim('\0', '\n').Trim();

            _logger.LogDebug("[ClamAV] Kết quả quét {File}: {Response}", Path.GetFileName(filePath), response);

            // Response format:
            //   SẠCH:   "stream: OK"
            //   NHIỄM:  "stream: Eicar-Test-Signature FOUND"
            //   LỖI:    "stream: ... ERROR"
            if (response.EndsWith("OK"))
                return ClamAvScanResult.Clean;

            if (response.Contains("FOUND"))
            {
                // Trích xuất tên virus: "stream: Win.Trojan.XYZ FOUND" → "Win.Trojan.XYZ"
                var parts = response.Split(':');
                var virusPart = parts.Length > 1 ? parts[1].Trim().Replace(" FOUND", "").Trim() : "Unknown";
                _logger.LogWarning("[ClamAV] ⚠️ PHÁT HIỆN VIRUS: {Virus} trong file {File}", virusPart, filePath);
                return ClamAvScanResult.Infected(virusPart);
            }

            _logger.LogWarning("[ClamAV] Phản hồi không xác định: {Response}", response);
            return ClamAvScanResult.ServiceUnavailable;
        }
        catch (Exception ex)
        {
            // Fail-open: nếu ClamAV lỗi → không block hệ thống, chỉ log
            _logger.LogError(ex, "[ClamAV] Lỗi khi quét virus file {Path}", filePath);
            return ClamAvScanResult.ServiceUnavailable;
        }
    }
}
