using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ToolCalender.Data;
using ToolCalender.Models;

namespace ToolCalender.Api.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/[controller]")]
    public class AdminController : ControllerBase
    {
        // --- DEPARTMENTS ---
        [HttpGet("departments")]
        public IActionResult GetDepartments() => Ok(DatabaseService.GetDepartments());

        [HttpPost("departments")]
        public IActionResult AddDepartment([FromBody] Department dept)
        {
            if (dept == null) return BadRequest();
            int id = DatabaseService.InsertDepartment(dept);
            dept.Id = id;
            return Ok(dept);
        }

        [HttpDelete("departments/{id}")]
        public IActionResult DeleteDepartment(int id)
        {
            DatabaseService.DeleteDepartment(id);
            return NoContent();
        }

        // --- LABELS ---
        [HttpGet("labels")]
        public IActionResult GetLabels() => Ok(DatabaseService.GetLabels());

        [HttpPost("labels")]
        public IActionResult AddLabel([FromBody] DocumentLabel label)
        {
            if (label == null) return BadRequest();
            int id = DatabaseService.InsertLabel(label);
            label.Id = id;
            return Ok(label);
        }

        [HttpDelete("labels/{id}")]
        public IActionResult DeleteLabel(int id)
        {
            DatabaseService.DeleteLabel(id);
            return NoContent();
        }

        // --- AUTO RULES ---
        [HttpGet("rules")]
        public IActionResult GetRules() => Ok(DatabaseService.GetAutoRules());

        [HttpPost("rules")]
        public IActionResult AddRule([FromBody] AutoRule rule)
        {
            if (rule == null) return BadRequest();
            int id = DatabaseService.InsertAutoRule(rule);
            rule.Id = id;
            return Ok(rule);
        }

        [HttpDelete("rules/{id}")]
        public IActionResult DeleteRule(int id)
        {
            DatabaseService.DeleteAutoRule(id);
            return NoContent();
        }

        // --- SETTINGS ---
        [HttpGet("settings/{key}")]
        public IActionResult GetSetting(string key) 
        {
            var val = DatabaseService.GetAppSetting(key);
            return Ok(new { key, value = val });
        }

        [HttpPost("settings")]
        public IActionResult SaveSetting([FromBody] SettingUpdateRequest request)
        {
            if (request == null) return BadRequest();
            DatabaseService.SaveAppSetting(request.Key, request.Value);
            return Ok(new { message = "Lưu cấu hình thành công." });
        }
    }

    public class SettingUpdateRequest
    {
        public string Key { get; set; } = "";
        public string Value { get; set; } = "";
    }
}
