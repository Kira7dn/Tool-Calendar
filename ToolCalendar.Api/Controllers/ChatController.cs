using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Models;
using ToolCalendar.Core.Services;
using ToolCalendar.Core.Data.Interfaces;
using System.Collections.Generic;

namespace ToolCalendar.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly IAiAssistantService _aiAssistantService;
        private readonly IChatHistoryRepository _chatHistoryRepo;

        public ChatController(IAiAssistantService aiAssistantService, IChatHistoryRepository chatHistoryRepo)
        {
            _aiAssistantService = aiAssistantService;
            _chatHistoryRepo = chatHistoryRepo;
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(ApiResponse.Fail("Không tìm thấy thông tin người dùng."));
            }

            var history = await _chatHistoryRepo.GetHistoryByUserIdAsync(userId, 50);
            return Ok(ApiResponse<List<ChatMessageDto>>.Ok(history));
        }

        [HttpDelete("history")]
        public async Task<IActionResult> ClearHistory()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(ApiResponse.Fail("Không tìm thấy thông tin người dùng."));
            }

            await _chatHistoryRepo.ClearHistoryAsync(userId);
            return Ok(ApiResponse.Ok("Đã xóa lịch sử chat."));
        }

        [HttpPost("message")]
        public async Task ProcessMessage([FromBody] ChatRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.Message))
            {
                Response.StatusCode = 400;
                return;
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int userId))
            {
                Response.StatusCode = 401;
                return;
            }

            Response.ContentType = "text/event-stream";
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");
            Response.Headers.Append("X-Accel-Buffering", "no"); // Disable Nginx proxy buffering
            
            var stream = _aiAssistantService.ProcessChatStreamAsync(userId, request.Message, request.DocumentId);
            await foreach (var chunk in stream)
            {
                var jsonChunk = System.Text.Json.JsonSerializer.Serialize(new { text = chunk });
                var data = $"data: {jsonChunk}\n\n";
                var bytes = System.Text.Encoding.UTF8.GetBytes(data);
                await Response.Body.WriteAsync(bytes, 0, bytes.Length);
                await Response.Body.FlushAsync();
            }
        }
    }
}
