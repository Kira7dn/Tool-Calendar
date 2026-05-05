using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
        [Authorize(Roles = "Admin,VanThu")]
        [HttpGet("departments")]
        public IActionResult GetDepartments() => Ok(DatabaseService.GetDepartments());

        [Authorize(Roles = "Admin")]
        [HttpPost("departments")]
        public IActionResult AddDepartment([FromBody] Department dept)
        {
            if (dept == null) return BadRequest();
            int id = DatabaseService.InsertDepartment(dept);
            dept.Id = id;
            return Ok(dept);
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("departments")]
        public IActionResult UpdateDepartment([FromBody] Department dept)
        {
            if (dept == null) return BadRequest();
            DatabaseService.UpdateDepartment(dept);
            return Ok(dept);
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("departments/{id}")]
        public IActionResult DeleteDepartment(int id)
        {
            DatabaseService.DeleteDepartment(id);
            return NoContent();
        }

        // --- LABELS ---
        [Authorize(Roles = "Admin")]
        [HttpGet("labels")]
        public IActionResult GetLabels() => Ok(DatabaseService.GetLabels());

        [Authorize(Roles = "Admin")]
        [HttpPost("labels")]
        public IActionResult AddLabel([FromBody] DocumentLabel label)
        {
            if (label == null) return BadRequest();
            int id = DatabaseService.InsertLabel(label);
            label.Id = id;
            return Ok(label);
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("labels/{id}")]
        public IActionResult DeleteLabel(int id)
        {
            DatabaseService.DeleteLabel(id);
            return NoContent();
        }

        // --- AUTO RULES ---
        [Authorize(Roles = "Admin")]
        [HttpGet("rules")]
        public IActionResult GetRules() => Ok(DatabaseService.GetAutoRules());

        [Authorize(Roles = "Admin")]
        [HttpPost("rules")]
        public IActionResult AddRule([FromBody] AutoRule rule)
        {
            if (rule == null) return BadRequest();
            int id = DatabaseService.InsertAutoRule(rule);
            rule.Id = id;
            return Ok(rule);
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("rules/{id}")]
        public IActionResult DeleteRule(int id)
        {
            DatabaseService.DeleteAutoRule(id);
            return NoContent();
        }

        // --- SETTINGS ---
        [Authorize(Roles = "Admin")]
        [HttpGet("settings/{key}")]
        public IActionResult GetSetting(string key)
        {
            var val = DatabaseService.GetAppSetting(key);
            return Ok(new { key, value = val });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("settings")]
        public IActionResult SaveSetting([FromBody] SettingUpdateRequest request)
        {
            if (request == null) return BadRequest();
            DatabaseService.SaveAppSetting(request.Key, request.Value);
            return Ok(new { message = "Lưu cấu hình thành công." });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("audit-logs")]
        public IActionResult GetAuditLogs([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = DatabaseService.GetAuditLogs(page, pageSize);
            return Ok(new { items = result.items, total = result.total });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("clear-audit-logs")]
        public IActionResult ClearAuditLogs()
        {
            DatabaseService.ClearAuditLogs();
            DatabaseService.InsertAuditLog(null, "Quản trị viên đã dọn sạch toàn bộ nhật ký hệ thống.");
            return Ok(new { message = "Đã dọn sạch nhật ký hệ thống." });
        }
    }

    public class SettingUpdateRequest
    {
        public string Key { get; set; } = "";
        public string Value { get; set; } = "";
    }
}
