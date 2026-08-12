using System.Collections.Generic;
using System.Threading.Tasks;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IDocumentChunkRepository
    {
        Task AddChunkAsync(int documentId, int chunkIndex, string textContent, float[] vector);
        Task DeleteChunksByDocumentIdAsync(int documentId);
        Task<List<DocumentChunkResult>> FindSimilarChunksAsync(float[] questionVector, int topK = 3);
    }

    public class DocumentChunkResult
    {
        public int DocumentId { get; set; }
        public string TextContent { get; set; } = string.Empty;
        public float SimilarityScore { get; set; }
    }
}
