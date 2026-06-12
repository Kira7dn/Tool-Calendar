using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly IUserRepository _userRepository;
        private readonly UserManager<User> _userManager;

        public UsersController(IUserRepository userRepository, UserManager<User> userManager)
        {
            _userRepository = userRepository;
            _userManager    = userManager;
        }

        // ─── Quy tắc mật khẩu (chuẩn NIST 800-63B + thực tiễn) ─────────────────
        private static (bool IsValid, string ErrorMessage) ValidatePassword(string password)
        {
            if (string.IsNullOrWhiteSpace(password))
                return (false, "Mật khẩu không được để trống.");
            if (password.Length < 8)
                return (false, "Mật khẩu phải có ít nhất 8 ký tự.");
            if (password.Length > 128)
                return (false, "Mật khẩu không được vượt quá 128 ký tự.");
            if (!password.Any(char.IsUpper))
                return (false, "Mật khẩu phải có ít nhất 1 chữ HOA (A-Z).");
            if (!password.Any(char.IsLower))
                return (false, "Mật khẩu phải có ít nhất 1 chữ thường (a-z).");
            if (!password.Any(char.IsDigit))
                return (false, "Mật khẩu phải có ít nhất 1 chữ số (0-9).");
            if (!password.Any(c => "!@#$%^&*()_+-=[]{}|;':\",./<>?".Contains(c)))
                return (false, "Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%...).");

            // Danh sách mật khẩu phổ biến bị cấm
            var banned = new[] { "123456789", "12345678", "password", "Password1!", "Abcd1234!", "Admin@123" };
            if (banned.Any(b => string.Equals(b, password, StringComparison.OrdinalIgnoreCase)))
                return (false, "Mật khẩu này quá phổ biến và dễ bị tấn công. Vui lòng chọn mật khẩu khác.");

            return (true, "");
        }
        // ────────────────────────────────────────────────────────────────────────

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet]
        public IActionResult Get([FromQuery] int? departmentId = null)
        {
            var users = _userRepository.GetUsers();
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
            var user = _userRepository.GetUserById(id);
            if (user == null) return NotFound();
            return Ok(user);
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] User user)
        {
            if (string.IsNullOrWhiteSpace(user.Username))
                return BadRequest(new { message = "Tên đăng nhập không được để trống." });

            if (user.Username.Length < 4)
                return BadRequest(new { message = "Tên đăng nhập phải có ít nhất 4 ký tự." });

            // Validate mật khẩu theo tiêu chuẩn bảo mật
            var (isValid, errorMsg) = ValidatePassword(user.PasswordHash ?? "");
            if (!isValid)
                return BadRequest(new { message = errorMsg });

            // Tạo user qua UserManager → tự động hash mật khẩu + tạo SecurityStamp
            var plainPassword = user.PasswordHash; // Lưu tạm mật khẩu dạng plain-text
            user.PasswordHash = "";                // Xóa trước, UserManager sẽ hash lại

            var result = await _userManager.CreateAsync(user, plainPassword ?? "");
            if (result.Succeeded)
                return Ok(new { message = "Tạo người dùng thành công." });

            var error = result.Errors.FirstOrDefault()?.Description ?? "Tên đăng nhập đã tồn tại hoặc dữ liệu không hợp lệ.";
            return BadRequest(new { message = error });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UserUpdateRequest request)
        {
            var user = _userRepository.GetUserById(id);
            if (user == null) return NotFound();

            // Nếu có đổi mật khẩu → validate trước khi lưu
            if (!string.IsNullOrWhiteSpace(request.PasswordHash))
            {
                var (isValid, errorMsg) = ValidatePassword(request.PasswordHash);
                if (!isValid)
                    return BadRequest(new { message = errorMsg });

                // Đổi mật khẩu qua UserManager → tự động cập nhật SecurityStamp
                var identityUser = await _userManager.FindByIdAsync(id.ToString());
                if (identityUser != null)
                {
                    await _userManager.RemovePasswordAsync(identityUser);
                    await _userManager.AddPasswordAsync(identityUser, request.PasswordHash);

                    // Xóa cache để SecurityStamp mới có hiệu lực ngay
                    var cache = HttpContext.RequestServices.GetService<Microsoft.Extensions.Caching.Memory.IMemoryCache>();
                    cache?.Remove($"UserSession_{id}");
                }
                else
                {
                    // Fallback về UserRepository nếu Identity không tìm thấy
                    _userRepository.UpdateUserPassword(id, request.PasswordHash);
                }
            }

            user.FullName    = request.FullName;
            user.Email       = request.Email;
            user.PhoneNumber = request.PhoneNumber;
            user.Role        = request.Role;
            user.DepartmentId = request.DepartmentId;

            _userRepository.UpdateUser(user);
            return Ok(new { message = "Cập nhật người dùng thành công." });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public IActionResult Delete(int id)
        {
            _userRepository.DeleteUser(id);
            return NoContent();
        }
    }

    public class UserUpdateRequest
    {
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string PhoneNumber { get; set; } = "";
        public string Role { get; set; } = "CanBo";
        public int? DepartmentId { get; set; }
        public string? PasswordHash { get; set; } // Để trống nếu không đổi mật khẩu
    }
}
