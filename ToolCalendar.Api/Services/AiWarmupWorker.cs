using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace ToolCalendar.Api.Services
{
    public class AiWarmupWorker : BackgroundService
    {
        private readonly ILogger<AiWarmupWorker> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _ollamaUrl = "http://ollama:11434/api/chat";

        public AiWarmupWorker(ILogger<AiWarmupWorker> logger, IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _httpClientFactory = httpClientFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[AiWarmup] Bắt đầu ping Ollama để nạp mô hình vào RAM...");
            
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = System.TimeSpan.FromSeconds(300); // 5 phút để nạp vào RAM
                var payload = "{\"model\": \"qwen2.5:3b\", \"messages\": [{\"role\": \"user\", \"content\": \"ping\"}], \"stream\": false, \"keep_alive\": -1}";
                var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");
                
                var response = await client.PostAsync(_ollamaUrl, content, stoppingToken);
                
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("[AiWarmup] Nạp mô hình Ollama thành công. Sẽ giữ trong RAM vĩnh viễn.");
                }
                else
                {
                    _logger.LogWarning($"[AiWarmup] Nạp mô hình thất bại. Status Code: {response.StatusCode}");
                }
            }
            catch (System.Exception ex)
            {
                _logger.LogError($"[AiWarmup] Lỗi khi nạp mô hình: {ex.Message}");
            }
        }
    }
}
