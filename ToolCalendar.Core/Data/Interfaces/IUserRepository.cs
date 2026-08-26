using System.Threading.Tasks;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IUserRepository
    {
                Task<List<User>> GetUsersAsync();
                Task<User?> GetUserByIdAsync(int id);
                Task<User?> GetUserByUsernameAsync(string username);
                Task<User?> LoginAsync(string username, string password);
                Task<bool> CreateUserAsync(User user);
                Task UpdateUserAsync(User user);
                Task DeleteUserAsync(int id);
                Task<bool> RegisterAsync(string username, string password, string role = "Guest");
                Task<bool> UpdateUserPasswordAsync(int userId, string newPassword);

        // --- ASP.NET Core Identity support ---
        // Cập nhật SecurityStamp — được gọi khi đổi mật khẩu, đổi role, hoặc bị kick
                Task UpdateSecurityStampAsync(int userId, string securityStamp);
        // Cập nhật số lần đăng nhập sai và thời gian lockout (Identity format)
                Task UpdateLockoutAsync(int userId, int accessFailedCount, DateTimeOffset? lockoutEnd);
        // Reset bộ đếm sai sau khi đăng nhập thành công
                Task ResetAccessFailedCountAsync(int userId);
        
        // Cập nhật Refresh Token
                Task UpdateRefreshTokenAsync(int userId, string? refreshToken, DateTime? expiryTime);
                Task<User?> GetUserByRefreshTokenAsync(string refreshToken);
    }
}
