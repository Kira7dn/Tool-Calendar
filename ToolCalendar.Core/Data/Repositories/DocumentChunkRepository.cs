using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Core.Data.Repositories
{
    public class DocumentChunkRepository : IDocumentChunkRepository
    {
        private readonly string _connectionString;

        // In-Memory Vector Cache
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, List<(int Id, string TextContent, float[] Vector, int? ParentChunkId)>> _vectorCache = new();
        private static bool _isCacheInitialized = false;
        private static readonly System.Threading.SemaphoreSlim _cacheLock = new(1, 1);

        private async Task EnsureCacheInitializedAsync()
        {
            if (_isCacheInitialized) return;

            await _cacheLock.WaitAsync();
            try
            {
                if (_isCacheInitialized) return;

                using var connection = new SqliteConnection(_connectionString);
                await connection.OpenAsync();
                using var cmd = connection.CreateCommand();
                cmd.CommandText = "SELECT DocumentId, Id, TextContent, VectorJson, ParentChunkId FROM DocumentChunks";

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var documentId = reader.GetInt32(0);
                    var id = reader.GetInt32(1);
                    var textContent = reader.GetString(2);
                    var vectorJson = reader.GetString(3);
                    var parentChunkId = reader.IsDBNull(4) ? (int?)null : reader.GetInt32(4);
                    var vector = JsonSerializer.Deserialize<float[]>(vectorJson);

                    if (vector != null)
                    {
                        _vectorCache.AddOrUpdate(
                            documentId,
                            _ => new List<(int, string, float[], int?)> { (id, textContent, vector, parentChunkId) },
                            (_, list) => { list.Add((id, textContent, vector, parentChunkId)); return list; }
                        );
                    }
                }

                _isCacheInitialized = true;
            }
            finally
            {
                _cacheLock.Release();
            }
        }

        public DocumentChunkRepository(IConfiguration configuration)
        {
            var dbPath = Environment.GetEnvironmentVariable("DB_PATH");
            if (!string.IsNullOrEmpty(dbPath))
            {
                _connectionString = $"Data Source={dbPath}";
            }
            else
            {
                _connectionString = configuration.GetConnectionString("DefaultConnection") 
                                    ?? "Data Source=data_dump/documents.db";
                if (string.IsNullOrEmpty(_connectionString))
                {
                    _connectionString = "Data Source=data_dump/documents.db";
                }
            }
        }

        public async Task<int> AddChunkAsync(int documentId, int chunkIndex, string textContent, float[] vector, int? parentChunkId = null, string? embeddingModelVersion = null)
        {
            var vectorJson = JsonSerializer.Serialize(vector);
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO DocumentChunks (DocumentId, ChunkIndex, TextContent, VectorJson, ParentChunkId, EmbeddingModelVersion)
                VALUES (@DocumentId, @ChunkIndex, @TextContent, @VectorJson, @ParentChunkId, @EmbeddingModelVersion);
                SELECT last_insert_rowid();";
            
            cmd.Parameters.AddWithValue("@DocumentId", documentId);
            cmd.Parameters.AddWithValue("@ChunkIndex", chunkIndex);
            cmd.Parameters.AddWithValue("@TextContent", textContent);
            cmd.Parameters.AddWithValue("@VectorJson", vectorJson);
            cmd.Parameters.AddWithValue("@ParentChunkId", parentChunkId.HasValue ? (object)parentChunkId.Value : DBNull.Value);
            cmd.Parameters.AddWithValue("@EmbeddingModelVersion", (object?)embeddingModelVersion ?? DBNull.Value);

            var newIdObj = await cmd.ExecuteScalarAsync();
            int newId = Convert.ToInt32(newIdObj);

            // Cập nhật Cache
            if (_isCacheInitialized)
            {
                _vectorCache.AddOrUpdate(
                    documentId,
                    _ => new List<(int, string, float[], int?)> { (newId, textContent, vector, parentChunkId) },
                    (_, list) =>
                    {
                        var newList = new List<(int, string, float[], int?)>(list);
                        newList.Add((newId, textContent, vector, parentChunkId));
                        return newList;
                    }
                );
            }
            return newId;
        }

        public async Task DeleteChunksByDocumentIdAsync(int documentId)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = "DELETE FROM DocumentChunks WHERE DocumentId = @DocumentId";
            cmd.Parameters.AddWithValue("@DocumentId", documentId);

            await cmd.ExecuteNonQueryAsync();

            // Xoá khỏi Cache
            if (_isCacheInitialized)
            {
                _vectorCache.TryRemove(documentId, out _);
            }
        }

        public async Task<List<DocumentChunkResult>> FindSimilarChunksAsync(float[] questionVector, int topK = 3, float minSimilarityScore = 0.20f)
        {
            await EnsureCacheInitializedAsync();

            // Lọc bỏ parent-only chunks (vector zero = dummy) — chỉ search trên child chunks
            var allChunks = _vectorCache.SelectMany(kvp => kvp.Value
                .Where(v => v.ParentChunkId.HasValue) // Child chunks mới có vector thực
                .Select(v => new { DocumentId = kvp.Key, v.Id, v.TextContent, v.Vector, v.ParentChunkId }));

            // ANYTHINGLLM Idea #3: Similarity Threshold — loại bỏ chunk quá xa câu hỏi
            var candidates = allChunks.Select(chunk => new DocumentChunkResult
            {
                DocumentId = chunk.DocumentId,
                TextContent = GetEffectiveTextContent(chunk.DocumentId, chunk.TextContent, chunk.ParentChunkId),
                SimilarityScore = CosineSimilarity(questionVector, chunk.Vector),
                ParentChunkId = chunk.ParentChunkId
            })
            .Where(x => x.SimilarityScore >= minSimilarityScore)
            .OrderByDescending(x => x.SimilarityScore)
            .ToList();

            // QUIVR Idea: MMR Diversification — chọn kết quả đa dạng, tránh trùng nội dung
            return ApplyMmrDiversification(candidates, questionVector, topK, lambda: 0.6f);
        }

        public async Task<List<DocumentChunkResult>> FindByKeywordAsync(string keyword, int topK = 5)
        {
            var results = new List<DocumentChunkResult>();
            if (string.IsNullOrWhiteSpace(keyword)) return results;

            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                SELECT dc.DocumentId, dc.TextContent, dc.ParentChunkId,
                       COALESCE(parent.TextContent, dc.TextContent) as EffectiveText
                FROM DocumentChunks dc
                LEFT JOIN DocumentChunks parent ON dc.ParentChunkId = parent.Id
                WHERE dc.TextContent LIKE '%' || @Keyword || '%'
                  AND dc.ParentChunkId IS NOT NULL
                LIMIT @TopK";
            
            cmd.Parameters.AddWithValue("@Keyword", keyword);
            cmd.Parameters.AddWithValue("@TopK", topK);

            using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    results.Add(new DocumentChunkResult
                    {
                        DocumentId = reader.GetInt32(0),
                        TextContent = reader.IsDBNull(3) ? reader.GetString(1) : reader.GetString(3),
                        ParentChunkId = reader.IsDBNull(2) ? (int?)null : reader.GetInt32(2),
                        SimilarityScore = 1.0f
                    });
                }
            }

            return results;
        }

        public async Task<List<DocumentChunkResult>> FindHybridChunksAsync(string query, float[] questionVector, int topK = 5, float minSimilarityScore = 0.20f, string? soHieu = null, string? ngayBanHanh = null)
        {
            // DIFY Idea #6: Parallel Retrieval (Task.WhenAll)
            // Lấy chunks từ Keyword Search và Vector Search song song
            var keywordTask = FindByKeywordAsync(query, topK: 10);
            var vectorTask = FetchVectorChunksAsync(soHieu, ngayBanHanh); // Lấy tất cả hoặc lấy qua vector search cơ bản
            
            await Task.WhenAll(keywordTask, vectorTask);
            var keywordResults = keywordTask.Result;
            var allVectorChunks = vectorTask.Result;

            // Tính Cosine Score cho tất cả các chunk để lọc
            var cosineResults = allVectorChunks.Select(chunk => new 
            {
                chunk.DocumentId,
                chunk.TextContent,
                Vector = chunk.Vector,
                ParentChunkId = chunk.ParentChunkId,
                CosineScore = CosineSimilarity(questionVector, chunk.Vector)
            })
            .Where(x => x.CosineScore >= minSimilarityScore)
            .ToList();

            // Gộp candidates từ Keyword và Vector (đảm bảo không trùng lặp)
            var candidateDict = new Dictionary<string, (int DocId, string Text, float Cosine, float[] Vec, int? ParentId)>();
            
            foreach (var kw in keywordResults)
            {
                if (!candidateDict.ContainsKey(kw.TextContent))
                {
                    // Lấy vector tương ứng nếu có
                    var match = allVectorChunks.FirstOrDefault(v => v.TextContent == kw.TextContent);
                    float cosine = match != default ? CosineSimilarity(questionVector, match.Vector) : 0f;
                    candidateDict[kw.TextContent] = (kw.DocumentId, kw.TextContent, cosine, match.Vector ?? new float[0], kw.ParentChunkId);
                }
            }
            foreach (var vec in cosineResults)
            {
                if (!candidateDict.ContainsKey(vec.TextContent))
                {
                    candidateDict[vec.TextContent] = (vec.DocumentId, vec.TextContent, vec.CosineScore, vec.Vector, vec.ParentChunkId);
                }
            }

            var mergedCandidates = candidateDict.Values.ToList();
            if (mergedCandidates.Count == 0) return new List<DocumentChunkResult>();

            // 2. Extract Query Keywords (Simple tokenization)
            var queryKeywords = query.ToLower().Split(new[] { ' ', '.', ',', ';', ':', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries).Distinct().ToList();

            // 3. Calculate on-the-fly TF-IDF for candidates
            int totalDocuments = mergedCandidates.Count;
            var keywordIdf = new Dictionary<string, float>();
            
            foreach (var keyword in queryKeywords)
            {
                int docCountContainingKeyword = mergedCandidates.Count(d => d.Text.ToLower().Contains(keyword));
                keywordIdf[keyword] = (float)Math.Log((1.0f + totalDocuments) / (1.0f + docCountContainingKeyword)) + 1.0f;
            }

            var queryTfidf = new Dictionary<string, float>();
            foreach (var keyword in queryKeywords)
            {
                queryTfidf[keyword] = 1.0f * keywordIdf[keyword];
            }

            // 4. Calculate TF-IDF Cosine Similarity for each document against the query
            var hybridResults = new List<DocumentChunkResult>();
            foreach (var doc in mergedCandidates)
            {
                var docContentLower = doc.Text.ToLower();
                var docTfidf = new Dictionary<string, float>();
                
                foreach (var keyword in queryKeywords)
                {
                    int tf = (docContentLower.Length - docContentLower.Replace(keyword, "").Length) / keyword.Length;
                    docTfidf[keyword] = tf * keywordIdf[keyword];
                }

                float tfidfScore = CalculateTfIdfCosine(queryTfidf, docTfidf);

                // 5. Final Hybrid Score Fusion (70% Vector + 30% Keyword)
                float hybridScore = 0.7f * doc.Cosine + 0.3f * tfidfScore;

                hybridResults.Add(new DocumentChunkResult
                {
                    DocumentId = doc.DocId,
                    TextContent = GetEffectiveTextContent(doc.DocId, doc.Text, doc.ParentId),
                    SimilarityScore = hybridScore,
                    ParentChunkId = doc.ParentId
                });
            }

            // DIFY Idea #3: TopK Pipeline + QUIVR MMR Diversification
            return ApplyMmrDiversification(
                hybridResults.OrderByDescending(x => x.SimilarityScore).ToList(),
                questionVector, topK, lambda: 0.6f
            );
        }

        /// <summary>
        /// QUIVR Idea: Maximum Marginal Relevance (MMR) Diversification.
        /// Chọn kết quả có cả độ liên quan cao (so với query) lẫn sự đa dạng (nhỏ hơn cosine giữa các chunk).
        /// lambda cao → ưu tiên relevance; lambda thấp → ưu tiên diversity.
        /// </summary>
        private List<DocumentChunkResult> ApplyMmrDiversification(
            List<DocumentChunkResult> candidates,
            float[] queryVector,
            int topK,
            float lambda = 0.6f)
        {
            if (candidates.Count == 0 || topK <= 0) return candidates.Take(topK).ToList();

            var selected = new List<DocumentChunkResult>();
            var remaining = candidates.ToList();

            // Precompute simplified vectors from score for diversity calculation
            // Do lúc này ta không lưu vector sau MMR, dùng text overlap làm diversity proxy
            while (selected.Count < topK && remaining.Count > 0)
            {
                DocumentChunkResult? best = null;
                float bestScore = float.MinValue;

                foreach (var candidate in remaining)
                {
                    float relevance = candidate.SimilarityScore;

                    // Diversity: max text similarity đến các item đã chọn (Jaccard token overlap)
                    float maxSimilarityToSelected = 0f;
                    if (selected.Count > 0)
                    {
                        var candidateTokens = Tokenize(candidate.TextContent);
                        foreach (var s in selected)
                        {
                            var selectedTokens = Tokenize(s.TextContent);
                            float jaccard = JaccardSimilarity(candidateTokens, selectedTokens);
                            if (jaccard > maxSimilarityToSelected)
                                maxSimilarityToSelected = jaccard;
                        }
                    }

                    float mmrScore = lambda * relevance - (1 - lambda) * maxSimilarityToSelected;
                    if (mmrScore > bestScore)
                    {
                        bestScore = mmrScore;
                        best = candidate;
                    }
                }

                if (best == null) break;
                selected.Add(best);
                remaining.Remove(best);
            }

            return selected;
        }

        private static HashSet<string> Tokenize(string text) =>
            text.ToLower()
                .Split(new[] { ' ', '.', ',', ';', ':', '!', '?', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries)
                .ToHashSet();

        private static float JaccardSimilarity(HashSet<string> a, HashSet<string> b)
        {
            if (a.Count == 0 || b.Count == 0) return 0f;
            int intersectionCount = a.Count(x => b.Contains(x));
            int unionCount = a.Count + b.Count - intersectionCount;
            return unionCount == 0 ? 0f : (float)intersectionCount / unionCount;
        }

        private async Task<List<(int DocumentId, string TextContent, float[] Vector, int? ParentChunkId)>> FetchVectorChunksAsync(string? soHieu = null, string? ngayBanHanh = null)
        {
            await EnsureCacheInitializedAsync();

            var allowedDocIds = new HashSet<int>();
            bool hasFilter = !string.IsNullOrEmpty(soHieu) || !string.IsNullOrEmpty(ngayBanHanh);

            if (hasFilter)
            {
                using var connection = new SqliteConnection(_connectionString);
                await connection.OpenAsync();
                using var cmd = connection.CreateCommand();
                
                string whereClause = "1=1";
                if (!string.IsNullOrEmpty(soHieu))
                {
                    whereClause += " AND SoVanBan LIKE '%' || @SoHieu || '%'";
                    cmd.Parameters.AddWithValue("@SoHieu", soHieu);
                }
                if (!string.IsNullOrEmpty(ngayBanHanh))
                {
                    whereClause += " AND NgayBanHanh LIKE '%' || @NgayBanHanh || '%'";
                    cmd.Parameters.AddWithValue("@NgayBanHanh", ngayBanHanh);
                }
                cmd.CommandText = $"SELECT Id FROM Documents WHERE {whereClause}";
                
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    allowedDocIds.Add(reader.GetInt32(0));
                }
            }

            var results = new List<(int DocumentId, string TextContent, float[] Vector, int? ParentChunkId)>();
            foreach (var kvp in _vectorCache)
            {
                if (!hasFilter || allowedDocIds.Contains(kvp.Key))
                {
                    foreach (var chunk in kvp.Value)
                    {
                        results.Add((kvp.Key, chunk.TextContent, chunk.Vector, chunk.ParentChunkId));
                    }
                }
            }
            return results;
        }

        private static float CalculateTfIdfCosine(Dictionary<string, float> vec1, Dictionary<string, float> vec2)
        {
            var intersection = vec1.Keys.Intersect(vec2.Keys).ToList();
            if (intersection.Count == 0) return 0f;

            float dotProduct = intersection.Sum(k => vec1[k] * vec2[k]);
            float sum1 = vec1.Values.Sum(v => v * v);
            float sum2 = vec2.Values.Sum(v => v * v);
            
            float denominator = (float)(Math.Sqrt(sum1) * Math.Sqrt(sum2));
            return denominator == 0 ? 0 : dotProduct / denominator;
        }

        private static float CosineSimilarity(float[] vector1, float[] vector2)
        {
            if (vector1.Length != vector2.Length)
                return 0;

            float dotProduct = 0;
            float magnitude1 = 0;
            float magnitude2 = 0;

            for (int i = 0; i < vector1.Length; i++)
            {
                dotProduct += vector1[i] * vector2[i];
                magnitude1 += vector1[i] * vector1[i];
                magnitude2 += vector2[i] * vector2[i];
            }

            if (magnitude1 == 0 || magnitude2 == 0)
                return 0;

            return dotProduct / (float)(Math.Sqrt(magnitude1) * Math.Sqrt(magnitude2));
        }

        private string GetEffectiveTextContent(int docId, string childText, int? parentChunkId)
        {
            if (!parentChunkId.HasValue) return childText;
            
            if (_vectorCache.TryGetValue(docId, out var chunks))
            {
                var parent = chunks.FirstOrDefault(c => c.Id == parentChunkId.Value);
                if (parent != default && !string.IsNullOrWhiteSpace(parent.TextContent))
                {
                    return parent.TextContent;
                }
            }
            return childText; // Fallback
        }

        /// <summary>
        /// Lấy danh sách model version đang được lưu trong DocumentChunks.
        /// Dùng để phát hiện mismatch khi đổi embedding model (R-A01).
        /// Nếu trả về nhiều version hoặc version khác với model hiện tại → cần re-index.
        /// </summary>
        public async Task<List<string>> GetDistinctModelVersionsAsync()
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                SELECT DISTINCT COALESCE(EmbeddingModelVersion, 'unknown') as Version, COUNT(*) as Count
                FROM DocumentChunks
                GROUP BY EmbeddingModelVersion
                ORDER BY Count DESC";

            var result = new List<string>();
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var version = reader.GetString(0);
                var count = reader.GetInt32(1);
                result.Add($"{version} ({count} chunks)");
            }
            return result;
        }
    }
}

