using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
        public IActionResult GetDepartments() => Ok(ApiResponse.Ok(_adminRepo.GetDepartments()));

        [Authorize(Roles = "Admin")]
        [HttpPost("departments")]
        public IActionResult AddDepartment([FromBody] Department dept)
        {
            if (dept == null) return BadRequest(ApiResponse.Fail("Dữ liệu phòng ban không hợp lệ."));
            int id = _adminRepo.InsertDepartment(dept);
            dept.Id = id;
            return Ok(ApiResponse.Ok(dept));
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("departments")]
        public IActionResult UpdateDepartment([FromBody] Department dept)
        {
            if (dept == null) return BadRequest(ApiResponse.Fail("Dữ liệu phòng ban không hợp lệ."));
            _adminRepo.UpdateDepartment(dept);
            return Ok(ApiResponse.Ok(dept));
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("departments/{id}")]
        public IActionResult DeleteDepartment(int id)
        {
            _adminRepo.DeleteDepartment(id);
            return Ok(ApiResponse.Ok("Xóa phòng ban thành công."));
        }

        // --- LABELS ---
        [Authorize(Roles = "Admin")]
        [HttpGet("labels")]
        public IActionResult GetLabels() => Ok(ApiResponse.Ok(_adminRepo.GetLabels()));

        [Authorize(Roles = "Admin")]
        [HttpPost("labels")]
        public IActionResult AddLabel([FromBody] Label label)
        {
            if (label == null) return BadRequest(ApiResponse.Fail("Dữ liệu nhãn không hợp lệ."));
            int id = _adminRepo.InsertLabel(label);
            label.Id = id;
            return Ok(ApiResponse.Ok(label));
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("labels/{id}")]
        public IActionResult DeleteLabel(int id)
        {
            _adminRepo.DeleteLabel(id);
            return Ok(ApiResponse.Ok("Xóa nhãn thành công."));
        }

        // --- AUTO RULES ---
        [Authorize(Roles = "Admin")]
        [HttpGet("rules")]
        public IActionResult GetRules() => Ok(ApiResponse.Ok(_adminRepo.GetAutoRules()));

        [Authorize(Roles = "Admin")]
        [HttpPost("rules")]
        public IActionResult AddRule([FromBody] AutoRule rule)
        {
            if (rule == null) return BadRequest(ApiResponse.Fail("Dữ liệu luật không hợp lệ."));
            int id = _adminRepo.InsertAutoRule(rule);
            rule.Id = id;
            return Ok(ApiResponse.Ok(rule));
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("rules/{id}")]
        public IActionResult DeleteRule(int id)
        {
            _adminRepo.DeleteAutoRule(id);
            return Ok(ApiResponse.Ok("Xóa luật tự động thành công."));
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("audit-logs")]
        public IActionResult GetAuditLogs([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = _auditLogRepo.GetAuditLogs(page, pageSize);
            return Ok(ApiResponse.Ok(new { items = result.items, total = result.total }));
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("clear-audit-logs")]
        public IActionResult ClearAuditLogs()
        {
            _auditLogRepo.ClearAuditLogs();
            _auditLogRepo.InsertAuditLog(null, "Quản trị viên đã dọn sạch toàn bộ nhật ký hệ thống.");
            return Ok(ApiResponse.Ok("Đã dọn sạch nhật ký hệ thống."));
        }
    }
}
