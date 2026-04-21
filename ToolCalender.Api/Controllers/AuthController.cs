using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Channels;
using ToolCalender.Api.Services;
using ToolCalender.Data;
using ToolCalender.Models;

namespace ToolCalender.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly string _secretKey = "LinkStrategy_SecretKey_2026_Secure_GiamSatCongVan";
        private readonly SessionHubService _sessionHub;

        public AuthController(SessionHubService sessionHub)
        {
            _sessionHub = sessionHub;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = DatabaseService.Login(request.Username, request.Password);

            if (user == null)
                return Unauthorized(new { message = "Tài khoản hoặc mật khẩu không chính xác." });

            // Kick tất cả phiên cũ của user này ngay lập tức (real-time SSE)
            await _sessionHub.KickOldSessions(user.Id, user.SessionId ?? "");

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_secretKey);

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

        /// <summary>
        /// SSE endpoint: Client kết nối vào đây để nhận thông báo real-time.
        /// Kết nối này sẽ được giữ mở cho đến khi server gửi sự kiện hoặc client ngắt kết nối.
        /// </summary>
        [HttpGet("events")]
        [Authorize]
        public async Task StreamEvents(CancellationToken ct)
        {
            var userIdStr = User.FindFirst("uid")?.Value;
            var sessionId = User.FindFirst("sid")?.Value;

            if (!int.TryParse(userIdStr, out int userId) || string.IsNullOrEmpty(sessionId))
            {
                Response.StatusCode = 401;
                return;
            }

            Response.Headers["Content-Type"] = "text/event-stream";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["X-Accel-Buffering"] = "no"; // Tắt buffering ở Nginx

            // Gửi ping đầu tiên để xác nhận kết nối
            await Response.WriteAsync("event: connected\ndata: ok\n\n", ct);
            await Response.Body.FlushAsync(ct);

            var channel = _sessionHub.Register(userId, sessionId);

            try
            {
                await foreach (var message in channel.ReadAllAsync(ct))
                {
                    await Response.WriteAsync(message, ct);
                    await Response.Body.FlushAsync(ct);
                }
            }
            catch (OperationCanceledException)
            {
                // Client ngắt kết nối - bình thường
            }
            finally
            {
                _sessionHub.Unregister(channel);
            }
        }
    }

    public class LoginRequest
    {
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
    }
}
