using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalender.Data;
using ToolCalender.Models;
using ToolCalender.Services;
using System.Security.Claims;
using System.Text.Json;

namespace ToolCalender.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationController : ControllerBase
    {
        private readonly IVapidService _vapidService;

        public NotificationController(IVapidService vapidService)
        {
            _vapidService = vapidService;
        }

        [HttpGet("vapid-public-key")]
        [AllowAnonymous]
        public IActionResult GetVapidPublicKey()
        {
            return Ok(new { publicKey = _vapidService.GetVapidPublicKey() });
        }

        [HttpPost("subscribe")]
        public IActionResult Subscribe([FromBody] PushSubscriptionRequest request)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var subscription = new PushSubscription
            {
                UserId = userId,
                Endpoint = request.Endpoint,
                P256dh = request.P256dh,
                Auth = request.Auth
            };

            DatabaseService.InsertPushSubscription(subscription);
            return Ok(new { message = "Subscribed successfully" });
        }

        [HttpPost("test")]
        public async Task<IActionResult> TestNotification()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            var subscriptions = DatabaseService.GetPushSubscriptions(userId);
            if (!subscriptions.Any()) return BadRequest("No subscriptions found for this user");

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

            return Ok(new { message = $"Sent to {subscriptions.Count} endpoints" });
        }
    }

    public class PushSubscriptionRequest
    {
        public string Endpoint { get; set; } = string.Empty;
        public string P256dh { get; set; } = string.Empty;
        public string Auth { get; set; } = string.Empty;
    }
}
