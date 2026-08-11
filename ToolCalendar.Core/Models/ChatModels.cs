namespace ToolCalendar.Core.Models
{
    public class ChatRequest
    {
        public string Message { get; set; }
    }

    public class ChatResponse
    {
        public string Reply { get; set; }
        public bool IsSuccess { get; set; }
    }
}
