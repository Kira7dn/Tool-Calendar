namespace ToolCalendar.Core.Models
{
    public class ChatRequest
    {
        public required string Message { get; set; }
        public int? DocumentId { get; set; }
    }

    public class ChatResponse
    {
        public required string Reply { get; set; }
        public bool IsSuccess { get; set; }
    }
}
