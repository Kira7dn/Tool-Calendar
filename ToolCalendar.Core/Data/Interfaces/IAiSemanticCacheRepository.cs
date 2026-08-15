using System.Threading.Tasks;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IAiSemanticCacheRepository
    {
        Task StoreCacheAsync(float[] questionVector, string response);
        Task<string?> GetCachedResponseAsync(float[] questionVector, float minSimilarityScore = 0.85f);
        Task EvictAsync(); // GPTCache: Soft evict + LRU + MaxSize
    }
}
