using System.Collections.Generic;
using System.Threading.Tasks;

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
        Task<List<ChatMessageDto>> GetHistoryByUserIdAsync(int userId, int limit = 20);
        Task AddMessageAsync(int userId, string role, string content);
        Task ClearHistoryAsync(int userId);
    }
}
