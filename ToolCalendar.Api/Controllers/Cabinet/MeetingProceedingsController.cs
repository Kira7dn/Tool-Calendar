using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Data.Repositories;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Controllers.Cabinet
{
    [Route("api/phonghopkhonggiayto/proceedings")]
    [ApiController]
    [Authorize]
    public class MeetingProceedingsController : ControllerBase
    {
        private readonly IMeetingProceedingRepository _repo;

        public MeetingProceedingsController(IMeetingProceedingRepository repo)
        {
            _repo = repo;
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)
                ?? User.FindFirst("sub")
                ?? User.FindFirst("id");
            return int.TryParse(claim?.Value, out var id) ? id : 0;
        }

        // GET /api/phonghopkhonggiayto/proceedings
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var list = await _repo.GetAllAsync();
            return Ok(ApiResponse.Ok(list));
        }

        // GET /api/phonghopkhonggiayto/proceedings/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var item = await _repo.GetByIdWithMeetingsAsync(id);
            if (item == null) return NotFound(ApiResponse.Fail("Không tìm thấy kỷ yếu."));
            return Ok(ApiResponse.Ok(item));
        }

        // POST /api/phonghopkhonggiayto/proceedings
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateProceedingRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(ApiResponse.Fail("Tên kỷ yếu không được để trống."));

            var creatorId = GetCurrentUserId();
            var newId = await _repo.CreateAsync(request, creatorId);
            var created = await _repo.GetByIdWithMeetingsAsync(newId);
            return Ok(ApiResponse.Ok(created, "Tạo kỷ yếu thành công."));
        }

        // POST /api/phonghopkhonggiayto/proceedings/{id}/meetings/{meetingId}
        [HttpPost("{id}/meetings/{meetingId}")]
        public async Task<IActionResult> AddMeeting(int id, int meetingId)
        {
            var success = await _repo.AddMeetingAsync(id, meetingId);
            return Ok(ApiResponse.Ok(success, "Đã gắn phiên họp vào kỷ yếu."));
        }

        // DELETE /api/phonghopkhonggiayto/proceedings/{id}/meetings/{meetingId}
        [HttpDelete("{id}/meetings/{meetingId}")]
        public async Task<IActionResult> RemoveMeeting(int id, int meetingId)
        {
            var success = await _repo.RemoveMeetingAsync(id, meetingId);
            if (!success) return NotFound(ApiResponse.Fail("Không tìm thấy liên kết phiên họp."));
            return Ok(ApiResponse.Ok(null, "Đã gỡ phiên họp khỏi kỷ yếu."));
        }

        // DELETE /api/phonghopkhonggiayto/proceedings/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,LanhDao")]
        public async Task<IActionResult> Delete(int id)
        {
            var success = await _repo.DeleteAsync(id);
            if (!success) return NotFound(ApiResponse.Fail("Không tìm thấy kỷ yếu."));
            return Ok(ApiResponse.Ok(null, "Đã xóa kỷ yếu."));
        }
    }
}
