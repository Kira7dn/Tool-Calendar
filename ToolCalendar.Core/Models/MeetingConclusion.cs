namespace ToolCalendar.Models
{
    /// <summary>Kết luận sau phiên họp</summary>
    public class MeetingConclusion
    {
        public int Id { get; set; }
        public int MeetingId { get; set; }
        public string? MeetingTitle { get; set; }   // Join
        public string? FileName { get; set; }
        public string Status { get; set; } = "Chưa xử lý";
        public int? LastHandlerId { get; set; }
        public string? LastHandlerName { get; set; }   // Join
        public string? LastHandlerRole { get; set; }   // Join (e.g. chức vụ)
        public int Progress { get; set; }              // 0-100 %
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreateConclusionRequest
    {
        public int MeetingId { get; set; }
        public string? FileName { get; set; }
        public string Status { get; set; } = "Chưa xử lý";
        public int? LastHandlerId { get; set; }
        public int Progress { get; set; }
    }

    public class UpdateConclusionRequest
    {
        public string? Status { get; set; }
        public int? Progress { get; set; }
        public int? LastHandlerId { get; set; }
    }
}
