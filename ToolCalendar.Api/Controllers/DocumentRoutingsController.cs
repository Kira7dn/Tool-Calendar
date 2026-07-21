using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using ToolCalendar.Core.Models;
using ToolCalendar.Data.Repositories;
using ToolCalendar.Hubs;
using ToolCalendar.Models;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Api.Controllers
{
    [ApiController]
    [Route("api/documents")]
    [Authorize]
    public class DocumentRoutingsController : ControllerBase
    {
        private readonly IDocumentRoutingRepository _routingRepo;
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly INotificationRepository _notificationRepo;
        private readonly IDocumentRepository _documentRepo;
        private readonly IUserRepository _userRepo;

        public DocumentRoutingsController(
            IDocumentRoutingRepository routingRepo,
            IHubContext<NotificationHub> hubContext,
            INotificationRepository notificationRepo,
            IDocumentRepository documentRepo,
            IUserRepository userRepo)
        {
            _routingRepo    = routingRepo;
            _hubContext      = hubContext;
            _notificationRepo = notificationRepo;
            _documentRepo   = documentRepo;
            _userRepo        = userRepo;
        }

        [HttpGet("{documentId}/routings")]
        public async Task<IActionResult> GetRoutings(int documentId)
        {
            var tree = await _routingRepo.GetTreeByDocumentIdAsync(documentId);
            return Ok(ApiResponse.Ok(tree));
        }

        [HttpPost("{documentId}/routings")]
        public async Task<IActionResult> CreateRouting(int documentId, [FromBody] DocumentRoutingRecord routing)
        {
            routing.DocumentId = documentId;
            var userIdClaim = User.FindFirst("uid")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out int senderId))
            {
                routing.SenderId = senderId;
            }
            routing.CreatedAt = DateTime.Now;

            int newId = await _routingRepo.CreateRoutingAsync(routing);

            // ✅ Cập nhật Cán bộ xử lý và Đơn vị chủ trì dựa trên người nhận
            if (routing.ReceiverId > 0)
            {
                var receiver = _userRepo.GetUserById(routing.ReceiverId);
                await _documentRepo.UpdateHandlerAsync(documentId, routing.ReceiverId, receiver?.DepartmentId);

                // 1. Lưu thông báo vào DB để hiện ở biểu tượng cái chuông
                _notificationRepo.InsertNotification(new Core.Models.NotificationRecord
                {
                    UserId = routing.ReceiverId,
                    Title = "Công việc mới",
                    Body = "Bạn có công văn mới cần xử lý.",
                    Type = "system",
                    DocId = documentId
                });

                // 2. Gửi realtime SignalR
                _ = _hubContext.Clients
                    .Group($"User_{routing.ReceiverId}")
                    .SendAsync("NewTask", new
                    {
                        documentId  = documentId,
                        routingId   = newId,
                        message     = "Bạn có công văn mới cần xử lý",
                        senderId    = routing.SenderId,
                        assignedAt  = DateTime.Now
                    });
            }

            return Ok(ApiResponse.Ok(new { id = newId }));
        }

        [HttpPut("/api/routings/{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] RoutingUpdateDto dto)
        {
            await _routingRepo.UpdateStatusAsync(id, dto.Status, dto.ProcessingContent);
            return Ok(ApiResponse.Ok("Cập nhật trạng thái luân chuyển thành công."));
        }
    }

    public class RoutingUpdateDto
    {
        public string Status { get; set; } = "";
        public string ProcessingContent { get; set; } = "";
    }
}
