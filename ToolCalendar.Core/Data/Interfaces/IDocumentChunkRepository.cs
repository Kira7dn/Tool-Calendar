using System.Collections.Generic;
using System.Threading.Tasks;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IDocumentChunkRepository
    {
        Task<int> AddChunkAsync(int documentId, int chunkIndex, string textContent, float[] vector, int? parentChunkId = null);
        Task DeleteChunksByDocumentIdAsync(int documentId);
        Task<List<DocumentChunkResult>> FindSimilarChunksAsync(float[] questionVector, int topK = 3, float minSimilarityScore = 0.20f);
        // DIFY Idea #2: Hybrid Search — tìm theo từ khóa chính xác (cho số hiệu công văn, ngày tháng)
        Task<List<DocumentChunkResult>> FindByKeywordAsync(string keyword, int topK = 5);
        
        // DIFY Idea #1: Weighted Hybrid Search (TF-IDF + Cosine)
        Task<List<DocumentChunkResult>> FindHybridChunksAsync(string query, float[] questionVector, int topK = 5, float minSimilarityScore = 0.20f, string? soHieu = null, string? ngayBanHanh = null);
    }

    public class DocumentChunkResult
    {
        public int DocumentId { get; set; }
        public string TextContent { get; set; } = string.Empty;
        public float SimilarityScore { get; set; }
        public int? ParentChunkId { get; set; }
    }
}
