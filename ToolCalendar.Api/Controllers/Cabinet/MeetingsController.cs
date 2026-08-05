using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Data.Repositories;
using System.Text.Json;
using System.IO;
using Microsoft.AspNetCore.Http;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;
using Microsoft.AspNetCore.SignalR;
using ToolCalendar.Hubs;

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
        private readonly IHubContext<NotificationHub> _hubContext;

        public MeetingsController(IMeetingRepository meetingRepo, IRoomRepository roomRepo, IHubContext<NotificationHub> hubContext)
        {
            _meetingRepo = meetingRepo;
            _roomRepo = roomRepo;
            _hubContext = hubContext;
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
        public async Task<IActionResult> CreateMeeting([FromForm] string requestJson, [FromForm] List<IFormFile>? programFiles, [FromForm] List<IFormFile>? invitationFiles)
        {
            CreateMeetingRequest? request;
            try
            {
                request = JsonSerializer.Deserialize<CreateMeetingRequest>(requestJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (request == null) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ."));
            }
            catch
            {
                return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ."));
            }

            if (string.IsNullOrWhiteSpace(request.Title))
                return BadRequest(ApiResponse.Fail("Tên phiên họp không được để trống."));

            if (request.EndTime <= request.StartTime)
                return BadRequest(ApiResponse.Fail("Thời gian kết thúc phải sau thời gian bắt đầu."));

            if (request.RoomId.HasValue)
            {
                var room = await _roomRepo.GetByIdAsync(request.RoomId.Value);
                if (room == null)
                    return BadRequest(ApiResponse.Fail("Phòng họp không tồn tại."));
                if (room.Status == 0)
                    return BadRequest(ApiResponse.Fail("Phòng họp đang không hoạt động."));
            }
            else
            {
                if (string.IsNullOrWhiteSpace(request.Location))
                    return BadRequest(ApiResponse.Fail("Vui lòng nhập tên/địa điểm phòng họp khác."));
            }

            var newProgramFiles = await HandleFileUploads(programFiles);
            if (newProgramFiles.Count > 0)
            {
                request.ProgramFilePaths ??= new List<string>();
                request.ProgramFilePaths.AddRange(newProgramFiles);
            }

            var newInvitationFiles = await HandleFileUploads(invitationFiles);
            if (newInvitationFiles.Count > 0)
            {
                request.InvitationFilePaths ??= new List<string>();
                request.InvitationFilePaths.AddRange(newInvitationFiles);
            }

            var creatorId = GetCurrentUserId();
            var newId = await _meetingRepo.CreateAsync(request, creatorId);
            var created = await _meetingRepo.GetByIdAsync(newId);

            await _hubContext.Clients.All.SendAsync("MeetingUpdated");

            return Ok(ApiResponse.Ok(created, "Tạo phiên họp thành công."));
        }

        // PUT /api/phonghopkhonggiayto/meetings/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateMeeting(int id, [FromForm] string requestJson, [FromForm] List<IFormFile>? programFiles, [FromForm] List<IFormFile>? invitationFiles)
        {
            CreateMeetingRequest? request;
            try
            {
                request = JsonSerializer.Deserialize<CreateMeetingRequest>(requestJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (request == null) return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ."));
            }
            catch
            {
                return BadRequest(ApiResponse.Fail("Dữ liệu không hợp lệ."));
            }

            if (string.IsNullOrWhiteSpace(request.Title))
                return BadRequest(ApiResponse.Fail("Tên phiên họp không được để trống."));

            if (request.EndTime <= request.StartTime)
                return BadRequest(ApiResponse.Fail("Thời gian kết thúc phải sau thời gian bắt đầu."));

            var newProgramFiles = await HandleFileUploads(programFiles);
            if (newProgramFiles.Count > 0)
            {
                request.ProgramFilePaths ??= new List<string>();
                request.ProgramFilePaths.AddRange(newProgramFiles);
            }

            var newInvitationFiles = await HandleFileUploads(invitationFiles);
            if (newInvitationFiles.Count > 0)
            {
                request.InvitationFilePaths ??= new List<string>();
                request.InvitationFilePaths.AddRange(newInvitationFiles);
            }

            var success = await _meetingRepo.UpdateAsync(id, request);
            if (!success)
                return NotFound(ApiResponse.Fail("Không tìm thấy phiên họp."));

            var updated = await _meetingRepo.GetByIdAsync(id);
            await _hubContext.Clients.All.SendAsync("MeetingUpdated");
            
            return Ok(ApiResponse.Ok(updated, "Cập nhật phiên họp thành công."));
        }

        private async Task<List<string>> HandleFileUploads(List<IFormFile>? files)
        {
            var savedPaths = new List<string>();
            if (files != null && files.Count > 0)
            {
                var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Cabinet", "Meetings");
                Directory.CreateDirectory(uploadDir);

                foreach (var file in files)
                {
                    if (file.Length > 0)
                    {
                        var safeFileName = $"{Guid.NewGuid():N}_{Path.GetFileName(file.FileName)}";
                        var filePath = Path.Combine(uploadDir, safeFileName);
                        using var stream = new FileStream(filePath, FileMode.Create);
                        await file.CopyToAsync(stream);
                        savedPaths.Add($"Uploads/Cabinet/Meetings/{safeFileName}");
                    }
                }
            }
            return savedPaths;
        }

        // PUT /api/phonghopkhonggiayto/meetings/{id}/cancel
        [HttpPut("{id}/cancel")]
        public async Task<IActionResult> CancelMeeting(int id)
        {
            var success = await _meetingRepo.CancelAsync(id);
            if (!success)
                return NotFound(ApiResponse.Fail("Không tìm thấy phiên họp."));
                
            await _hubContext.Clients.All.SendAsync("MeetingUpdated");
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
                
            await _hubContext.Clients.All.SendAsync("MeetingUpdated");
            return Ok(ApiResponse.Ok(null, "Đã xóa phiên họp."));
        }
    }
}
