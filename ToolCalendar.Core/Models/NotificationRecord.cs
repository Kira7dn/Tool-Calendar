using System;

namespace ToolCalendar.Core.Models
{
    public class NotificationRecord
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Title { get; set; }
        public string Body { get; set; }
        public string Type { get; set; } // "deadline", "system", etc.
        public int? DocId { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
