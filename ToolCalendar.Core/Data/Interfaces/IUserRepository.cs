using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IUserRepository
    {
        List<User> GetUsers();
        User? GetUserById(int id);
        User? Login(string username, string password);
        bool CreateUser(User user);
        void UpdateUser(User user);
        void DeleteUser(int id);
        bool Register(string username, string password, string role = "Guest");
        bool UpdateUserPassword(int userId, string newPassword);
    }
}
