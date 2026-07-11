using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using ToolCalendar.Hubs;
using ToolCalendar.Models;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Services
{
    public interface INotificationManager
    {
        Task SendToUserAsync(int userId, string title, string body, object? data = null);
    }

    public class NotificationManager : INotificationManager
    {
        private readonly IEmailService _emailService;
        private readonly IVapidService _vapidService;
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly ILogger<NotificationManager> _logger;
        private readonly IUserRepository _userRepo;
        private readonly INotificationRepository _notificationRepo;
        private readonly IAuditLogRepository _auditRepo;

        public NotificationManager(
            IEmailService emailService,
            IVapidService vapidService,
            IHubContext<NotificationHub> hubContext,
            ILogger<NotificationManager> logger,
            IUserRepository userRepo,
            INotificationRepository notificationRepo,
            IAuditLogRepository auditRepo)
        {
            _emailService = emailService;
            _vapidService = vapidService;
            _hubContext = hubContext;
            _logger = logger;
            _userRepo = userRepo;
            _notificationRepo = notificationRepo;
            _auditRepo = auditRepo;
        }

        public async Task SendToUserAsync(int userId, string title, string body, object? data = null)
        {
            var user = await _userRepo.GetByIdAsync(userId);
            if (user == null)
            {
                _logger.LogWarning($"[NotificationManager] Không tìm thấy user ID {userId} để gửi thông báo.");
                return;
            }

            // 1. Gửi Email (nếu có)
            if (!string.IsNullOrEmpty(user.Email))
            {
                try
                {
                    await _emailService.SendEmailAsync(user.Email, $"[ToolCalendar] {title}", body);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"[NotificationManager] Lỗi gửi email cho user {userId}");
                }
            }

            // 2. Gửi Web Push (nếu có subscription)
            var subscriptions = _notificationRepo.GetPushSubscriptions(userId);
            if (subscriptions.Any())
            {
                string? url = null;
                if (data != null)
                {
                    var dataDict = JsonSerializer.Deserialize<Dictionary<string, object>>(JsonSerializer.Serialize(data));
                    if (dataDict != null && dataDict.TryGetValue("docId", out var docId))
                    {
                        url = $"/index.html?docId={docId}";
                    }
                }

                var payload = JsonSerializer.Serialize(new NotificationPayload
                {
                    Title = title,
                    Body = body,
                    Icon = "/assets/logo.png",
                    Url = url ?? "/",
                    Data = data
                });

                foreach (var sub in subscriptions)
                {
                    try
                    {
                        await _vapidService.SendNotificationAsync(sub.Endpoint, sub.P256dh, sub.Auth, payload);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"[NotificationManager] Lỗi gửi push cho subscription {sub.Endpoint}");
                    }
                }
            }

            // 4. Lưu vào Database (Lịch sử thông báo) - Thực hiện TRƯỚC khi gửi SignalR để đảm bảo dữ liệu sẵn sàng khi web nhận tin
            int? docIdValue = null;
            if (data != null)
            {
                try {
                    var jsonStr = JsonSerializer.Serialize(data);
                    var dataDict = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonStr);
                    if (dataDict != null && dataDict.TryGetValue("docId", out var dId))
                    {
                        if (int.TryParse(dId?.ToString(), out int parsedId)) docIdValue = parsedId;
                    }
                } catch { /* Bỏ qua lỗi parse data */ }
            }

            _notificationRepo.InsertNotification(new Core.Models.NotificationRecord
            {
                UserId = userId,
                Title = title,
                Body = body,
                Type = "deadline",
                DocId = docIdValue,
                IsRead = false
            });

            // 3. Gửi Real-time SignalR (nếu user đang mở web) - Bọc Try/Catch để không làm gián đoạn luồng chính
            try 
            {
                await _hubContext.Clients.Group($"User_{userId}").SendAsync("ReceiveNotification", new
                {
                    title,
                    body,
                    data
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[NotificationManager] Lỗi gửi SignalR cho user {userId}. Có thể user đã disconnect.");
            }

            // 5. Log vào AuditLog (Tối giản để tránh phình DB)
            _auditRepo.InsertAuditLog(userId, $"Thông báo: {title}");
        }
    }
}
