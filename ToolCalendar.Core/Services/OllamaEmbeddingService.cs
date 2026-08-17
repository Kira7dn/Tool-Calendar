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
            // Gọi sang Python AI Service
            var baseUrl = config.GetValue<string>("PythonAiServiceUrl") ?? "http://python-ai-service:8001";
            _ollamaUrl = $"{baseUrl.TrimEnd('/')}/api/embed";
            _modelName = "";
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
                    text = text
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // Thêm timeout 10s cho an toàn
                using var cts = new System.Threading.CancellationTokenSource(System.TimeSpan.FromSeconds(10));
                var response = await _httpClient.PostAsync(_ollamaUrl, content, cts.Token);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("[OllamaEmbeddingService] Lỗi tạo vector từ Python: HTTP {StatusCode}", response.StatusCode);
                    return new float[0];
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<PythonEmbedResponse>(responseJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                return result?.Vector ?? new float[0];
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[OllamaEmbeddingService] Lỗi Exception khi tạo vector");
                return new float[0];
            }
        }
    }

    public class PythonEmbedResponse
    {
        public float[] Vector { get; set; }
    }
}
