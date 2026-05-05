using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Data;

namespace ToolCalendar.Api.Controllers
{
    [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
    [ApiController]
    [Route("api/[controller]")]
    public class StatsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public StatsController(AppDbContext db)
        {
            _db = db;
        }

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

        [HttpGet("activities")]
        public IActionResult GetRecentActivities()
        {
            try
            {
                // Fetch the 10 most recent activities
                var (logs, _) = DatabaseService.GetAuditLogs(1, 10);
                return Ok(logs);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Lỗi lấy hoạt động: {ex.Message}" });
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

            return Ok(new
            {
                maxPagesToScan = int.Parse(maxPages),
                deadlineKeywords = keywords,
                deadlineExcludeKeywords = excludeKeywords,
                minDeadlineDays = int.Parse(minDays),
                notificationScanTime = DatabaseService.GetAppSetting("Notification_ScanTime", "08:30")
            });
        }

        [HttpPost("settings")]
        [Authorize(Roles = "Admin,VanThu")]
        public IActionResult SaveSettings([FromBody] System.Text.Json.JsonElement data)
        {
            try
            {
                string maxPages = data.GetProperty("maxPagesToScan").ToString();
                string keywords = data.GetProperty("deadlineKeywords").ToString();
                string excludeKeywords = data.TryGetProperty("deadlineExcludeKeywords", out var exc) ? exc.ToString() : "";
                string minDays = data.TryGetProperty("minDeadlineDays", out var mnd) ? mnd.ToString() : "0";
                string scanTime = data.TryGetProperty("notificationScanTime", out var st) ? st.ToString() : "08:30";

                DatabaseService.SaveAppSetting("OcrSettings_MaxPagesToScan", maxPages);
                DatabaseService.SaveAppSetting("Document_DeadlineKeywords", keywords);
                DatabaseService.SaveAppSetting("Document_DeadlineExcludeKeywords", excludeKeywords);
                DatabaseService.SaveAppSetting("Document_MinDeadlineDays", minDays);
                DatabaseService.SaveAppSetting("Notification_ScanTime", scanTime);

                // Reset chặn quét để cho phép quét lại vào giờ mới ngay trong ngày hôm nay
                DatabaseService.SaveAppSetting("Notification_LastScanDate", "");

                return Ok();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
