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
    // ANYTHINGLLM Idea #5: Long-Term Memory
    // Lưu trữ và truy xuất memories dài hạn của từng user
    // Tương đương plugin memory.js của AnythingLLM (action: store + search)
    public class UserMemoryRepository : IUserMemoryRepository
    {
        private readonly string _connectionString;

        // In-Memory Vector Cache
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, List<(int Id, string Content, float[] Vector, string CreatedAt)>> _memoryCache = new();
        private static bool _isCacheInitialized = false;
        private static readonly System.Threading.SemaphoreSlim _cacheLock = new(1, 1);

        private async Task EnsureCacheInitializedAsync()
        {
            if (_isCacheInitialized) return;

            await _cacheLock.WaitAsync();
            try
            {
                if (_isCacheInitialized) return;

                using var conn = new SqliteConnection(_connectionString);
                await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT Id, UserId, Content, VectorJson, CreatedAt FROM UserMemories WHERE VectorJson != '[]'";

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var id = reader.GetInt32(0);
                    var userId = reader.GetInt32(1);
                    var content = reader.GetString(2);
                    var vectorJson = reader.GetString(3);
                    var createdAt = reader.GetString(4);
                    var vector = JsonSerializer.Deserialize<float[]>(vectorJson);

                    if (vector != null && vector.Length > 0)
                    {
                        _memoryCache.AddOrUpdate(
                            userId,
                            _ => new List<(int, string, float[], string)> { (id, content, vector, createdAt) },
                            (_, list) => { list.Add((id, content, vector, createdAt)); return list; }
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

        public UserMemoryRepository(IConfiguration configuration)
        {
            var dbPath = Environment.GetEnvironmentVariable("DB_PATH");
            _connectionString = !string.IsNullOrEmpty(dbPath)
                ? $"Data Source={dbPath}"
                : (configuration.GetConnectionString("DefaultConnection") ?? "Data Source=data_dump/documents.db");
        }

        public async Task StoreMemoryAsync(int userId, string content, float[]? embedding = null)
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();

            var vectorJson = embedding != null ? JsonSerializer.Serialize(embedding) : "[]";
            cmd.CommandText = @"
                INSERT INTO UserMemories (UserId, Content, VectorJson, CreatedAt)
                VALUES (@UserId, @Content, @VectorJson, datetime('now', '+7 hours'))";
            cmd.Parameters.AddWithValue("@UserId", userId);
            cmd.Parameters.AddWithValue("@Content", content);
            cmd.Parameters.AddWithValue("@VectorJson", vectorJson);
            await cmd.ExecuteNonQueryAsync();

            if (_isCacheInitialized && embedding != null && embedding.Length > 0)
            {
                // To get the new ID, we can either re-fetch or just invalidate the cache for this user
                // The easiest safe way is to invalidate the cache for this user so it re-fetches or just ignore id (but id is needed for delete)
                // Let's get the last insert rowid
                cmd.CommandText = "SELECT last_insert_rowid()";
                var newId = Convert.ToInt32(await cmd.ExecuteScalarAsync());

                _memoryCache.AddOrUpdate(
                    userId,
                    _ => new List<(int, string, float[], string)> { (newId, content, embedding, DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss")) },
                    (_, list) =>
                    {
                        var newList = new List<(int, string, float[], string)>(list);
                        newList.Add((newId, content, embedding, DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss")));
                        return newList;
                    }
                );
            }
        }

        public async Task<List<UserMemoryResult>> RecallMemoriesAsync(int userId, float[] questionVector, int topK = 5, float minScore = 0.25f)
        {
            await EnsureCacheInitializedAsync();

            var memories = new List<(int Id, string Content, float[] Vector, string CreatedAt)>();
            if (_memoryCache.TryGetValue(userId, out var userMems))
            {
                memories.AddRange(userMems);
            }

            // Cosine similarity filter + threshold (AnythingLLM style)
            return memories
                .Select(m => new UserMemoryResult
                {
                    Id = m.Id,
                    UserId = userId,
                    Content = m.Content,
                    CreatedAt = m.CreatedAt,
                    SimilarityScore = CosineSimilarity(questionVector, m.Vector)
                })
                .Where(m => m.SimilarityScore >= minScore)
                .OrderByDescending(m => m.SimilarityScore)
                .Take(topK)
                .ToList();
        }

        public async Task<List<UserMemoryResult>> GetRecentMemoriesAsync(int userId, int limit = 10)
        {
            var results = new List<UserMemoryResult>();
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT Id, Content, CreatedAt
                FROM UserMemories
                WHERE UserId = @UserId
                ORDER BY CreatedAt DESC
                LIMIT @Limit";
            cmd.Parameters.AddWithValue("@UserId", userId);
            cmd.Parameters.AddWithValue("@Limit", limit);

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                results.Add(new UserMemoryResult
                {
                    Id = reader.GetInt32(0),
                    UserId = userId,
                    Content = reader.GetString(1),
                    CreatedAt = reader.GetString(2),
                    SimilarityScore = 1.0f
                });
            }
            return results;
        }

        public async Task DeleteMemoryAsync(int memoryId)
        {
            using var conn = new SqliteConnection(_connectionString);
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM UserMemories WHERE Id = @Id";
            cmd.Parameters.AddWithValue("@Id", memoryId);
            await cmd.ExecuteNonQueryAsync();

            if (_isCacheInitialized)
            {
                foreach (var kvp in _memoryCache)
                {
                    var newList = kvp.Value.Where(m => m.Id != memoryId).ToList();
                    _memoryCache[kvp.Key] = newList;
                }
            }
        }

        private static float CosineSimilarity(float[] v1, float[] v2)
        {
            if (v1.Length != v2.Length) return 0;
            float dot = 0, mag1 = 0, mag2 = 0;
            for (int i = 0; i < v1.Length; i++)
            {
                dot += v1[i] * v2[i];
                mag1 += v1[i] * v1[i];
                mag2 += v2[i] * v2[i];
            }
            return (mag1 == 0 || mag2 == 0) ? 0 : dot / (float)(Math.Sqrt(mag1) * Math.Sqrt(mag2));
        }
    }
}
