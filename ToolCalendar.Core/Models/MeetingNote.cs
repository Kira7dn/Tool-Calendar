namespace ToolCalendar.Models
{
    /// <summary>Ghi chú sổ tay của user gắn với một phiên họp</summary>
    public class MeetingNote
    {
        public int Id { get; set; }
        public int MeetingId { get; set; }
        public string? MeetingTitle { get; set; }   // Join
        public DateTime? MeetingStartTime { get; set; }  // Join
        public int UserId { get; set; }
        public string? UserFullName { get; set; }   // Join
        public string? Content { get; set; }
        /// <summary>JSON array of file paths, e.g. ["uploads/notes/file1.pdf"]</summary>
        public string AttachmentPaths { get; set; } = "[]";
        public DateTime CreatedAt { get; set; }
    }

    public class CreateNoteRequest
    {
        public int MeetingId { get; set; }
        public string? Content { get; set; }
        /// <summary>List of uploaded file paths (set by controller after upload)</summary>
        public List<string> AttachmentPaths { get; set; } = new();
    }
}
