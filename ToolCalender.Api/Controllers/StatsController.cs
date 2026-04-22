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
            var excludeKeywords = DatabaseService.GetAppSetting("Document_DeadlineExcludeKeywords", "vào khoảng, phát hiện, sinh năm, xảy ra, tại bãi, vào ngày, ngày xảy, được phát hiện, lúc khoảng");
            var minDays = DatabaseService.GetAppSetting("Document_MinDeadlineDays", "0");
            var statusList = DatabaseService.GetAppSetting("Document_StatusList", "Chưa xử lý,Đang xử lý,Đã rà soát,Đã hoàn thành,Lỗi OCR,Quá hạn");

            return Ok(new {
                maxPagesToScan = int.Parse(maxPages),
                deadlineKeywords = keywords,
                deadlineExcludeKeywords = excludeKeywords,
                minDeadlineDays = int.Parse(minDays),
                statusList = statusList.Split(',').Select(s => s.Trim()).Where(s => !string.IsNullOrEmpty(s)).ToList()
            });
        }

        [HttpPost("settings")]
        [Authorize(Roles = "Admin,VanThu")]
        public IActionResult SaveSettings([FromBody] System.Text.Json.JsonElement data)
        {
            try {
                string maxPages = data.GetProperty("maxPagesToScan").ToString();
                string keywords = data.GetProperty("deadlineKeywords").ToString();
                string excludeKeywords = data.TryGetProperty("deadlineExcludeKeywords", out var exc) ? exc.ToString() : "";
                string minDays = data.TryGetProperty("minDeadlineDays", out var mnd) ? mnd.ToString() : "0";
                string statusList = data.TryGetProperty("statusList", out var sl) ? sl.ToString() : "";

                DatabaseService.SaveAppSetting("OcrSettings_MaxPagesToScan", maxPages);
                DatabaseService.SaveAppSetting("Document_DeadlineKeywords", keywords);
                DatabaseService.SaveAppSetting("Document_DeadlineExcludeKeywords", excludeKeywords);
                DatabaseService.SaveAppSetting("Document_MinDeadlineDays", minDays);
                if (!string.IsNullOrWhiteSpace(statusList))
                    DatabaseService.SaveAppSetting("Document_StatusList", statusList);

                return Ok();
            } catch (Exception ex) {
                return BadRequest(ex.Message);
            }
        }
    }
}
