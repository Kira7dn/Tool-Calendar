namespace ToolCalendar.Models
{
    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; } = "";
        public string PasswordHash { get; set; } = "";
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string PhoneNumber { get; set; } = "";
        public string Role { get; set; } = "Guest"; // Admin, LanhDao, VanThu, CanBo
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public string? SessionId { get; set; }

        // --- Account Lockout ---
        public int FailedLoginCount { get; set; } = 0;
        public DateTime? LockoutUntil { get; set; } // null = không bị khóa
    }

    public class LoginAuditLog
    {
        public int Id { get; set; }
        public string Username { get; set; } = "";
        public int? UserId { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public bool IsSuccess { get; set; }
        public string? FailReason { get; set; } // 'wrong_password' | 'account_locked'
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    public class Comment
    {
        public int Id { get; set; }
        public int DocumentId { get; set; }
        public int UserId { get; set; }
        public string Username { get; set; } = ""; // Để hiển thị tên người chat
        public string Content { get; set; } = "";
        public string? AttachmentPaths { get; set; } // JSON list of file paths
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    public class CommentReaction
    {
        public int Id { get; set; }
        public int CommentId { get; set; }
        public int UserId { get; set; }
        public string Username { get; set; } = "";
        public string ReactionType { get; set; } = ""; // like, love, hate, dislike
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
