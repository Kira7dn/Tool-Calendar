using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ToolCalender.Data;
using ToolCalender.Models;

namespace ToolCalender.Services
{
    public class DeadlineWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DeadlineWorker> _logger;

        public DeadlineWorker(IServiceProvider serviceProvider, ILogger<DeadlineWorker> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[DeadlineWorker] Khởi động dịch vụ quét thời hạn.");

            while (!stoppingToken.IsCancellationRequested)
            {
                // 1. Đọc giờ quét từ AppSettings (mặc định 08:30)
                string scanTimeStr = DatabaseService.GetAppSetting("Notification_ScanTime", "08:30");
                if (!TimeSpan.TryParse(scanTimeStr, out TimeSpan scanTime))
                {
                    scanTime = new TimeSpan(8, 30, 0);
                }

                // 2. Tính toán thời gian đợi đến lần quét tiếp theo
                DateTime now = DateTime.Now;
                DateTime nextScan = now.Date.Add(scanTime);
                if (now > nextScan)
                {
                    nextScan = nextScan.AddDays(1);
                }

                TimeSpan delay = nextScan - now;
                _logger.LogInformation($"[DeadlineWorker] Lần quét tiếp theo vào: {nextScan:yyyy-MM-dd HH:mm:ss} (Đợi {delay.TotalHours:F2} giờ)");

                try
                {
                    await Task.Delay(delay, stoppingToken);
                }
                catch (TaskCanceledException) { break; }

                // 3. Thực hiện quét
                _logger.LogInformation("[DeadlineWorker] Bắt đầu quét thời hạn văn bản...");
                await ScanDeadlinesAsync();
            }
        }

        private async Task ScanDeadlinesAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var notificationManager = scope.ServiceProvider.GetRequiredService<INotificationManager>();

            try
            {
                // 1. Kiểm tra ngày quét cuối cùng
                string todayStr = DateTime.Today.ToString("yyyy-MM-dd");
                string lastScanDate = DatabaseService.GetAppSetting("Notification_LastScanDate", "");

                if (lastScanDate == todayStr)
                {
                    _logger.LogInformation("[DeadlineWorker] Hôm nay đã quét thời hạn rồi. Bỏ qua.");
                    return;
                }

                var docs = DatabaseService.GetAll();
                var activeDocs = docs.Where(d => d.Status != "Đã hoàn thành" && d.ThoiHan.HasValue);

                DateTime today = DateTime.Today;

                foreach (var doc in activeDocs)
                {
                    int daysRemaining = (doc.ThoiHan!.Value.Date - today).Days;

                    // Chỉ thông báo các mốc quan trọng 7, 3, 1 ngày
                    if (daysRemaining == 7 || daysRemaining == 3 || daysRemaining == 1)
                    {
                        if (doc.AssignedTo.HasValue)
                        {
                            await notificationManager.SendToUserAsync(
                                doc.AssignedTo.Value,
                                "Nhắc nhở hạn xử lý",
                                $"Văn bản {doc.SoVanBan} còn {daysRemaining} ngày để hoàn thành ({doc.ThoiHan:dd/MM/yyyy}).",
                                new { docId = doc.Id, type = "deadline", days = daysRemaining }
                            );
                        }
                    }
                }

                // 2. Cập nhật ngày quét cuối cùng
                DatabaseService.SaveAppSetting("Notification_LastScanDate", todayStr);
                _logger.LogInformation("[DeadlineWorker] Đã hoàn tất lượt quét hàng ngày và lưu trạng thái.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DeadlineWorker] Lỗi trong quá trình quét thời hạn.");
            }
        }
    }
}
