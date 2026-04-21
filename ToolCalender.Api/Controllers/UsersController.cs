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

        [Authorize(Roles = "Admin,VanThu")]
        [HttpGet("{id}")]
        public IActionResult GetById(int id)
        {
            var user = DatabaseService.GetUserById(id);
            if (user == null) return NotFound();
            return Ok(user);
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public IActionResult Create([FromBody] User user)
        {
            if (string.IsNullOrEmpty(user.Username) || string.IsNullOrEmpty(user.PasswordHash))
                return BadRequest("Thiếu thông tin đăng nhập.");

            bool success = DatabaseService.CreateUser(user);
            if (success) return Ok(new { message = "Tạo người dùng thành công." });
            return BadRequest("Tên đăng nhập đã tồn tại hoặc dữ liệu không hợp lệ.");
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public IActionResult Update(int id, [FromBody] UserUpdateRequest request)
        {
            var user = DatabaseService.GetUserById(id);
            if (user == null) return NotFound();

            user.FullName = request.FullName;
            user.Email = request.Email;
            user.PhoneNumber = request.PhoneNumber;
            user.Role = request.Role;
            user.DepartmentId = request.DepartmentId;

            DatabaseService.UpdateUser(user);
            return Ok(new { message = "Cập nhật người dùng thành công." });
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

    public class UserUpdateRequest
    {
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string PhoneNumber { get; set; } = "";
        public string Role { get; set; } = "CanBo";
        public int? DepartmentId { get; set; }
    }
}
