using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Data.Repositories;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Controllers.Cabinet
{
    public record UpdateAttendanceRequest(string Status);

    [Route("api/phonghopkhonggiayto/meetings")]
    [ApiController]
    [Authorize]
    public class MeetingsController : ControllerBase
    {
        private readonly IMeetingRepository _meetingRepo;
        private readonly IRoomRepository _roomRepo;

        public MeetingsController(IMeetingRepository meetingRepo, IRoomRepository roomRepo)
        {
            _meetingRepo = meetingRepo;
            _roomRepo = roomRepo;
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)
                ?? User.FindFirst("sub")
                ?? User.FindFirst("id");
            return int.TryParse(claim?.Value, out var id) ? id : 0;
        }

        // GET /api/phonghopkhonggiayto/meetings/schedule
        [HttpGet("schedule")]
        public async Task<IActionResult> GetSchedule()
        {
            var meetings = await _meetingRepo.GetAllAsync();
            return Ok(ApiResponse.Ok(meetings));
        }

        // GET /api/phonghopkhonggiayto/meetings/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var meeting = await _meetingRepo.GetByIdAsync(id);
            if (meeting == null)
                return NotFound(ApiResponse.Fail("Không tìm thấy phiên họp."));
            return Ok(ApiResponse.Ok(meeting));
        }

        // GET /api/phonghopkhonggiayto/meetings/my-meetings
        // Lấy danh sách phiên họp mà user hiện tại được mời tham dự (kèm trạng thái tham dự)
        [HttpGet("my-meetings")]
        public async Task<IActionResult> GetMyMeetings()
        {
            var userId = GetCurrentUserId();
            var meetings = await _meetingRepo.GetByParticipantAsync(userId);
            return Ok(ApiResponse.Ok(meetings));
        }

        // GET /api/phonghopkhonggiayto/meetings/dashboard
        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboardStats()
        {
            var userId = GetCurrentUserId();
            var all = await _meetingRepo.GetAllAsync();
            var myMeetings = await _meetingRepo.GetByParticipantAsync(userId);
            var now = DateTime.UtcNow.AddHours(7);

            // Tự động cập nhật trạng thái theo thời gian thực
            var ongoing = all.Where(m => m.StartTime <= now && m.EndTime >= now && m.Status != "Hủy").ToList();
            var upcoming = all.Where(m => m.StartTime > now && m.Status == "Sắp diễn ra").ToList();
            var today = all.Where(m => m.StartTime.Date == now.Date && m.Status != "Hủy").ToList();

            // Thống kê tham dự thực từ DB
            var confirmed = myMeetings.Count(m =>
                m.Participants.FirstOrDefault()?.AttendanceStatus == "Có tham gia");
            var unconfirmed = myMeetings.Count(m =>
                m.Participants.FirstOrDefault()?.AttendanceStatus is "Chưa xác nhận" or null);

            var stats = new
            {
                UpcomingCount = upcoming.Count,
                OngoingCount = ongoing.Count,
                TodayCount = today.Count,
                TotalThisMonth = all.Count(m => m.StartTime.Month == now.Month && m.StartTime.Year == now.Year),
                UpcomingMeetings = upcoming.Take(5),
                OngoingMeetings = ongoing,
                Participation = new
                {
                    Confirmed = confirmed,
                    Unconfirmed = unconfirmed
                }
            };

            return Ok(ApiResponse.Ok(stats));
        }

        // PUT /api/phonghopkhonggiayto/meetings/{id}/attendance
        // Cập nhật trạng thái tham dự của user hiện tại
        [HttpPut("{id}/attendance")]
        public async Task<IActionResult> UpdateAttendance(int id, [FromBody] UpdateAttendanceRequest request)
        {
            var userId = GetCurrentUserId();
            if (string.IsNullOrWhiteSpace(request.Status))
                return BadRequest(ApiResponse.Fail("Trạng thái không hợp lệ."));

            var allowedStatuses = new[] { "Có tham gia", "Chưa xác nhận", "Vắng mặt" };
            if (!allowedStatuses.Contains(request.Status))
                return BadRequest(ApiResponse.Fail($"Trạng thái phải là: {string.Join(", ", allowedStatuses)}"));

            var success = await _meetingRepo.UpdateAttendanceAsync(id, userId, request.Status);
            if (!success)
                return NotFound(ApiResponse.Fail("Không tìm thấy phiên họp hoặc bạn không được mời tham dự."));

            return Ok(ApiResponse.Ok(null, $"Đã cập nhật trạng thái tham dự thành '{request.Status}'."));
        }

        // POST /api/phonghopkhonggiayto/meetings
        [HttpPost]
        public async Task<IActionResult> CreateMeeting([FromBody] CreateMeetingRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Title))
                return BadRequest(ApiResponse.Fail("Tên phiên họp không được để trống."));

            if (request.EndTime <= request.StartTime)
                return BadRequest(ApiResponse.Fail("Thời gian kết thúc phải sau thời gian bắt đầu."));

            // Kiểm tra phòng có tồn tại không
            var room = await _roomRepo.GetByIdAsync(request.RoomId);
            if (room == null)
                return BadRequest(ApiResponse.Fail("Phòng họp không tồn tại."));

            if (room.Status == 0)
                return BadRequest(ApiResponse.Fail("Phòng họp đang không hoạt động."));

            var creatorId = GetCurrentUserId();
            var newId = await _meetingRepo.CreateAsync(request, creatorId);
            var created = await _meetingRepo.GetByIdAsync(newId);

            return Ok(ApiResponse.Ok(created, "Tạo phiên họp thành công."));
        }

        // PUT /api/phonghopkhonggiayto/meetings/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateMeeting(int id, [FromBody] CreateMeetingRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Title))
                return BadRequest(ApiResponse.Fail("Tên phiên họp không được để trống."));

            if (request.EndTime <= request.StartTime)
                return BadRequest(ApiResponse.Fail("Thời gian kết thúc phải sau thời gian bắt đầu."));

            var success = await _meetingRepo.UpdateAsync(id, request);
            if (!success)
                return NotFound(ApiResponse.Fail("Không tìm thấy phiên họp."));

            var updated = await _meetingRepo.GetByIdAsync(id);
            return Ok(ApiResponse.Ok(updated, "Cập nhật phiên họp thành công."));
        }

        // PUT /api/phonghopkhonggiayto/meetings/{id}/cancel
        [HttpPut("{id}/cancel")]
        public async Task<IActionResult> CancelMeeting(int id)
        {
            var success = await _meetingRepo.CancelAsync(id);
            if (!success)
                return NotFound(ApiResponse.Fail("Không tìm thấy phiên họp."));
            return Ok(ApiResponse.Ok(null, "Đã hủy phiên họp."));
        }

        // DELETE /api/phonghopkhonggiayto/meetings/{id}
        [HttpDelete("{id}")]
        [Authorize(Policy = "RequireAdminOrLanhDao")]
        public async Task<IActionResult> DeleteMeeting(int id)
        {
            var success = await _meetingRepo.DeleteAsync(id);
            if (!success)
                return NotFound(ApiResponse.Fail("Không tìm thấy phiên họp."));
            return Ok(ApiResponse.Ok(null, "Đã xóa phiên họp."));
        }
    }
}
