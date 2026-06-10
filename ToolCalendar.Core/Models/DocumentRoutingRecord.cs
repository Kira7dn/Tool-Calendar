using System.Text.Json.Serialization;

namespace ToolCalendar.Models
{
    public class DocumentRoutingRecord
    {
        public int Id { get; set; }
        public int DocumentId { get; set; }
        public int SenderId { get; set; }
        public int ReceiverId { get; set; }
        public int? ParentRoutingId { get; set; }
        public string Role { get; set; } = "Chủ trì"; // Tiếp nhận, Chủ trì, Phối hợp
        public DateTime? ForwardDate { get; set; }
        public DateTime? Deadline { get; set; }
        public string Comment { get; set; } = ""; // Bút phê
        public string ProcessingContent { get; set; } = ""; // Nội dung xử lý
        public string Status { get; set; } = "Chưa xử lý"; // Chưa xử lý, Đã xử lý, Đã xử lý quá hạn, Đang giải quyết
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // --- Navigation / DTO fields (Not mapped to DB directly if using raw SQL, joined in query) ---
        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public string SenderName { get; set; } = "";
        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public string ReceiverName { get; set; } = "";
        
        // Children for Tree Table
        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public List<DocumentRoutingRecord> Children { get; set; } = new List<DocumentRoutingRecord>();
    }
}
