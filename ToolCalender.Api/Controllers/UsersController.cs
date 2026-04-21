using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalender.Data;
using ToolCalender.Models;

namespace ToolCalender.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        [Authorize(Roles = "Admin,VanThu")]
        [HttpGet]
        public IActionResult Get([FromQuery] int? departmentId = null)
        {
            var users = DatabaseService.GetUsers();
            if (departmentId.HasValue)
            {
                users = users.Where(user => user.DepartmentId == departmentId.Value).ToList();
            }

            return Ok(users);
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public IActionResult Create([FromBody] RegisterRequest request)
        {
            if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password))
                return BadRequest("Thiếu thông tin đăng ký.");

            bool success = DatabaseService.Register(request.Username, request.Password, request.Role);
            if (success) return Ok(new { message = "Tạo người dùng thành công." });
            return BadRequest("Tên đăng nhập đã tồn tại.");
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public IActionResult Delete(int id)
        {
            DatabaseService.DeleteUser(id);
            return NoContent();
        }
    }

    public class RegisterRequest
    {
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
        public string Role { get; set; } = "CanBo";
    }
}
