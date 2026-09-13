namespace ToolCalendar.Core.Models
{
    public class NotificationRecord
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public required string Title { get; set; }
        public required string Body { get; set; }
        public required string Type { get; set; } // "deadline", "system", etc.
        public int? DocId { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
