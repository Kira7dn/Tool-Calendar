using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IUserRepository
    {
        List<User> GetUsers();
        User? GetUserById(int id);
        User? GetUserByUsername(string username);
        User? Login(string username, string password);
        bool CreateUser(User user);
        void UpdateUser(User user);
        void DeleteUser(int id);
        bool Register(string username, string password, string role = "Guest");
        bool UpdateUserPassword(int userId, string newPassword);

        // --- ASP.NET Core Identity support ---
        // Cập nhật SecurityStamp — được gọi khi đổi mật khẩu, đổi role, hoặc bị kick
        void UpdateSecurityStamp(int userId, string securityStamp);
        // Cập nhật số lần đăng nhập sai và thời gian lockout (Identity format)
        void UpdateLockout(int userId, int accessFailedCount, DateTimeOffset? lockoutEnd);
        // Reset bộ đếm sai sau khi đăng nhập thành công
        void ResetAccessFailedCount(int userId);
    }
}
