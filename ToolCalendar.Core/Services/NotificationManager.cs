using Microsoft.Extensions.Logging;
using ToolCalendar.Data;
using ToolCalendar.Models;
using System.Text.Json;

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
        private readonly SessionHubService _sessionHub;
        private readonly ILogger<NotificationManager> _logger;

        public NotificationManager(
            IEmailService emailService, 
            IVapidService vapidService, 
            SessionHubService sessionHub,
            ILogger<NotificationManager> logger)
        {
            _emailService = emailService;
            _vapidService = vapidService;
            _sessionHub = sessionHub;
            _logger = logger;
        }

        public async Task SendToUserAsync(int userId, string title, string body, object? data = null)
        {
            var user = DatabaseService.GetUserById(userId);
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
            var subscriptions = DatabaseService.GetPushSubscriptions(userId);
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

            // 3. Gửi Real-time SSE (nếu user đang mở web)
            await _sessionHub.BroadcastAsync("notification", new {
                title,
                body,
                data
            });

            // 4. Lưu vào Database (Lịch sử thông báo)
            int? docIdValue = null;
            if (data != null)
            {
                var dataDict = JsonSerializer.Deserialize<Dictionary<string, object>>(JsonSerializer.Serialize(data));
                if (dataDict != null && dataDict.TryGetValue("docId", out var dId))
                {
                    if (int.TryParse(dId?.ToString(), out int parsedId)) docIdValue = parsedId;
                }
            }

            DatabaseService.InsertNotification(new Core.Models.NotificationRecord
            {
                UserId = userId,
                Title = title,
                Body = body,
                Type = "deadline",
                DocId = docIdValue,
                IsRead = false
            });

            // 5. Log vào AuditLog
            DatabaseService.InsertAuditLog(userId, $"Thông báo: {title} - {body}");
        }
    }
}
