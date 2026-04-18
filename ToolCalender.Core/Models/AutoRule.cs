namespace ToolCalender.Models
{
    public class AutoRule
    {
        public int Id { get; set; }
        public string Keyword { get; set; } = "";
        public int? LabelId { get; set; }
        public int DefaultDeadlineDays { get; set; } = 15; // Mặc định 15 ngày
    }
}
