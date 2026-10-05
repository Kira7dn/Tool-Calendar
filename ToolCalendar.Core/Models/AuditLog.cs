namespace ToolCalendar.Models
{
    public class AuditLog
    {
        public int Id { get; set; }
        public int? UserId { get; set; }
        public string? UserFullName { get; set; }
        public string Action { get; set; } = "";
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public bool IsSuccess { get; set; } = true;
        public string? FailReason { get; set; }
    }
}
