using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Models;
using ToolCalendar.Core.Services;

namespace ToolCalendar.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly IAiAssistantService _aiAssistantService;

        public ChatController(IAiAssistantService aiAssistantService)
        {
            _aiAssistantService = aiAssistantService;
        }

        [HttpPost("message")]
        public async Task<IActionResult> ProcessMessage([FromBody] ChatRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.Message))
            {
                return BadRequest(ApiResponse.Fail("Tin nhắn không được để trống."));
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(ApiResponse.Fail("Không tìm thấy thông tin người dùng."));
            }

            var reply = await _aiAssistantService.ProcessChatAsync(userId, request.Message);

            return Ok(ApiResponse<ChatResponse>.Ok(new ChatResponse
            {
                Reply = reply,
                IsSuccess = true
            }));
        }
    }
}
