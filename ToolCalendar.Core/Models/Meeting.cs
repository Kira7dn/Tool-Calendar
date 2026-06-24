namespace ToolCalendar.Models
{
    public class Meeting
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public int RoomId { get; set; }
        public string? RoomName { get; set; } // Join
        public string Status { get; set; } = "Sắp diễn ra"; // Sắp diễn ra, Đang diễn ra, Đã kết thúc
        public int CreatorId { get; set; }
        public string? CreatorName { get; set; } // Join
        public DateTime CreatedAt { get; set; }

        public List<MeetingParticipant> Participants { get; set; } = new();
    }

    public class MeetingParticipant
    {
        public int MeetingId { get; set; }
        public int UserId { get; set; }
        public string? UserFullName { get; set; }
        public string? DepartmentName { get; set; }
        public string AttendanceStatus { get; set; } = "Chưa xác nhận"; // Chưa xác nhận, Có tham gia, Vắng mặt
    }
}
