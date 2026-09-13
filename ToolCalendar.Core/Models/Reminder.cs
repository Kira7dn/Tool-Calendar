namespace ToolCalendar.Core.Models
{
    public class Reminder
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public required string Content { get; set; }
        public required string RemindAt { get; set; }
        public int IsSent { get; set; }
        public required string CreatedAt { get; set; }
    }
}
