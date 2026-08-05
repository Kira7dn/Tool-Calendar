namespace ToolCalendar.Models
{
    public class Questionnaire
    {
        public int Id { get; set; }
        public int MeetingId { get; set; }
        public string? MeetingTitle { get; set; }
        public string Title { get; set; } = string.Empty;
        
        // Cũ
        public int AssignedTo { get; set; }
        public string? AssignedToName { get; set; }
        
        // Mới
        public int? TemplateId { get; set; }
        public string? Type { get; set; }
        public List<string> AttachmentPaths { get; set; } = new();
        public string? Content { get; set; }
        public List<int> AssignedUserIds { get; set; } = new();

        public DateTime Deadline { get; set; }
        public string Status { get; set; } = "Chưa trả lời"; // Chưa trả lời, Đã trả lời, Hết hạn
        public DateTime CreatedAt { get; set; }
    }

    public class CreateQuestionnaireRequest
    {
        public int MeetingId { get; set; }
        public string Title { get; set; } = string.Empty;
        public int? TemplateId { get; set; }
        public string? Type { get; set; }
        public List<string> AttachmentPaths { get; set; } = new();
        public string? Content { get; set; }
        public List<int> AssignedUserIds { get; set; } = new();
        public DateTime Deadline { get; set; }
    }
}
