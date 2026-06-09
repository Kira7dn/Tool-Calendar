using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using ToolCalendar.Data;

namespace ToolCalendar.Api.Controllers
{
    [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
    [ApiController]
    [Route("api/[controller]")]
    public class StatsController : ControllerBase
    {
        private readonly IMemoryCache _cache;

        // Cache keys
        private const string STATS_KEY    = "dashboard_stats";
        private const string TIMELINE_KEY = "dashboard_timeline_{0}"; // {0} = days

        public StatsController(IMemoryCache cache)
        {
            _cache = cache;
        }

        [HttpGet]
        public IActionResult GetSummary()
        {
            try
            {
                // ✅ Cache 30 giây — đủ fresh cho dashboard, tránh 8 DB queries mỗi refresh
                if (!_cache.TryGetValue(STATS_KEY, out object? stats))
                {
                    stats = DatabaseService.GetDashboardStats();
                    _cache.Set(STATS_KEY, stats, new MemoryCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30),
                        SlidingExpiration = TimeSpan.FromSeconds(20)
                    });
                }
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
                var (logs, _) = DatabaseService.GetAuditLogs(1, 10, "CanBo");
                return Ok(logs);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Lỗi lấy hoạt động: {ex.Message}" });
            }
        }

        [HttpGet("deadline-series")]
        public IActionResult GetDeadlineSeries([FromQuery] int days = 14)
        {
            try
            {
                // ✅ Cache 60 giây — biểu đồ timeline thay đổi ít hơn stats
                string cacheKey = string.Format(TIMELINE_KEY, days);
                if (!_cache.TryGetValue(cacheKey, out object? series))
                {
                    series = DatabaseService.GetDashboardDeadlineSeries(days);
                    _cache.Set(cacheKey, series, new MemoryCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(60),
                        SlidingExpiration = TimeSpan.FromSeconds(40)
                    });
                }
                return Ok(series);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Lỗi lấy biểu đồ thời hạn: {ex.Message}" });
            }
        }

        /// <summary>
        /// Invalidate dashboard cache — gọi sau khi upload/cập nhật/xóa văn bản
        /// </summary>
        [HttpPost("invalidate-cache")]
        public IActionResult InvalidateCache()
        {
            _cache.Remove(STATS_KEY);
            // Xóa cache timeline cho các giá trị days phổ biến
            foreach (var d in new[] { 7, 14, 30 })
                _cache.Remove(string.Format(TIMELINE_KEY, d));
            return Ok(new { message = "Cache cleared" });
        }

        [HttpGet("monthly-report")]
        public IActionResult GetMonthlyReport([FromQuery] int month, [FromQuery] int year)
        {
            try
            {
                var data = DatabaseService.GetMonthlyDepartmentReport(month, year);
                return Ok(data);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Lỗi lấy báo cáo tháng: {ex.Message}" });
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
