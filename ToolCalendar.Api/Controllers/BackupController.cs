using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Core.Models;

namespace ToolCalendar.Api.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/[controller]")]
    public class BackupController : ControllerBase
    {
        private readonly IDocumentRepository _documentRepository;

        public BackupController(IDocumentRepository documentRepository)
        {
            _documentRepository = documentRepository;
        }

        [HttpGet("export")]
        public async Task<IActionResult> Export()
        {
            try
            {
                byte[] csvData = await _documentRepository.ExportDocumentsToCsvAsync();
                string fileName = $"ToolCalendar_Backup_{DateTime.Now:yyyyMMdd_HHmm}.csv";

                return File(csvData, "text/csv", fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse.Fail($"Lỗi xuất dữ liệu: {ex.Message}"));
            }
        }
    }
}
