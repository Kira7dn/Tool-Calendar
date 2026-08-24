namespace ToolCalendar.Models
{
    public class Room
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; } // Dùng khi join
        public int Status { get; set; } // 1: Hoạt động, 0: Không hoạt động
        public DateTime CreatedAt { get; set; }
    }
}
