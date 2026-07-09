namespace ToolCalendar.Models
{
    /// <summary>Kỷ yếu phiên họp — nhóm các phiên họp theo chủ đề hoặc tổ chức</summary>
    public class MeetingProceeding
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int CreatorId { get; set; }
        public string? CreatorName { get; set; } // Join
        public DateTime CreatedAt { get; set; }

        /// <summary>Danh sách các phiên họp thuộc kỷ yếu này (eager load)</summary>
        public List<Meeting> Meetings { get; set; } = new();
    }

    public class CreateProceedingRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        /// <summary>Danh sách ID phiên họp gắn vào kỷ yếu</summary>
        public List<int> MeetingIds { get; set; } = new();
    }
}
