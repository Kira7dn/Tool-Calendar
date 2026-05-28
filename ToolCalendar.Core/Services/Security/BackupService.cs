using Microsoft.Extensions.Logging;

namespace ToolCalendar.Services.Security;

/// <summary>
/// Dịch vụ backup tự động cơ sở dữ liệu SQLite mỗi 6 giờ.
/// Bảo vệ chống Ransomware: dù hacker mã hóa DB hiện tại, vẫn còn nhiều bản backup.
/// Giữ 28 bản backup (7 ngày × 4 lần/ngày).
/// </summary>
public class BackupService : BackgroundService
{
    private readonly ILogger<BackupService> _logger;
    private readonly IConfiguration _config;

    // Chạy backup mỗi 6 giờ
    private static readonly TimeSpan BackupInterval = TimeSpan.FromHours(6);

    // Số bản backup tối đa giữ lại (28 = 7 ngày × 4 lần/ngày)
    private const int MaxBackupsToKeep = 28;

    public BackupService(ILogger<BackupService> logger, IConfiguration config)
    {
        _logger = logger;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[BackupService] Dịch vụ backup tự động đã khởi động. Chu kỳ: mỗi {Hours}h", BackupInterval.TotalHours);

        // Chạy backup lần đầu ngay sau khi khởi động (30 giây)
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PerformBackupAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[BackupService] Lỗi trong quá trình backup");
            }

            await Task.Delay(BackupInterval, stoppingToken);
        }
    }

    private Task PerformBackupAsync()
    {
        var dbPath = _config["DB_PATH"]
                     ?? Environment.GetEnvironmentVariable("DB_PATH")
                     ?? "/app/data/documents.db";

        if (!File.Exists(dbPath))
        {
            _logger.LogWarning("[BackupService] Không tìm thấy DB tại {Path} — bỏ qua backup", dbPath);
            return Task.CompletedTask;
        }

        // Thư mục backup nằm cùng cấp với DB
        var dbDir = Path.GetDirectoryName(dbPath) ?? "/app/data";
        var backupDir = Path.Combine(dbDir, "backups");
        Directory.CreateDirectory(backupDir);

        // Tên file: documents_20260528_1430.db
        var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmm");
        var backupPath = Path.Combine(backupDir, $"documents_{timestamp}.db");

        // SQLite backup: copy file khi không có write transaction (đủ an toàn cho production nhỏ)
        // Với production lớn hơn, cần dùng SQLite BACKUP API
        File.Copy(dbPath, backupPath, overwrite: true);

        var sizeKb = new FileInfo(backupPath).Length / 1024;
        _logger.LogInformation("[BackupService] ✅ Backup thành công: {File} ({Size}KB)", 
            Path.GetFileName(backupPath), sizeKb);

        // Dọn dẹp backup cũ: giữ lại MaxBackupsToKeep bản mới nhất
        var allBackups = Directory.GetFiles(backupDir, "documents_*.db")
            .OrderByDescending(f => f) // Sắp xếp mới nhất trước
            .ToList();

        var toDelete = allBackups.Skip(MaxBackupsToKeep).ToList();
        foreach (var old in toDelete)
        {
            File.Delete(old);
            _logger.LogDebug("[BackupService] Đã xóa backup cũ: {File}", Path.GetFileName(old));
        }

        if (toDelete.Count > 0)
            _logger.LogInformation("[BackupService] Đã dọn {Count} backup cũ. Còn lại: {Remaining} bản", 
                toDelete.Count, allBackups.Count - toDelete.Count);

        return Task.CompletedTask;
    }
}
