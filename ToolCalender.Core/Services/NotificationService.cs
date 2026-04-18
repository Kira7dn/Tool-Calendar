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
            var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

            try
            {
                var docs = DatabaseService.GetAll();
                var activeDocs = docs.Where(d => d.Status != "Đã hoàn thành" && d.ThoiHan.HasValue);

                DateTime today = DateTime.Today;

                foreach (var doc in activeDocs)
                {
                    int daysRemaining = (doc.ThoiHan.Value.Date - today).Days;

                    if (daysRemaining == 7 || daysRemaining == 3 || daysRemaining == 1)
                    {
                        string actionKey = $"Deadline_{daysRemaining}_Doc_{doc.Id}_{today:yyyyMMdd}";
                        
                        // Kiểm tra xem hôm nay đã thông báo cho văn bản này ở mốc này chưa
                        // Thực tế ta có thể query AuditLogs, nhưng để đơn giản ta cứ gửi.
                        // Vì worker này chỉ chạy 1 lần duy nhất lúc 08:30 nên không sợ lặp.

                        string message = $"[CẢNH BÁO] Văn bản số {doc.SoVanBan} còn {daysRemaining} ngày để hoàn thành ({doc.ThoiHan:dd/MM/yyyy}).";
                        
                        // 1. Ghi log hệ thống
                        DatabaseService.InsertAuditLog(null, message);

                        // 2. Gửi Email (Stub)
                        string emailSubject = $"[ToolCalendar] Cảnh báo thời hạn: {doc.SoVanBan}";
                        string emailBody = $@"Chào bạn, 
Văn bản: {doc.TenCongVan} (Số: {doc.SoVanBan})
Trích yếu: {doc.TrichYeu}
CÒN {daysRemaining} NGÀY ĐỂ HOÀN THÀNH.
Hạn xử lý: {doc.ThoiHan:dd/MM/yyyy}.
Vui lòng kiểm tra và xử lý đúng hạn.";

                        await emailService.SendEmailAsync("assigned_user@example.com", emailSubject, emailBody);
                        
                        _logger.LogInformation($"[DeadlineWorker] Đã tạo thông báo mốc {daysRemaining} ngày cho văn bản ID {doc.Id}");
                    }
                }
                _logger.LogInformation("[DeadlineWorker] Đã hoàn tất lượt quét hàng ngày.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DeadlineWorker] Lỗi trong quá trình quét thời hạn.");
            }
        }
    }
}
