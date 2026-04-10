using ToolCalender.Models;

namespace ToolCalender.Services
{
    public static class SessionService
    {
        public static User? CurrentUser { get; set; }

        public static bool IsAdmin => CurrentUser?.Role == "Admin";
        
        public static void Logout() => CurrentUser = null;
    }
}
