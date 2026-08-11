using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Core.Services
{
    public interface IAiAssistantService
    {
        Task<string> ProcessChatAsync(int userId, string message);
    }

    public class AiAssistantService : IAiAssistantService
    {
        private readonly HttpClient _httpClient;
        private readonly string _geminiApiKey;
        private readonly IReminderRepository _reminderRepo;
        private readonly ILogger<AiAssistantService> _logger;

        public AiAssistantService(HttpClient httpClient, IConfiguration config, IReminderRepository reminderRepo, ILogger<AiAssistantService> logger)
        {
            _httpClient = httpClient;
            _geminiApiKey = config.GetValue<string>("Gemini:ApiKey") ?? "";
            _reminderRepo = reminderRepo;
            _logger = logger;
        }

        public async Task<string> ProcessChatAsync(int userId, string message)
        {
            if (string.IsNullOrEmpty(_geminiApiKey))
            {
                return "Hệ thống chưa được cấu hình API Key cho Trợ lý AI.";
            }

            var now = DateTime.Now;
            var systemPrompt = $@"
Bạn là Trợ lý AI của phần mềm Quản lý Công văn (Tool-Calendar).
Hôm nay là {now:dd/MM/yyyy HH:mm:ss}.
Nhiệm vụ của bạn là phân tích yêu cầu nhắc nhở công việc của người dùng.
Nếu người dùng yêu cầu nhắc nhở, hãy bóc tách THỜI GIAN NHẮC (theo định dạng yyyy-MM-dd HH:mm:ss) và NỘI DUNG CÔNG VIỆC.
Trả về dữ liệu dưới dạng JSON (không có markdown code block) theo cấu trúc:
{{
  ""isReminder"": true,
  ""remindAt"": ""2026-08-11 14:00:00"",
  ""content"": ""Nội dung công việc cần làm"",
  ""replyText"": ""Câu trả lời thân thiện dành cho người dùng""
}}
Nếu câu của người dùng không phải là nhắc việc (ví dụ: chào hỏi), hãy trả về:
{{
  ""isReminder"": false,
  ""replyText"": ""Câu trả lời thân thiện dành cho người dùng""
}}
            ";

            var requestBody = new
            {
                system_instruction = new
                {
                    parts = new[] { new { text = systemPrompt } }
                },
                contents = new[]
                {
                    new { role = "user", parts = new[] { new { text = message } } }
                }
            };

            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={_geminiApiKey}";
            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            try
            {
                var response = await _httpClient.PostAsync(url, content);
                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    _logger.LogError("[AiAssistant] Lỗi gọi Gemini API: " + err);
                    return "Xin lỗi, tôi đang gặp sự cố kết nối tới bộ não AI.";
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseJson);
                
                var root = doc.RootElement;
                if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
                {
                    return "Tôi không hiểu được ý của bạn.";
                }

                var text = candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
                
                // Extract JSON block if it's wrapped in markdown
                text = text.Trim();
                if (text.StartsWith("```json"))
                {
                    text = text.Substring(7);
                    if (text.EndsWith("```")) text = text.Substring(0, text.Length - 3);
                }
                else if (text.StartsWith("```"))
                {
                    text = text.Substring(3);
                    if (text.EndsWith("```")) text = text.Substring(0, text.Length - 3);
                }
                text = text.Trim();

                using var jsonResult = JsonDocument.Parse(text);
                var isReminder = jsonResult.RootElement.GetProperty("isReminder").GetBoolean();
                var replyText = jsonResult.RootElement.GetProperty("replyText").GetString();

                if (isReminder)
                {
                    var remindAtStr = jsonResult.RootElement.GetProperty("remindAt").GetString();
                    var reminderContent = jsonResult.RootElement.GetProperty("content").GetString();

                    if (DateTime.TryParse(remindAtStr, out var remindAt))
                    {
                        _reminderRepo.AddReminder(userId, reminderContent, remindAt.ToString("yyyy-MM-dd HH:mm:ss"));
                        _logger.LogInformation($"[AiAssistant] Đã lưu nhắc nhở cho UserId={userId}: {reminderContent} lúc {remindAt}");
                    }
                }

                return replyText;
            }
            catch (Exception ex)
            {
                _logger.LogError("[AiAssistant] Lỗi xử lý Chat: " + ex.Message);
                return "Đã xảy ra lỗi hệ thống khi phân tích yêu cầu của bạn.";
            }
        }
    }
}
