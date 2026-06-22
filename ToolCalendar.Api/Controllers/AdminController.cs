using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Models;
using ToolCalendar.Data;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AdminController : ControllerBase
    {
        // --- DEPARTMENTS ---
        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("departments")]
        public IActionResult GetDepartments() => Ok(ApiResponse.Ok(DatabaseService.GetDepartments()));

        [Authorize(Roles = "Admin")]
        [HttpPost("departments")]
        public IActionResult AddDepartment([FromBody] Department dept)
        {
            if (dept == null) return BadRequest(ApiResponse.Fail("Dữ liệu phòng ban không hợp lệ."));
            int id = DatabaseService.InsertDepartment(dept);
            dept.Id = id;
            return Ok(ApiResponse.Ok(dept));
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("departments")]
        public IActionResult UpdateDepartment([FromBody] Department dept)
        {
            if (dept == null) return BadRequest(ApiResponse.Fail("Dữ liệu phòng ban không hợp lệ."));
            DatabaseService.UpdateDepartment(dept);
            return Ok(ApiResponse.Ok(dept));
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("departments/{id}")]
        public IActionResult DeleteDepartment(int id)
        {
            DatabaseService.DeleteDepartment(id);
            return Ok(ApiResponse.Ok("Xóa phòng ban thành công."));
        }

        // --- LABELS ---
        [Authorize(Roles = "Admin")]
        [HttpGet("labels")]
        public IActionResult GetLabels() => Ok(ApiResponse.Ok(DatabaseService.GetLabels()));

        [Authorize(Roles = "Admin")]
        [HttpPost("labels")]
        public IActionResult AddLabel([FromBody] DocumentLabel label)
        {
            if (label == null) return BadRequest(ApiResponse.Fail("Dữ liệu nhãn không hợp lệ."));
            int id = DatabaseService.InsertLabel(label);
            label.Id = id;
            return Ok(ApiResponse.Ok(label));
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("labels/{id}")]
        public IActionResult DeleteLabel(int id)
        {
            DatabaseService.DeleteLabel(id);
            return Ok(ApiResponse.Ok("Xóa nhãn thành công."));
        }

        // --- AUTO RULES ---
        [Authorize(Roles = "Admin")]
        [HttpGet("rules")]
        public IActionResult GetRules() => Ok(ApiResponse.Ok(DatabaseService.GetAutoRules()));

        [Authorize(Roles = "Admin")]
        [HttpPost("rules")]
        public IActionResult AddRule([FromBody] AutoRule rule)
        {
            if (rule == null) return BadRequest(ApiResponse.Fail("Dữ liệu luật không hợp lệ."));
            int id = DatabaseService.InsertAutoRule(rule);
            rule.Id = id;
            return Ok(ApiResponse.Ok(rule));
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("rules/{id}")]
        public IActionResult DeleteRule(int id)
        {
            DatabaseService.DeleteAutoRule(id);
            return Ok(ApiResponse.Ok("Xóa luật tự động thành công."));
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("audit-logs")]
        public IActionResult GetAuditLogs([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = DatabaseService.GetAuditLogs(page, pageSize);
            return Ok(ApiResponse.Ok(new { items = result.items, total = result.total }));
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("clear-audit-logs")]
        public IActionResult ClearAuditLogs()
        {
            DatabaseService.ClearAuditLogs();
            DatabaseService.InsertAuditLog(null, "Quản trị viên đã dọn sạch toàn bộ nhật ký hệ thống.");
            return Ok(ApiResponse.Ok("Đã dọn sạch nhật ký hệ thống."));
        }
    }
}
