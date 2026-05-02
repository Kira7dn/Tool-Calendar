using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ToolCalendar.Data;

namespace ToolCalendar.Services
{
    public class DeadlineWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DeadlineWorker> _logger;
        private DateTime? _lastScanDate;

        public DeadlineWorker(IServiceProvider serviceProvider, ILogger<DeadlineWorker> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[DeadlineWorker] Dịch vụ quét thời hạn đã khởi động.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Kiểm tra mỗi phút thay vì ngủ dài để phản ứng nhanh với thay đổi cài đặt
                    string scanTimeStr = DatabaseService.GetAppSetting("Notification_ScanTime", "08:30");
                    if (!TimeSpan.TryParse(scanTimeStr, out TimeSpan targetTime))
                    {
                        targetTime = new TimeSpan(8, 30, 0);
                    }

                    DateTime now = DateTime.UtcNow.AddHours(7);

                    // Log mỗi phút để người dùng thấy giờ server
                    _logger.LogInformation("[DeadlineWorker] Kiểm tra lúc {time} (Giờ cài đặt: {target})", now.ToString("HH:mm"), scanTimeStr);

                    // Kiểm tra xem đã đến giờ quét chưa (trong phạm vi phút hiện tại)
                    if (now.Hour == targetTime.Hours && now.Minute == targetTime.Minutes)
                    {
                        string todayStr = now.ToString("yyyy-MM-dd");
                        string lastScanDate = DatabaseService.GetAppSetting("Notification_LastScanDate", "");

                        if (lastScanDate != todayStr)
                        {
                            _logger.LogInformation($"[DeadlineWorker] Đến giờ quét ({scanTimeStr}). Bắt đầu xử lý...");
                            await ScanDeadlinesAsync(false);

                            // Tự động dọn dẹp nhật ký cũ hơn 30 ngày
                            int cleaned = DatabaseService.DeleteOldAuditLogs(30);
                            if (cleaned > 0) _logger.LogInformation($"[DeadlineWorker] Đã dọn dẹp {cleaned} nhật ký cũ hơn 30 ngày.");

                            DatabaseService.SaveAppSetting("Notification_LastScanDate", todayStr);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[DeadlineWorker] Lỗi trong vòng lặp chính.");
                }

                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        public async Task ScanDeadlinesAsync(bool force = false)
        {
            using var scope = _serviceProvider.CreateScope();
            var notificationManager = scope.ServiceProvider.GetRequiredService<INotificationManager>();

            try
            {
                var docRepo = scope.ServiceProvider.GetRequiredService<ToolCalendar.Core.Data.Interfaces.IDocumentRepository>();
                var docs = await docRepo.GetAllAsync();
                var activeDocs = docs.Where(d => d.Status != "Đã hoàn thành" && d.ThoiHan.HasValue).ToList();

                DateTime today = DateTime.Today;
                int count = 0;

                foreach (var doc in activeDocs)
                {
                    int daysRemaining = (doc.ThoiHan!.Value.Date - today).Days;

                    // Logic 7-3-1: Chỉ thông báo vào đúng các mốc 7 ngày, 3 ngày và 1 ngày trước hạn
                    if (daysRemaining == 7 || daysRemaining == 3 || daysRemaining == 1 || daysRemaining == 0)
                    {
                        string title = $"🔔 HẠN XỬ LÝ: {doc.SoVanBan}";
                        string body = $"Văn bản sắp hết hạn (còn {daysRemaining} ngày). \nTrích yếu: {doc.TrichYeu}";

                        if (doc.AssignedTo.HasValue)
                        {
                            await notificationManager.SendToUserAsync(
                                doc.AssignedTo.Value,
                                title,
                                body,
                                new
                                {
                                    docId = doc.Id,
                                    type = "deadline",
                                    days = daysRemaining,
                                    url = $"/index.html?docId={doc.Id}"
                                }
                            );
                            count++;
                        }
                        else
                        {
                            // Nếu chưa gán cho ai, gửi cho tất cả Admin (UserId = 1 thường là admin đầu tiên)
                            // Hoặc đơn giản là gửi cho người đang quét nếu là yêu cầu thủ công
                            await notificationManager.SendToUserAsync(
                                1, // Mặc định gửi cho Admin ID 1
                                title,
                                body,
                                new
                                {
                                    docId = doc.Id,
                                    type = "deadline",
                                    days = daysRemaining,
                                    url = $"?docId={doc.Id}"
                                }
                            );
                            count++;
                        }
                    }
                }

                DatabaseService.InsertAuditLog(null, $"[Hệ thống] Hoàn tất quét thời hạn. Tìm thấy {activeDocs.Count} văn bản đang xử lý, đã gửi {count} thông báo nhắc việc.");
                _logger.LogInformation($"[DeadlineWorker] Đã quét xong. Gửi {count} thông báo.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DeadlineWorker] Lỗi trong quá trình quét thời hạn.");
                DatabaseService.InsertAuditLog(null, $"[Hệ thống] Lỗi khi quét thời hạn: {ex.Message}");
            }
        }
    }
}

