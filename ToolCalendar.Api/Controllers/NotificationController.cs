using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;
using ToolCalendar.Core.Models;
using ToolCalendar.Data;
using ToolCalendar.Models;
using ToolCalendar.Services;

namespace ToolCalendar.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationController : ControllerBase
    {
        private readonly IVapidService _vapidService;
        private readonly DeadlineWorker _deadlineWorker;

        public NotificationController(IVapidService vapidService, DeadlineWorker deadlineWorker)
        {
            _vapidService = vapidService;
            _deadlineWorker = deadlineWorker;
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPost("trigger-scan")]
        public async Task<IActionResult> TriggerScan()
        {
            await _deadlineWorker.ScanDeadlinesAsync(true);
            return Ok(ApiResponse.Ok("Đã kích hoạt quét thời hạn thành công."));
        }

        [HttpGet("vapid-public-key")]
        [AllowAnonymous]
        public IActionResult GetVapidPublicKey()
        {
            return Ok(ApiResponse.Ok(new { publicKey = _vapidService.GetVapidPublicKey() }));
        }

        [HttpPost("subscribe")]
        public IActionResult Subscribe([FromBody] PushSubscriptionRequest request)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) 
                return Unauthorized(ApiResponse.Fail("Không tìm thấy người dùng."));

            var subscription = new PushSubscription
            {
                UserId = userId,
                Endpoint = request.Endpoint,
                P256dh = request.P256dh,
                Auth = request.Auth
            };

            DatabaseService.InsertPushSubscription(subscription);
            return Ok(ApiResponse.Ok("Subscribed successfully"));
        }

        [HttpPost("test")]
        public async Task<IActionResult> TestNotification()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) 
                return Unauthorized(ApiResponse.Fail("Không tìm thấy người dùng."));

            var subscriptions = DatabaseService.GetPushSubscriptions(userId);
            if (!subscriptions.Any()) 
                return BadRequest(ApiResponse.Fail("Không tìm thấy đăng ký thông báo đẩy cho người dùng này."));

            var payload = JsonSerializer.Serialize(new NotificationPayload
            {
                Title = "Thông báo thử nghiệm",
                Body = "Hệ thống thông báo đẩy đã hoạt động!",
                Icon = "/assets/logo.png"
            });

            foreach (var sub in subscriptions)
            {
                await _vapidService.SendNotificationAsync(sub.Endpoint, sub.P256dh, sub.Auth, payload);
            }

            return Ok(ApiResponse.Ok($"Đã gửi tới {subscriptions.Count} thiết bị đăng ký."));
        }

        [HttpGet]
        public IActionResult GetMyNotifications()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) 
                return Unauthorized(ApiResponse.Fail("Không tìm thấy người dùng."));

            var list = DatabaseService.GetNotifications(userId);
            return Ok(ApiResponse.Ok(list));
        }

        [HttpPost("mark-read/{id}")]
        public IActionResult MarkRead(int id)
        {
            DatabaseService.MarkNotificationAsRead(id);
            return Ok(ApiResponse.Ok("Đã đánh dấu đã đọc."));
        }

        [HttpPost("mark-all-read")]
        public IActionResult MarkAllRead()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) 
                return Unauthorized(ApiResponse.Fail("Không tìm thấy người dùng."));

            DatabaseService.MarkAllNotificationsAsRead(userId);
            return Ok(ApiResponse.Ok("Đã đánh dấu đã đọc toàn bộ thông báo."));
        }
    }

    public class PushSubscriptionRequest
    {
        public string Endpoint { get; set; } = string.Empty;
        public string P256dh { get; set; } = string.Empty;
        public string Auth { get; set; } = string.Empty;
    }
}
