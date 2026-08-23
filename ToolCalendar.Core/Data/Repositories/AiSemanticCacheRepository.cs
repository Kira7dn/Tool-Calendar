using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Core.Data.Repositories
{
    /// <summary>
    /// GPTCache-inspired Semantic Cache với 3 kỹ thuật nâng cấp:
    /// 1. Threshold 0.85 (tăng hit rate, học từ GPTCache default config.py)
    /// 2. LRU Eviction — cập nhật LastAccessedAt mỗi lần hit, xóa ít dùng nhất
    /// 3. Max Size 500 entries — giới hạn tuyệt đối, tránh memory leak
    /// </summary>
    public class AiSemanticCacheRepository : IAiSemanticCacheRepository
    {
        private readonly string _connectionString;
        private readonly ILogger<AiSemanticCacheRepository> _logger;

        // GPTCache config.py: maxsize = 1000 (ta dùng 500 vì SQLite nhỏ hơn)
        private const int MaxCacheSize = 500;
        // GPTCache config.py: similarity_threshold = 0.8 (ta dùng 0.85 - an toàn hơn 1 chút)
        private const float DefaultSimilarityThreshold = 0.85f;
        // TTL backup: nếu LRU không xóa đủ thì xóa entry quá 60 phút (tăng từ 15 phút)
        private const int TtlMinutes = 60;

        public AiSemanticCacheRepository(IConfiguration configuration, ILogger<AiSemanticCacheRepository> logger)
        {
            _logger = logger;
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
                    _connectionString = "Data Source=data_dump/documents.db";
            }
        }

        /// <summary>
        /// Lưu cache mới. Tự động chạy LRU Eviction nếu vượt MaxCacheSize.
        /// Học từ GPTCache: EvictionManager.soft_evict() + auto_flush every N inserts.
        /// </summary>
        public async Task StoreCacheAsync(float[] questionVector, string response, int userId)
        {
            var vectorJson = JsonSerializer.Serialize(questionVector);
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO AiSemanticCache (QuestionVectorJson, Response, CreatedAt, LastAccessedAt, HitCount, UserId)
                VALUES (@VectorJson, @Response, datetime('now'), datetime('now'), 0, @UserId)";

            cmd.Parameters.AddWithValue("@VectorJson", vectorJson);
            cmd.Parameters.AddWithValue("@Response", response);
            cmd.Parameters.AddWithValue("@UserId", userId);
            await cmd.ExecuteNonQueryAsync();

            // GPTCache EvictionManager: kiểm tra size sau mỗi lần insert
            await EvictAsync();
        }

        /// <summary>
        /// Tìm cache với Cosine Similarity. Nếu hit → cập nhật LastAccessedAt + HitCount (LRU tracking).
        /// Normalize vector trước khi tính — học từ GPTCache NumpyNormEvaluation.normalize().
        /// </summary>
        public async Task<string?> GetCachedResponseAsync(float[] questionVector, int userId, float minSimilarityScore = DefaultSimilarityThreshold)
        {
            // Normalize vector câu hỏi (GPTCache NumpyNormEvaluation)
            var normalizedQuery = Normalize(questionVector);

            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = connection.CreateCommand();
            // Chỉ lấy cache còn trong TTL (60 phút) và thuộc về người dùng hiện tại (hoặc hệ thống UserId=0)
            cmd.CommandText = @"
                SELECT Id, QuestionVectorJson, Response 
                FROM AiSemanticCache 
                WHERE LastAccessedAt >= datetime('now', '-' || @Ttl || ' minutes')
                  AND (UserId = @UserId OR UserId = 0)
                ORDER BY LastAccessedAt DESC
                LIMIT 200";
            cmd.Parameters.AddWithValue("@Ttl", TtlMinutes);
            cmd.Parameters.AddWithValue("@UserId", userId);

            string? bestResponse = null;
            int bestId = -1;
            float bestScore = 0f;

            using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    int id = reader.GetInt32(0);
                    var vectorJson = reader.GetString(1);
                    var cachedResponse = reader.GetString(2);

                    var cachedVector = JsonSerializer.Deserialize<float[]>(vectorJson);
                    if (cachedVector == null) continue;

                    // Normalize cached vector rồi tính similarity (GPTCache NumpyNormEvaluation)
                    var normalizedCached = Normalize(cachedVector);
                    float score = CosineSimilarity(normalizedQuery, normalizedCached);

                    if (score > bestScore)
                    {
                        bestScore = score;
                        bestResponse = cachedResponse;
                        bestId = id;
                    }
                }
            }

            if (bestScore >= minSimilarityScore && bestId >= 0)
            {
                _logger.LogInformation("[SemanticCache] HIT! Score={Score:F3}, Id={Id}", bestScore, bestId);

                // GPTCache LRU: cập nhật LastAccessedAt + tăng HitCount khi có cache hit
                using var updateCmd = connection.CreateCommand();
                updateCmd.CommandText = @"
                    UPDATE AiSemanticCache 
                    SET LastAccessedAt = datetime('now'), HitCount = HitCount + 1 
                    WHERE Id = @Id";
                updateCmd.Parameters.AddWithValue("@Id", bestId);
                await updateCmd.ExecuteNonQueryAsync();

                return bestResponse;
            }

            _logger.LogDebug("[SemanticCache] MISS. BestScore={Score:F3}", bestScore);
            return null;
        }

        /// <summary>
        /// GPTCache EvictionManager: 
        /// - Bước 1: Xóa entries quá TTL (60 phút không được dùng) 
        /// - Bước 2: Nếu vẫn vượt MaxCacheSize → xóa LRU (ít được dùng nhất, dùng lâu nhất)
        /// Học từ: EvictionManager.check_evict() + MemoryCacheEviction(policy="LRU")
        /// </summary>
        public async Task EvictAsync()
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            // Bước 1: TTL eviction — xóa entry không được dùng trong 60 phút
            using (var ttlCmd = connection.CreateCommand())
            {
                ttlCmd.CommandText = @"
                    DELETE FROM AiSemanticCache 
                    WHERE LastAccessedAt <= datetime('now', '-' || @Ttl || ' minutes')";
                ttlCmd.Parameters.AddWithValue("@Ttl", TtlMinutes);
                int deleted = await ttlCmd.ExecuteNonQueryAsync();
                if (deleted > 0)
                    _logger.LogDebug("[SemanticCache] TTL evict: xóa {Count} entries cũ", deleted);
            }

            // Bước 2: LRU eviction — nếu vượt MaxCacheSize, xóa những entry ít dùng nhất
            using (var countCmd = connection.CreateCommand())
            {
                countCmd.CommandText = "SELECT COUNT(*) FROM AiSemanticCache";
                var count = Convert.ToInt32(await countCmd.ExecuteScalarAsync());

                if (count > MaxCacheSize)
                {
                    int toDelete = count - (int)(MaxCacheSize * 0.8); // Xóa 20% để có buffer
                    using var lruCmd = connection.CreateCommand();
                    // Xóa LRU: ít HitCount nhất, LastAccessedAt cũ nhất (GPTCache LRU policy)
                    lruCmd.CommandText = @"
                        DELETE FROM AiSemanticCache 
                        WHERE Id IN (
                            SELECT Id FROM AiSemanticCache 
                            ORDER BY HitCount ASC, LastAccessedAt ASC 
                            LIMIT @ToDelete
                        )";
                    lruCmd.Parameters.AddWithValue("@ToDelete", toDelete);
                    int lruDeleted = await lruCmd.ExecuteNonQueryAsync();
                    _logger.LogInformation("[SemanticCache] LRU evict: xóa {Count} entries ít dùng nhất (MaxSize={Max})", lruDeleted, MaxCacheSize);
                }
            }
        }

        /// <summary>
        /// Normalize vector — học từ GPTCache NumpyNormEvaluation.normalize()
        /// Chia từng phần tử cho độ dài (magnitude) của vector.
        /// Giúp so sánh chính xác hơn, loại bỏ ảnh hưởng độ lớn tuyệt đối.
        /// </summary>
        private static float[] Normalize(float[] vector)
        {
            float magnitude = 0;
            for (int i = 0; i < vector.Length; i++)
                magnitude += vector[i] * vector[i];
            magnitude = (float)Math.Sqrt(magnitude);

            if (magnitude < 1e-8f) return vector; // Tránh chia cho 0

            var normalized = new float[vector.Length];
            for (int i = 0; i < vector.Length; i++)
                normalized[i] = vector[i] / magnitude;
            return normalized;
        }

        /// <summary>
        /// Cosine Similarity giữa 2 vector đã normalize.
        /// Với vector đã normalize, cosine = dot product đơn giản.
        /// </summary>
        private static float CosineSimilarity(float[] v1, float[] v2)
        {
            if (v1.Length != v2.Length) return 0;

            float dot = 0;
            for (int i = 0; i < v1.Length; i++)
                dot += v1[i] * v2[i];

            // Clamp về [0, 1] để tránh giá trị âm do lỗi floating point
            return Math.Max(0f, Math.Min(1f, dot));
        }
    }
}
