using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Data.Repositories;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Controllers
{
    [ApiController]
    [Route("api/documents")]
    [Authorize]
    public class DocumentRoutingsController : ControllerBase
    {
        private readonly IDocumentRoutingRepository _routingRepo;

        public DocumentRoutingsController(IDocumentRoutingRepository routingRepo)
        {
            _routingRepo = routingRepo;
        }

        [HttpGet("{documentId}/routings")]
        public async Task<IActionResult> GetRoutings(int documentId)
        {
            var tree = await _routingRepo.GetTreeByDocumentIdAsync(documentId);
            return Ok(tree);
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
            return Ok(new { id = newId });
        }

        [HttpPut("/api/routings/{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] RoutingUpdateDto dto)
        {
            await _routingRepo.UpdateStatusAsync(id, dto.Status, dto.ProcessingContent);
            return Ok();
        }
    }

    public class RoutingUpdateDto
    {
        public string Status { get; set; } = "";
        public string ProcessingContent { get; set; } = "";
    }
}
