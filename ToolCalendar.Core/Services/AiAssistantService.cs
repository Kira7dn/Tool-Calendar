using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
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
        private readonly string _ollamaUrl;
        private readonly string _modelName;
        private readonly IReminderRepository _reminderRepo;
        private readonly IUserRepository _userRepo;
        private readonly IChatHistoryRepository _chatHistoryRepo;
        private readonly ILogger<AiAssistantService> _logger;

        public AiAssistantService(
            HttpClient httpClient, 
            IConfiguration config, 
            IReminderRepository reminderRepo, 
            IUserRepository userRepo, 
            IChatHistoryRepository chatHistoryRepo,
            ILogger<AiAssistantService> logger)
        {
            _httpClient = httpClient;
            // Dùng Ollama local url, default là http://127.0.0.1:11434/api/chat
            _ollamaUrl = config.GetValue<string>("Ollama:ChatUrl") ?? "http://127.0.0.1:11434/api/chat";
            _modelName = config.GetValue<string>("Ollama:Model") ?? "qwen2.5:3b";
            _reminderRepo = reminderRepo;
            _userRepo = userRepo;
            _chatHistoryRepo = chatHistoryRepo;
            _logger = logger;
        }

        public async Task<string> ProcessChatAsync(int userId, string message)
        {
            var user = _userRepo.GetUserById(userId);
            if (user == null)
            {
                return "Lỗi xác thực người dùng.";
            }

            // 1. Lưu tin nhắn của user vào DB
            _chatHistoryRepo.AddMessage(userId, "user", message);

            string persona;
            string userName = !string.IsNullOrEmpty(user.FullName) ? user.FullName : user.Username;

            if (user.Role == "Admin" || user.Role == "LanhDao")
            {
                persona = $@"Bạn là Trợ lý AI của phần mềm Quản lý Công văn (cơ quan Nhà nước).
Người đang nói chuyện với bạn là Sếp/Lãnh đạo của cơ quan (Tên: {userName}).
Phong thái: Kính trọng, báo cáo ngắn gọn, đi thẳng vào vấn đề. 
Xưng hô: Đại từ của bạn là 'Em' hoặc 'AI', gọi người dùng là 'Sếp' hoặc 'Thủ trưởng'.
Luôn dạ vâng lễ phép (ví dụ: Dạ vâng ạ, Em xin báo cáo sếp...).";
            }
            else
            {
                persona = $@"Bạn là Trợ lý AI của phần mềm Quản lý Công văn (cơ quan Nhà nước).
Người đang nói chuyện với bạn là Cán bộ/Văn thư (Tên: {userName}).
Phong thái: Trực diện, chuyên nghiệp, hỗ trợ nghiệp vụ, lịch sự.
Xưng hô: Đại từ của bạn là 'Tôi', gọi người dùng là 'Đồng chí'.
Luôn dùng từ ngữ chuẩn mực cơ quan Nhà nước (ví dụ: Chào đồng chí, Báo cáo đồng chí...).";
            }

            var now = DateTime.Now;
            var systemPrompt = $@"{persona}
Hôm nay là {now:dd/MM/yyyy HH:mm:ss}.
Nhiệm vụ của bạn là trả lời thân thiện theo đúng phong thái trên và hỗ trợ công việc.
Nếu người dùng yêu cầu NHẮC VIỆC (ví dụ: nhắc tôi họp, lên lịch...), bạn bóc tách THỜI GIAN NHẮC (định dạng yyyy-MM-dd HH:mm:ss) và NỘI DUNG.
BẠN BẮT BUỘC TRẢ VỀ CHUẨN JSON theo cấu trúc sau (chỉ JSON, không văn bản dư thừa):
{{
  ""isReminder"": true hoặc false,
  ""remindAt"": ""2026-08-11 14:00:00"" (nếu isReminder = true),
  ""content"": ""Nội dung nhắc nhở"" (nếu isReminder = true),
  ""replyText"": ""Câu trả lời giao tiếp với người dùng theo đúng xưng hô lễ nghi""
}}";

            // 2. Lấy lịch sử chat (tối đa 10 tin nhắn gần nhất)
            var history = _chatHistoryRepo.GetHistoryByUserId(userId, 10);
            
            var messages = new List<object>
            {
                new { role = "system", content = systemPrompt }
            };

            foreach (var msg in history)
            {
                messages.Add(new { role = msg.Role, content = msg.Content });
            }

            var requestBody = new
            {
                model = _modelName,
                messages = messages,
                stream = false,
                format = "json" // Ép Qwen/Ollama trả về JSON
            };

            var requestContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            try
            {
                var response = await _httpClient.PostAsync(_ollamaUrl, requestContent);
                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    _logger.LogError("[AiAssistant] Lỗi gọi Ollama API: " + err);
                    return "Dạ báo cáo, hệ thống kết nối AI cục bộ (Ollama) đang gặp sự cố. Đề nghị kiểm tra lại dịch vụ Ollama trên server.";
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseJson);
                var root = doc.RootElement;
                
                if (!root.TryGetProperty("message", out var messageProp) || !messageProp.TryGetProperty("content", out var responseContentProp))
                {
                    return "Dạ báo cáo, tôi không thể xử lý dữ liệu lúc này.";
                }

                var text = responseContentProp.GetString()?.Trim();
                if (string.IsNullOrEmpty(text))
                {
                    return "Dạ báo cáo, tôi chưa hiểu rõ ý của đồng chí/sếp.";
                }

                // Dọn dẹp markdown nếu có (phòng hờ LLM vẫn sinh ra dù đã có format json)
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
                var rootJson = jsonResult.RootElement;

                var isReminder = rootJson.TryGetProperty("isReminder", out var isReminderProp) && 
                                 (isReminderProp.ValueKind == JsonValueKind.True || isReminderProp.ValueKind == JsonValueKind.False) 
                                 ? isReminderProp.GetBoolean() : false;
                                 
                var replyText = rootJson.TryGetProperty("replyText", out var replyTextProp) ? replyTextProp.GetString() : "Đã tiếp nhận thông tin.";

                if (isReminder)
                {
                    var remindAtStr = rootJson.TryGetProperty("remindAt", out var remindAtProp) ? remindAtProp.GetString() : null;
                    var reminderContent = rootJson.TryGetProperty("content", out var remContentProp) ? remContentProp.GetString() : null;

                    if (DateTime.TryParse(remindAtStr, out var remindAt) && !string.IsNullOrEmpty(reminderContent))
                    {
                        _reminderRepo.AddReminder(userId, reminderContent, remindAt.ToString("yyyy-MM-dd HH:mm:ss"));
                        _logger.LogInformation($"[AiAssistant] Đã lưu nhắc nhở cho UserId={userId}: {reminderContent} lúc {remindAt}");
                    }
                }

                // 3. Lưu câu trả lời của AI vào DB (chỉ lưu phần replyText)
                _chatHistoryRepo.AddMessage(userId, "assistant", replyText);

                return replyText;
            }
            catch (Exception ex)
            {
                _logger.LogError("[AiAssistant] Lỗi xử lý Chat: " + ex.Message);
                return "Dạ báo cáo, đã xảy ra lỗi phần mềm khi phân tích yêu cầu. Kính mong thông cảm.";
            }
        }
    }
}
