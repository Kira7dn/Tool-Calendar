using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AdminController : ControllerBase
    {
        private readonly IAdminRepository _adminRepo;
        private readonly IAuditLogRepository _auditLogRepo;

        public AdminController(IAdminRepository adminRepo, IAuditLogRepository auditLogRepo)
        {
            _adminRepo = adminRepo;
            _auditLogRepo = auditLogRepo;
        }

        // --- DEPARTMENTS ---
        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("departments")]
        public async Task<IActionResult> GetDepartments() => Ok(ApiResponse.Ok(await _adminRepo.GetDepartmentsAsync()));

        [Authorize(Roles = "Admin")]
        [HttpPost("departments")]
        public async Task<IActionResult> AddDepartment([FromBody] Department dept)
        {
            if (dept == null) return BadRequest(ApiResponse.Fail("Dữ liệu phòng ban không hợp lệ."));
            int id = await _adminRepo.InsertDepartmentAsync(dept);
            dept.Id = id;
            return Ok(ApiResponse.Ok(dept));
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("departments")]
        public async Task<IActionResult> UpdateDepartment([FromBody] Department dept)
        {
            if (dept == null) return BadRequest(ApiResponse.Fail("Dữ liệu phòng ban không hợp lệ."));
            await _adminRepo.UpdateDepartmentAsync(dept);
            return Ok(ApiResponse.Ok(dept));
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("departments/{id}")]
        public async Task<IActionResult> DeleteDepartment(int id)
        {
            await _adminRepo.DeleteDepartmentAsync(id);
            return Ok(ApiResponse.Ok("Xóa phòng ban thành công."));
        }

        // --- LABELS ---
        [Authorize(Roles = "Admin")]
        [HttpGet("labels")]
        public async Task<IActionResult> GetLabels() => Ok(ApiResponse.Ok(await _adminRepo.GetLabelsAsync()));

        [Authorize(Roles = "Admin")]
        [HttpPost("labels")]
        public async Task<IActionResult> AddLabel([FromBody] DocumentLabel label)
        {
            if (label == null) return BadRequest(ApiResponse.Fail("Dữ liệu nhãn không hợp lệ."));
            int id = await _adminRepo.InsertLabelAsync(label);
            label.Id = id;
            return Ok(ApiResponse.Ok(label));
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("labels/{id}")]
        public async Task<IActionResult> DeleteLabel(int id)
        {
            await _adminRepo.DeleteLabelAsync(id);
            return Ok(ApiResponse.Ok("Xóa nhãn thành công."));
        }

        // --- AUTO RULES ---
        [Authorize(Roles = "Admin")]
        [HttpGet("rules")]
        public async Task<IActionResult> GetRules() => Ok(ApiResponse.Ok(await _adminRepo.GetAutoRulesAsync()));

        [Authorize(Roles = "Admin")]
        [HttpPost("rules")]
        public async Task<IActionResult> AddRule([FromBody] AutoRule rule)
        {
            if (rule == null) return BadRequest(ApiResponse.Fail("Dữ liệu luật không hợp lệ."));
            int id = await _adminRepo.InsertAutoRuleAsync(rule);
            rule.Id = id;
            return Ok(ApiResponse.Ok(rule));
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("rules/{id}")]
        public async Task<IActionResult> DeleteRule(int id)
        {
            await _adminRepo.DeleteAutoRuleAsync(id);
            return Ok(ApiResponse.Ok("Xóa luật tự động thành công."));
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("audit-logs")]
        public async Task<IActionResult> GetAuditLogs([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _auditLogRepo.GetAuditLogsAsync(page, pageSize);
            return Ok(ApiResponse.Ok(new { items = result.items, total = result.total }));
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("clear-audit-logs")]
        public async Task<IActionResult> ClearAuditLogs()
        {
            await _auditLogRepo.ClearAuditLogsAsync();
            await _auditLogRepo.InsertAuditLogAsync(null, "Quản trị viên đã dọn sạch toàn bộ nhật ký hệ thống.");
            return Ok(ApiResponse.Ok("Đã dọn sạch nhật ký hệ thống."));
        }
    }
}
