using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Services
{
    public class DeadlineWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DeadlineWorker> _logger;
        private static readonly SemaphoreSlim _scanLock = new SemaphoreSlim(1, 1);

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
                    using var scope = _serviceProvider.CreateScope();
                    var settingRepo = scope.ServiceProvider.GetRequiredService<ISettingRepository>();
                    var auditRepo = scope.ServiceProvider.GetRequiredService<IAuditLogRepository>();

                    string scanTimeStr = settingRepo.GetAppSetting("Notification_ScanTime", "08:30");
                    if (!TimeSpan.TryParse(scanTimeStr, out TimeSpan targetTime))
                    {
                        targetTime = new TimeSpan(8, 30, 0);
                    }

                    DateTime now = DateTime.UtcNow.AddHours(7);
                    
                    // Kiểm tra xem đã đến giờ quét chưa (trong phạm vi phút hiện tại)
                    if (now.Hour == targetTime.Hours && now.Minute == targetTime.Minutes)
                    {
                        string todayStr = now.ToString("yyyy-MM-dd");
                        string lastScanDate = settingRepo.GetAppSetting("Notification_LastScanDate", "");

                        if (lastScanDate != todayStr)
                        {
                            _logger.LogInformation($"[DeadlineWorker] Bắt đầu quét tự động lúc {now:HH:mm:ss} (Giờ cài đặt: {scanTimeStr})");
                            
                            // Đánh dấu đã quét NGAY LẬP TỨC để tránh quét lặp lại
                            settingRepo.SaveAppSetting("Notification_LastScanDate", todayStr);
                            
                            await ScanDeadlinesAsync(false);

                            // Tự động dọn dẹp nhật ký cũ hơn 30 ngày
                            int cleaned = auditRepo.DeleteOldAuditLogs(30);
                            if (cleaned > 0) _logger.LogInformation($"[DeadlineWorker] Đã dọn dẹp {cleaned} nhật ký cũ.");
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[DeadlineWorker] Lỗi trong vòng lặp chính.");
                }

                // Nghỉ 30 giây để đảm bảo không bỏ lỡ phút mục tiêu
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }

        public async Task ScanDeadlinesAsync(bool force = false)
        {
            if (!await _scanLock.WaitAsync(0)) 
            {
                _logger.LogWarning("[DeadlineWorker] Một tiến trình quét đang chạy, bỏ qua lần quét này.");
                return;
            }

            try
            {
                using var scope = _serviceProvider.CreateScope();
                var notificationManager = scope.ServiceProvider.GetRequiredService<INotificationManager>();
                var docRepo = scope.ServiceProvider.GetRequiredService<ToolCalendar.Core.Data.Interfaces.IDocumentRepository>();
                var auditRepo = scope.ServiceProvider.GetRequiredService<IAuditLogRepository>();
                var docs = await docRepo.GetAllAsync();
                var activeDocs = docs.Where(d => d.Status != "Đã xử lý" && d.ThoiHan.HasValue).ToList();

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
                            await notificationManager.SendToUserAsync(
                                1, // Admin mặc định
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

                auditRepo.InsertAuditLog(null, $"[Hệ thống] Hoàn tất quét thời hạn. Tổng số văn bản đang xử lý: {activeDocs.Count}. Đã gửi: {count} thông báo nhắc việc.");
                _logger.LogInformation($"[DeadlineWorker] Đã quét xong {activeDocs.Count} văn bản. Gửi {count} thông báo.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DeadlineWorker] Lỗi trong quá trình quét thời hạn.");
                using var scope = _serviceProvider.CreateScope();
                var auditRepo = scope.ServiceProvider.GetRequiredService<IAuditLogRepository>();
                auditRepo.InsertAuditLog(null, $"[Hệ thống] Lỗi khi quét thời hạn: {ex.Message}");
            }
            finally
            {
                _scanLock.Release();
            }
        }
    }
}
