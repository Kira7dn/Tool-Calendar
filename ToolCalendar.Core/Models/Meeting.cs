namespace ToolCalendar.Models
{
    public class Meeting
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public int? RoomId { get; set; }
        public string? RoomName { get; set; } // Join
        public string Status { get; set; } = "Sắp diễn ra"; // Sắp diễn ra, Đang diễn ra, Hoàn thành, Hủy
        public int CreatorId { get; set; }
        public string? CreatorName { get; set; } // Join
        public DateTime CreatedAt { get; set; }

        // Thông tin nội dung cuộc họp
        public string? Location { get; set; }         // Địa điểm chi tiết (VD: Phòng họp tầng 4, Trụ sở HĐND - UBND phường)
        public string? Presider { get; set; }          // Người chủ trì (VD: Đ/c Nguyễn Đức Dương - Phó Chủ tịch UBND)
        public string? PreparingUnit { get; set; }     // Đơn vị chuẩn bị tài liệu (VD: Phòng VH-XH)
        public string? Content { get; set; }           // Nội dung/chương trình họp
        public string? Notes { get; set; }             // Ghi chú thêm
        public string? OrganizingUnit { get; set; }    // Đơn vị tổ chức
        public int ExpectedAttendees { get; set; }     // Số lượng đại biểu dự kiến
        public string? ExternalParticipants { get; set; } // Khách mời ngoài cơ quan
        
        public string? MeetingType { get; set; } // Loại phiên họp
        public string? OnlineMeetingUrl { get; set; } // Link họp trực tuyến
        public string? ProgramFilePaths { get; set; } // JSON array of paths
        public string? InvitationFilePaths { get; set; } // JSON array of paths

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

    // Request DTO để tạo/cập nhật phiên họp
    public class CreateMeetingRequest
    {
        public string Title { get; set; } = string.Empty;
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public int? RoomId { get; set; }
        public string? Location { get; set; }
        public string? Presider { get; set; }
        public string? PreparingUnit { get; set; }
        public string? Content { get; set; }
        public string? Notes { get; set; }
        public string? OrganizingUnit { get; set; }
        public int ExpectedAttendees { get; set; }
        public string? ExternalParticipants { get; set; }
        public List<int> ParticipantUserIds { get; set; } = new();

        public int? ProceedingId { get; set; }
        public string? MeetingType { get; set; }
        public string? OnlineMeetingUrl { get; set; }
        // The files will be sent via multipart/form-data, but we keep properties in case they are sent as JSON
        public List<string> ProgramFilePaths { get; set; } = new();
        public List<string> InvitationFilePaths { get; set; } = new();
    }
}
