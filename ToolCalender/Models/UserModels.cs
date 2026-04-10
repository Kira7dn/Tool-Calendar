using System;

namespace ToolCalender.Models
{
    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; } = "";
        public string PasswordHash { get; set; } = "";
        public string Role { get; set; } = "Guest"; // Admin hoặc Guest
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    public class Comment
    {
        public int Id { get; set; }
        public int DocumentId { get; set; }
        public int UserId { get; set; }
        public string Username { get; set; } = ""; // Để hiển thị tên người chat
        public string Content { get; set; } = "";
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
