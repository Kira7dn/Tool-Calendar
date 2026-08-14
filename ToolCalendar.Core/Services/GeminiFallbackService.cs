using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ToolCalendar.Core.Services.AiTools;

namespace ToolCalendar.Core.Services
{
    public class GeminiFallbackService
    {
        private readonly HttpClient _httpClient;
        private readonly AiToolRegistry _toolRegistry;
        private readonly ILogger<GeminiFallbackService> _logger;
        private readonly string? _apiKey;

        public GeminiFallbackService(HttpClient httpClient, AiToolRegistry toolRegistry, ILogger<GeminiFallbackService> logger, IConfiguration config)
        {
            _httpClient = httpClient;
            _toolRegistry = toolRegistry;
            _logger = logger;
            _apiKey = config["Gemini:ApiKey"];
        }

        public async Task<string> CallGeminiAsync(List<object> ollamaMessages, string systemPrompt)
        {
            if (string.IsNullOrEmpty(_apiKey))
            {
                return "Dạ báo cáo, hệ thống Local AI quá tải và chưa được cấu hình API Key dự phòng (Gemini).";
            }

            try
            {
                var contents = new List<object>();
                foreach (var msgObj in ollamaMessages)
                {
                    var msgDict = JsonSerializer.Deserialize<Dictionary<string, string>>(JsonSerializer.Serialize(msgObj));
                    if (msgDict != null && msgDict.TryGetValue("role", out var role) && msgDict.TryGetValue("content", out var content))
                    {
                        if (role == "system") continue; // system prompt handled separately
                        string geminiRole = role == "assistant" ? "model" : "user";
                        contents.Add(new { role = geminiRole, parts = new[] { new { text = content } } });
                    }
                }

                var tools = _toolRegistry.GetToolsSchema().Select(t =>
                {
                    var tDict = JsonSerializer.Deserialize<Dictionary<string, object>>(JsonSerializer.Serialize(t));
                    var func = JsonSerializer.Deserialize<Dictionary<string, object>>(tDict["function"].ToString());
                    return new { name = func["name"], description = func["description"], parameters = func["parameters"] };
                }).ToArray();

                var requestBody = new
                {
                    system_instruction = new { parts = new { text = systemPrompt } },
                    contents = contents,
                    tools = new[] { new { function_declarations = tools } }
                };

                string url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={_apiKey}";
                var req = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(JsonSerializer.Serialize(requestBody, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }), Encoding.UTF8, "application/json")
                };

                var response = await _httpClient.SendAsync(req);
                var result = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Gemini Error: {Msg}", result);
                    return "Dạ báo cáo, hệ thống dự phòng cũng đang gặp sự cố.";
                }

                using var doc = JsonDocument.Parse(result);
                var candidates = doc.RootElement.GetProperty("candidates");
                if (candidates.GetArrayLength() > 0)
                {
                    var firstCandidate = candidates[0];
                    var parts = firstCandidate.GetProperty("content").GetProperty("parts");
                    if (parts.GetArrayLength() > 0)
                    {
                        var part = parts[0];
                        if (part.TryGetProperty("functionCall", out var functionCall))
                        {
                            string funcName = functionCall.GetProperty("name").GetString()!;
                            var argsObj = functionCall.GetProperty("args").Deserialize<Dictionary<string, object>>();
                            string toolResult = await _toolRegistry.ExecuteToolAsync(funcName, argsObj!);
                            return $"Đã tra cứu dữ liệu tự động bằng công cụ {funcName}. Kết quả:\n{toolResult}";
                        }
                        if (part.TryGetProperty("text", out var text))
                        {
                            return text.GetString()!;
                        }
                    }
                }
                
                return "Không nhận được phản hồi từ AI dự phòng.";
            }
            catch (Exception ex)
            {
                _logger.LogError("Gemini fallback exception: {Msg}", ex.Message);
                return "Lỗi trong quá trình kết nối với AI dự phòng.";
            }
        }
    }
}
