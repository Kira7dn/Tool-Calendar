using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Hubs;

namespace ToolCalendar.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly IUserRepository _userRepository;

        public AuthController(IConfiguration configuration, IHubContext<NotificationHub> hubContext, IUserRepository userRepository)
        {
            _configuration = configuration;
            _hubContext = hubContext;
            _userRepository = userRepository;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = _userRepository.Login(request.Username, request.Password);

            if (user == null)
                return Unauthorized(new { message = "Tài khoản hoặc mật khẩu không chính xác." });

            // Kick tất cả phiên cũ của user này ngay lập tức (real-time SignalR)
            await _hubContext.Clients.Group($"User_{user.Id}").SendAsync("Kicked", "Tài khoản đã đăng nhập từ thiết bị khác.");

            var tokenHandler = new JwtSecurityTokenHandler();
            var jwtSecret = _configuration["JWT_SECRET"] 
                            ?? Environment.GetEnvironmentVariable("JWT_SECRET") 
                            ?? "LinkStrategy_Default_Development_Key_2026_DO_NOT_USE_IN_PROD";
            var key = Encoding.ASCII.GetBytes(jwtSecret);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.Name, user.Username),
                    new Claim(ClaimTypes.Role, user.Role),
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim("uid", user.Id.ToString()),
                    new Claim("UserId", user.Id.ToString()), // Claim "UserId" (cho tương thích ngược/client cũ)
                    new Claim("sid", user.SessionId ?? "")
                }),
                Expires = DateTime.UtcNow.AddHours(24),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            return Ok(new
            {
                token = tokenString,
                username = user.Username,
                role = user.Role,
                userId = user.Id
            });
        }

        [HttpPost("change-password")]
        [Authorize]
        public IActionResult ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

            if (string.IsNullOrWhiteSpace(request.NewPassword))
                return BadRequest(new { message = "Mật khẩu mới không được để trống." });
            if (request.NewPassword.Length < 8)
                return BadRequest(new { message = "Mật khẩu phải có ít nhất 8 ký tự." });
            if (!request.NewPassword.Any(char.IsUpper))
                return BadRequest(new { message = "Mật khẩu phải có ít nhất 1 chữ HOA (A-Z)." });
            if (!request.NewPassword.Any(char.IsLower))
                return BadRequest(new { message = "Mật khẩu phải có ít nhất 1 chữ thường (a-z)." });
            if (!request.NewPassword.Any(char.IsDigit))
                return BadRequest(new { message = "Mật khẩu phải có ít nhất 1 chữ số (0-9)." });
            if (!request.NewPassword.Any(c => "!@#$%^&*()_+-=[]{}|;':\",./<>?".Contains(c)))
                return BadRequest(new { message = "Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%...)." });

            var success = _userRepository.UpdateUserPassword(userId, request.NewPassword);
            if (success) return Ok(new { message = "Đổi mật khẩu thành công." });
            return BadRequest(new { message = "Không thể đổi mật khẩu." });
        }
    }

    public class LoginRequest
    {
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
    }

    public class ChangePasswordRequest
    {
        public string NewPassword { get; set; } = "";
    }
}
