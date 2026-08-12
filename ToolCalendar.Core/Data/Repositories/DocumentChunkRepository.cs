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
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                                ?? "Data Source=data_dump/documents.db";
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

        public async Task<List<DocumentChunkResult>> FindSimilarChunksAsync(float[] questionVector, int topK = 3)
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
            var results = allChunks.Select(chunk => new DocumentChunkResult
            {
                DocumentId = chunk.DocumentId,
                TextContent = chunk.TextContent,
                SimilarityScore = CosineSimilarity(questionVector, chunk.Vector)
            })
            .OrderByDescending(x => x.SimilarityScore)
            .Take(topK)
            .ToList();

            return results;
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
