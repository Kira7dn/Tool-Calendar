using System.Collections.Generic;
using System.Threading.Tasks;

namespace ToolCalendar.Core.Data.Interfaces
{
    // ANYTHINGLLM Idea #5: Long-Term Memory (Store/Recall)
    // AI có thể tự ghi nhớ preference, thông tin quan trọng của từng user qua các session
    public interface IUserMemoryRepository
    {
        /// <summary>Lưu một memory mới cho user (AI tự ghi khi người dùng muốn AI nhớ gì đó)</summary>
        Task StoreMemoryAsync(int userId, string content, float[]? embedding = null);

        /// <summary>Tìm kiếm memories liên quan theo embedding cosine similarity</summary>
        Task<List<UserMemoryResult>> RecallMemoriesAsync(int userId, float[] questionVector, int topK = 5, float minScore = 0.25f);

        /// <summary>Lấy tất cả memories gần nhất của user (fallback khi không có vector)</summary>
        Task<List<UserMemoryResult>> GetRecentMemoriesAsync(int userId, int limit = 10);

        /// <summary>Xóa một memory theo id</summary>
        Task DeleteMemoryAsync(int memoryId);
    }

    public class UserMemoryResult
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Content { get; set; } = string.Empty;
        public float SimilarityScore { get; set; }
        public string CreatedAt { get; set; } = string.Empty;
    }
}
