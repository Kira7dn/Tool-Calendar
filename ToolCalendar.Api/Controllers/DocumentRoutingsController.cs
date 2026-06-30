using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using ToolCalendar.Core.Models;
using ToolCalendar.Data.Repositories;
using ToolCalendar.Hubs;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Controllers
{
    [ApiController]
    [Route("api/documents")]
    [Authorize]
    public class DocumentRoutingsController : ControllerBase
    {
        private readonly IDocumentRoutingRepository _routingRepo;
        private readonly IHubContext<NotificationHub> _hubContext;

        public DocumentRoutingsController(
            IDocumentRoutingRepository routingRepo,
            IHubContext<NotificationHub> hubContext)
        {
            _routingRepo = routingRepo;
            _hubContext  = hubContext;
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
            // Get sender id from token
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "id")?.Value;
            if (int.TryParse(userIdClaim, out int senderId))
            {
                routing.SenderId = senderId;
            }
            routing.CreatedAt = DateTime.Now;

            int newId = await _routingRepo.CreateRoutingAsync(routing);

            // ✅ Gửi SignalR notification đến người được chỉ định (chuyển xử lý)
            if (routing.ReceiverId > 0)
            {
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
