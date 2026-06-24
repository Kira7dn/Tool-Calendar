namespace ToolCalendar.Models
{
    public class Questionnaire
    {
        public int Id { get; set; }
        public int MeetingId { get; set; }
        public string? MeetingTitle { get; set; }
        public string Title { get; set; } = string.Empty;
        public int AssignedTo { get; set; }
        public string? AssignedToName { get; set; }
        public DateTime Deadline { get; set; }
        public string Status { get; set; } = "Chưa trả lời"; // Chưa trả lời, Đã trả lời, Hết hạn
        public DateTime CreatedAt { get; set; }
    }
}
