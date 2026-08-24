namespace ToolCalendar.Core.Models
{
    public class Reminder
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Content { get; set; }
        public string RemindAt { get; set; }
        public int IsSent { get; set; }
        public string CreatedAt { get; set; }
    }
}
