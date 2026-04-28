using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ToolCalendar.Data;

namespace ToolCalendar.Api.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/[controller]")]
    public class BackupController : ControllerBase
    {
        [HttpGet("export")]
        public IActionResult Export()
        {
            try
            {
                byte[] csvData = DatabaseService.ExportDocumentsToCsv();
                string fileName = $"ToolCalendar_Backup_{DateTime.Now:yyyyMMdd_HHmm}.csv";
                
                return File(csvData, "text/csv", fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi xuất dữ liệu: {ex.Message}");
            }
        }
    }
}
