using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ToolCalendar.Core.Services
{
    public interface IOllamaEmbeddingService
    {
        Task<float[]> GenerateEmbeddingAsync(string text);
    }

    public class OllamaEmbeddingService : IOllamaEmbeddingService
    {
        private readonly HttpClient _httpClient;
        private readonly string _ollamaUrl;
        private readonly string _modelName;
        private readonly ILogger<OllamaEmbeddingService> _logger;

        public OllamaEmbeddingService(HttpClient httpClient, IConfiguration config, ILogger<OllamaEmbeddingService> logger)
        {
            _httpClient = httpClient;
            // Endpoint cho embedding là /api/embeddings
            _ollamaUrl = (config.GetValue<string>("Ollama:ChatUrl") ?? "http://127.0.0.1:11434/api/chat").Replace("/api/chat", "/api/embeddings");
            // Mặc định dùng chính model qwen2.5:3b để nhúng, hoặc nomic-embed-text nếu có
            _modelName = config.GetValue<string>("Ollama:EmbeddingModel") ?? "nomic-embed-text";
            _logger = logger;
        }

        public async Task<float[]> GenerateEmbeddingAsync(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return new float[0];

            try
            {
                var payload = new
                {
                    model = _modelName,
                    prompt = text
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync(_ollamaUrl, content);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("[OllamaEmbeddingService] Lỗi tạo vector: HTTP {StatusCode}", response.StatusCode);
                    return new float[0];
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<OllamaEmbeddingResponse>(responseJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                return result?.Embedding ?? new float[0];
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[OllamaEmbeddingService] Lỗi Exception khi tạo vector");
                return new float[0];
            }
        }

        private class OllamaEmbeddingResponse
        {
            public float[]? Embedding { get; set; }
        }
    }
}
