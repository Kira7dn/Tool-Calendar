using System.Collections.Generic;

namespace ToolCalendar.Core.Data.Interfaces
{
    public class ChatMessageDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string CreatedAt { get; set; } = string.Empty;
    }

    public interface IChatHistoryRepository
    {
        List<ChatMessageDto> GetHistoryByUserId(int userId, int limit = 20);
        void AddMessage(int userId, string role, string content);
        void ClearHistory(int userId);
    }
}
