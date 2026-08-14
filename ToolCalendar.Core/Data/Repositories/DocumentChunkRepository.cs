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

        public async Task AddChunkAsync(int documentId, int chunkIndex, string textContent, float[] vector)
        {
            var vectorJson = JsonSerializer.Serialize(vector);
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO DocumentChunks (DocumentId, ChunkIndex, TextContent, VectorJson)
                VALUES (@DocumentId, @ChunkIndex, @TextContent, @VectorJson)";
            
            cmd.Parameters.AddWithValue("@DocumentId", documentId);
            cmd.Parameters.AddWithValue("@ChunkIndex", chunkIndex);
            cmd.Parameters.AddWithValue("@TextContent", textContent);
            cmd.Parameters.AddWithValue("@VectorJson", vectorJson);

            await cmd.ExecuteNonQueryAsync();
        }

        public async Task DeleteChunksByDocumentIdAsync(int documentId)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = "DELETE FROM DocumentChunks WHERE DocumentId = @DocumentId";
            cmd.Parameters.AddWithValue("@DocumentId", documentId);

            await cmd.ExecuteNonQueryAsync();
        }

        public async Task<List<DocumentChunkResult>> FindSimilarChunksAsync(float[] questionVector, int topK = 3, float minSimilarityScore = 0.20f)
        {
            var allChunks = new List<(int DocumentId, string TextContent, float[] Vector)>();

            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = "SELECT DocumentId, TextContent, VectorJson FROM DocumentChunks";

            using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var documentId = reader.GetInt32(0);
                    var textContent = reader.GetString(1);
                    var vectorJson = reader.GetString(2);
                    
                    var vector = JsonSerializer.Deserialize<float[]>(vectorJson);
                    if (vector != null)
                    {
                        allChunks.Add((documentId, textContent, vector));
                    }
                }
            }

            // Calculate cosine similarity in memory
            // ANYTHINGLLM Idea #3: Similarity Threshold — loại bỏ chunk quá xa câu hỏi
            var results = allChunks.Select(chunk => new DocumentChunkResult
            {
                DocumentId = chunk.DocumentId,
                TextContent = chunk.TextContent,
                SimilarityScore = CosineSimilarity(questionVector, chunk.Vector)
            })
            .Where(x => x.SimilarityScore >= minSimilarityScore)  // ← Threshold filter
            .OrderByDescending(x => x.SimilarityScore)
            .Take(topK)
            .ToList();

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
                CosineScore = CosineSimilarity(questionVector, chunk.Vector)
            })
            .Where(x => x.CosineScore >= minSimilarityScore)
            .ToList();

            // Gộp candidates từ Keyword và Vector (đảm bảo không trùng lặp)
            var candidateDict = new Dictionary<string, (int DocId, string Text, float Cosine, float[] Vec)>();
            
            foreach (var kw in keywordResults)
            {
                if (!candidateDict.ContainsKey(kw.TextContent))
                {
                    // Lấy vector tương ứng nếu có
                    var match = allVectorChunks.FirstOrDefault(v => v.TextContent == kw.TextContent);
                    float cosine = match != default ? CosineSimilarity(questionVector, match.Vector) : 0f;
                    candidateDict[kw.TextContent] = (kw.DocumentId, kw.TextContent, cosine, match.Vector ?? new float[0]);
                }
            }
            foreach (var vec in cosineResults)
            {
                if (!candidateDict.ContainsKey(vec.TextContent))
                {
                    candidateDict[vec.TextContent] = (vec.DocumentId, vec.TextContent, vec.CosineScore, vec.Vector);
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
                    TextContent = doc.Text,
                    SimilarityScore = hybridScore
                });
            }

            // DIFY Idea #3: TopK Pipeline
            return hybridResults.OrderByDescending(x => x.SimilarityScore).Take(topK).ToList();
        }

        private async Task<List<(int DocumentId, string TextContent, float[] Vector)>> FetchVectorChunksAsync(string? soHieu = null, string? ngayBanHanh = null)
        {
            var allChunks = new List<(int DocumentId, string TextContent, float[] Vector)>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var cmd = connection.CreateCommand();

            // DIFY Idea #2: Metadata Filter trước khi RAG
            string joinClause = "";
            string whereClause = "1 = 1";

            if (!string.IsNullOrEmpty(soHieu) || !string.IsNullOrEmpty(ngayBanHanh))
            {
                joinClause = "JOIN Documents d ON DocumentChunks.DocumentId = d.Id";
                if (!string.IsNullOrEmpty(soHieu))
                {
                    whereClause += " AND d.SoVanBan LIKE '%' || @SoHieu || '%'";
                    cmd.Parameters.AddWithValue("@SoHieu", soHieu);
                }
                if (!string.IsNullOrEmpty(ngayBanHanh))
                {
                    whereClause += " AND d.NgayBanHanh LIKE '%' || @NgayBanHanh || '%'";
                    cmd.Parameters.AddWithValue("@NgayBanHanh", ngayBanHanh);
                }
            }

            cmd.CommandText = $@"
                SELECT DocumentChunks.DocumentId, DocumentChunks.TextContent, DocumentChunks.VectorJson 
                FROM DocumentChunks 
                {joinClause}
                WHERE {whereClause}";

            using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var vectorJson = reader.GetString(2);
                    var vector = JsonSerializer.Deserialize<float[]>(vectorJson);
                    if (vector != null)
                    {
                        allChunks.Add((reader.GetInt32(0), reader.GetString(1), vector));
                    }
                }
            }
            return allChunks;
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
    }
}
