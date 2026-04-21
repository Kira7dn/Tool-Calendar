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
                Console.WriteLine($"[StatsError] {ex.Message}\n{ex.StackTrace}");
                return StatusCode(500, new { message = $"Lỗi thống kê dữ liệu: {ex.Message}" });
            }
        }

        [HttpGet("settings")]
        [Authorize(Roles = "Admin,VanThu")]
        public IActionResult GetSettings()
        {
            var maxPages = DatabaseService.GetAppSetting("OcrSettings_MaxPagesToScan", "0");
            var keywords = DatabaseService.GetAppSetting("Document_DeadlineKeywords", "hạn, đến ngày, trước ngày, trình, xong, xong trước, hoàn thành");
            
            return Ok(new {
                maxPagesToScan = int.Parse(maxPages),
                deadlineKeywords = keywords
            });
        }

        [HttpPost("settings")]
        [Authorize(Roles = "Admin,VanThu")]
        public IActionResult SaveSettings([FromBody] dynamic data)
        {
            try {
                string maxPages = data.GetProperty("maxPagesToScan").ToString();
                string keywords = data.GetProperty("deadlineKeywords").ToString();
                
                DatabaseService.SaveAppSetting("OcrSettings_MaxPagesToScan", maxPages);
                DatabaseService.SaveAppSetting("Document_DeadlineKeywords", keywords);
                
                return Ok();
            } catch (Exception ex) {
                return BadRequest(ex.Message);
            }
        }
    }
}
