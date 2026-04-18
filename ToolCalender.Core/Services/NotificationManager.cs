using Microsoft.Extensions.Logging;
using ToolCalender.Data;
using ToolCalender.Models;
using System.Text.Json;

namespace ToolCalender.Services
{
    public interface INotificationManager
    {
        Task SendToUserAsync(int userId, string title, string body, object? data = null);
    }

    public class NotificationManager : INotificationManager
    {
        private readonly IEmailService _emailService;
        private readonly IVapidService _vapidService;
        private readonly ILogger<NotificationManager> _logger;

        public NotificationManager(IEmailService emailService, IVapidService vapidService, ILogger<NotificationManager> _logger)
        {
            _emailService = emailService;
            _vapidService = vapidService;
            this._logger = _logger;
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
                var payload = JsonSerializer.Serialize(new NotificationPayload
                {
                    Title = title,
                    Body = body,
                    Icon = "/assets/logo.png",
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

            // 3. Log vào AuditLog
            DatabaseService.InsertAuditLog(userId, $"Thông báo: {title} - {body}");
        }
    }
}
