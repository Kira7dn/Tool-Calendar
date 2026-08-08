using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using ToolCalendar.Core.Models;
using ToolCalendar.Data.Repositories;
using ToolCalendar.Hubs;
using ToolCalendar.Models;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Services;

namespace ToolCalendar.Api.Controllers.Documents
{
    [ApiController]
    [Route("api/documents")]
    [Authorize]
    public class DocumentRoutingsController : ControllerBase
    {
        private readonly IDocumentRoutingRepository _routingRepo;
        private readonly INotificationManager _notificationManager;
        private readonly IDocumentRepository _documentRepo;
        private readonly IUserRepository _userRepo;

        public DocumentRoutingsController(
            IDocumentRoutingRepository routingRepo,
            INotificationManager notificationManager,
            IDocumentRepository documentRepo,
            IUserRepository userRepo)
        {
            _routingRepo    = routingRepo;
            _notificationManager = notificationManager;
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

            if (routing.ReceiverId > 0)
            {
                // ✅ Chỉ cho phép 1 người Chủ trì. Nếu đã có, tự động chuyển thành Phối hợp
                if (routing.Role == "Chủ trì")
                {
                    var existingTree = await _routingRepo.GetTreeByDocumentIdAsync(documentId);
                    bool hasChuTri = false;
                    void CheckNode(DocumentRoutingRecord node)
                    {
                        if (node.Role == "Chủ trì") hasChuTri = true;
                        if (node.Children != null)
                        {
                            foreach (var child in node.Children) CheckNode(child);
                        }
                    }
                    foreach (var root in existingTree) CheckNode(root);

                    if (hasChuTri)
                    {
                        routing.Role = "Phối hợp";
                    }
                    else
                    {
                        var receiver = _userRepo.GetUserById(routing.ReceiverId);
                        await _documentRepo.UpdateHandlerAsync(documentId, routing.ReceiverId, receiver?.DepartmentId);
                    }
                }

                // ✅ Gửi thông báo cho TẤT CẢ các vai trò (Chủ trì, Phối hợp, ...)
                var doc = await _documentRepo.GetDocumentByIdAsync(documentId);
                var docName = doc?.TenCongVan ?? "văn bản mới";
                
                await _notificationManager.SendToUserAsync(
                    routing.ReceiverId,
                    "Công việc mới",
                    $"Bạn nhận được {docName} để xử lý với vai trò: {routing.Role}",
                    new { docId = documentId, type = "routing", routingId = newId }
                );
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
