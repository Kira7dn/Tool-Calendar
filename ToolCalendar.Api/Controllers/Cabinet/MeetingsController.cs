using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Data.Repositories;
using ToolCalendar.Core.Models;

namespace ToolCalendar.Api.Controllers.Cabinet
{
    [Route("api/phonghopkhonggiayto/meetings")]
    [ApiController]
    [Authorize]
    public class MeetingsController : ControllerBase
    {
        private readonly IMeetingRepository _meetingRepo;

        public MeetingsController(IMeetingRepository meetingRepo)
        {
            _meetingRepo = meetingRepo;
        }

        [HttpGet("schedule")]
        public async Task<IActionResult> GetSchedule()
        {
            var meetings = await _meetingRepo.GetAllAsync();
            return Ok(ApiResponse.Ok(meetings));
        }

        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboardStats()
        {
            // Tạm thời lấy danh sách all meetings để filter mock stats
            var allMeetings = await _meetingRepo.GetAllAsync();
            var upcoming = allMeetings.Where(m => m.Status == "Sắp diễn ra").ToList();
            var ongoing = allMeetings.Where(m => m.Status == "Đang diễn ra").ToList();

            var stats = new
            {
                UpcomingCount = upcoming.Count,
                OngoingCount = ongoing.Count,
                UpcomingMeetings = upcoming,
                OngoingMeetings = ongoing,
                Participation = new 
                {
                    Confirmed = 4, // Mock
                    Unconfirmed = 2 // Mock
                }
            };

            return Ok(ApiResponse.Ok(stats));
        }
    }
}
