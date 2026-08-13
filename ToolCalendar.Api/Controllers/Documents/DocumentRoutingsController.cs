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
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<NotificationHub> _hubContext;

        public DocumentRoutingsController(
            IDocumentRoutingRepository routingRepo,
            INotificationManager notificationManager,
            IDocumentRepository documentRepo,
            IUserRepository userRepo,
            IServiceScopeFactory scopeFactory,
            IHubContext<NotificationHub> hubContext)
        {
            _routingRepo    = routingRepo;
            _notificationManager = notificationManager;
            _documentRepo   = documentRepo;
            _userRepo        = userRepo;
            _scopeFactory    = scopeFactory;
            _hubContext      = hubContext;
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

            // ✅ Chỉ cho phép 1 người Chủ trì duy nhất.
            // Nếu người dùng chọn chuyển cho người khác làm Chủ trì, tất cả Chủ trì cũ sẽ bị giáng xuống thành Phối hợp.
            if (routing.Role == "Chủ trì")
            {
                await _routingRepo.DowngradeRoleAsync(documentId, "Chủ trì", "Phối hợp");
            }

            int newId = await _routingRepo.CreateRoutingAsync(routing);

            if (routing.ReceiverId > 0)
            {
                if (routing.Role == "Chủ trì")
                {
                    var receiver = _userRepo.GetUserById(routing.ReceiverId);
                    await _documentRepo.UpdateHandlerAsync(documentId, routing.ReceiverId, receiver?.DepartmentId);
                }

                // ✅ Gửi thông báo cho TẤT CẢ các vai trò (Chủ trì, Phối hợp, ...)
                var doc = await _documentRepo.GetDocumentByIdAsync(documentId);
                var docName = doc?.TenCongVan ?? "văn bản mới";
                
                // Fire and forget notification
                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var scope = _scopeFactory.CreateScope();
                        var notificationManager = scope.ServiceProvider.GetRequiredService<INotificationManager>();
                        await notificationManager.SendToUserAsync(
                            routing.ReceiverId,
                            "Công việc mới",
                            $"Bạn nhận được {docName} để xử lý với vai trò: {routing.Role}",
                            new { docId = documentId, type = "routing", routingId = newId }
                        );
                    }
                    catch { }
                });
            }

            // 🔔 Phát sự kiện realtime cho tất cả người đang xem trang này
            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = documentId });

            return Ok(ApiResponse.Ok(new { id = newId }));
        }

        [HttpPut("/api/routings/{id}/reject")]
        public async Task<IActionResult> RejectRouting(int id, [FromBody] RejectRoutingDto dto)
        {
            // Lấy userId hiện tại từ JWT claim
            var userIdClaim = User.FindFirst("uid")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int currentUserId))
                return Unauthorized(ApiResponse.Fail("Không thể xác định người dùng hiện tại."));

            // Kiểm tra routing tồn tại
            var routing = await _routingRepo.GetByIdAsync(id);
            if (routing == null)
                return NotFound(ApiResponse.Fail("Không tìm thấy bản ghi luân chuyển."));

            // Chỉ người là ReceiverId mới được hủy tiếp nhận (chống giả mạo)
            if (routing.ReceiverId != currentUserId)
                return StatusCode(403, ApiResponse.Fail("Bạn không có quyền hủy tiếp nhận bản ghi này."));

            // Không thể hủy nếu đã hoàn thành hoặc đã từ chối trước đó
            if (routing.Status == "Hoàn thành" || routing.Status == "Từ chối")
                return BadRequest(ApiResponse.Fail($"Không thể hủy tiếp nhận khi trạng thái là '{routing.Status}'."));

            // Cập nhật trạng thái routing → Từ chối
            var reason = string.IsNullOrWhiteSpace(dto.Reason) ? "Không có lý do" : dto.Reason.Trim();
            await _routingRepo.UpdateStatusAsync(id, "Từ chối", reason);

            var doc = await _documentRepo.GetDocumentByIdAsync(routing.DocumentId);
            
            // Nếu người từ chối đang là người xử lý chính của văn bản,
            // reset doc.Status về "Chưa xử lý" để người giao việc có thể hành động tiếp.
            // KHÔNG set "Từ chối" vì đó là routing-level status, không phải Document status hợp lệ.
            if (doc != null && doc.AssignedTo == currentUserId && (routing.Role == "Xử lý chính" || routing.Role == "Chủ trì"))
            {
                doc.Status = "Chưa xử lý";
                await _documentRepo.UpdateAsync(doc);
            }

            // Gửi thông báo cho người đã chuyển (SenderId)
            var receiver = _userRepo.GetUserById(currentUserId);
            var docName = doc?.TenCongVan ?? "văn bản";

            await _notificationManager.SendToUserAsync(
                routing.SenderId,
                "Từ chối tiếp nhận",
                $"{receiver?.FullName ?? "Người dùng"} đã từ chối tiếp nhận '{docName}'. Lý do: {reason}",
                new { docId = routing.DocumentId, type = "routing_rejected", routingId = id }
            );

            // Thêm thông báo cho người upload nếu khác SenderId và khác người từ chối
            if (doc != null && doc.UploadedByUserId > 0 && doc.UploadedByUserId != routing.SenderId && doc.UploadedByUserId != currentUserId)
            {
                await _notificationManager.SendToUserAsync(
                    doc.UploadedByUserId,
                    "Từ chối tiếp nhận",
                    $"{receiver?.FullName ?? "Người dùng"} đã từ chối tiếp nhận '{docName}'. Lý do: {reason}",
                    new { docId = routing.DocumentId, type = "routing_rejected", routingId = id }
                );
            }

            // 🔔 Phát sự kiện realtime để refresh trang chi tiết
            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = routing.DocumentId });

            return Ok(ApiResponse.Ok("Đã hủy tiếp nhận thành công."));
        }

        [HttpPut("/api/routings/{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] RoutingUpdateDto dto)
        {
            var routing = await _routingRepo.GetByIdAsync(id);
            await _routingRepo.UpdateStatusAsync(id, dto.Status, dto.ProcessingContent);
            if (routing != null)
                _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = routing.DocumentId });
            return Ok(ApiResponse.Ok("Đã cập nhật trạng thái luân chuyển thành công."));
        }
    }

    public class RoutingUpdateDto
    {
        public string Status { get; set; } = "";
        public string ProcessingContent { get; set; } = "";
    }

    public class RejectRoutingDto
    {
        public string Reason { get; set; } = "";
    }
}

