using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ToolCalender.Data;

namespace ToolCalender.Api.Controllers
{
    [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
    [ApiController]
    [Route("api/[controller]")]
    public class StatsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetSummary()
        {
            try
            {
                var stats = DatabaseService.GetDashboardStats();
                return Ok(stats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi thống kê dữ liệu: {ex.Message}");
            }
        }
    }
}
