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
        Task<string> ProcessChatAsync(int userId, string message, int? documentId = null);
    }

    public class AiAssistantService : IAiAssistantService
    {
        private readonly HttpClient _httpClient;
        private readonly string _ollamaUrl;
        private readonly string _modelName;
        private readonly IReminderRepository _reminderRepo;
        private readonly IUserRepository _userRepo;
        private readonly IChatHistoryRepository _chatHistoryRepo;
        private readonly IDocumentRepository _documentRepo;
        private readonly ILogger<AiAssistantService> _logger;

        public AiAssistantService(
            HttpClient httpClient,
            IConfiguration config,
            IReminderRepository reminderRepo,
            IUserRepository userRepo,
            IChatHistoryRepository chatHistoryRepo,
            IDocumentRepository documentRepo,
            ILogger<AiAssistantService> logger)
        {
            _httpClient = httpClient;
            _ollamaUrl = config.GetValue<string>("Ollama:ChatUrl") ?? "http://127.0.0.1:11434/api/chat";
            _modelName = config.GetValue<string>("Ollama:Model") ?? "qwen2.5:3b";
            _reminderRepo = reminderRepo;
            _userRepo = userRepo;
            _chatHistoryRepo = chatHistoryRepo;
            _documentRepo = documentRepo;
            _logger = logger;
        }

        public async Task<string> ProcessChatAsync(int userId, string message, int? documentId = null)
        {
            // Outer try/catch — bắt MỌI lỗi, không bao giờ để exception thoát ra ngoài
            try
            {
                var user = _userRepo.GetUserById(userId);
                if (user == null)
                    return "Lỗi xác thực người dùng.";

                // 1. Lưu tin nhắn user — lỗi DB không được dừng luồng chính
                try { _chatHistoryRepo.AddMessage(userId, "user", message); }
                catch (Exception ex) { _logger.LogWarning("[AiAssistant] Không thể lưu tin nhắn user: {Msg}", ex.Message); }

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
                string documentContext = "";

                if (documentId.HasValue)
                {
                    var doc = await _documentRepo.GetDocumentByIdAsync(documentId.Value);
                    if (doc != null && !string.IsNullOrWhiteSpace(doc.FullText))
                        documentContext = $"\n\nBối cảnh quan trọng: Công văn số {doc.SoVanBan}, tên: {doc.TenCongVan}. Nội dung:\n\"\"\"{doc.FullText}\"\"\"";
                }

                var systemPrompt = $@"{persona}
Hôm nay là {now:dd/MM/yyyy HH:mm:ss}.{documentContext}
Nhiệm vụ của bạn là trả lời thân thiện theo đúng phong thái trên và hỗ trợ công việc. LUÔN BẮT ĐẦU bằng lời xưng hô (ví dụ: Dạ báo cáo sếp, Chào đồng chí...).

BẠN BẮT BUỘC TRẢ VỀ CHUẨN JSON THEO ĐÚNG ĐỊNH DẠNG SAU (KHÔNG thêm văn bản nào ngoài JSON):
{{
  ""isReminder"": false,
  ""remindAt"": ""2026-08-11 14:00:00"" (chỉ điền thời gian nếu người dùng yêu cầu nhắc việc, nếu không thì để rỗng),
  ""reminderContent"": ""Nội dung việc cần nhắc"" (chỉ điền nếu là nhắc việc, nếu không thì để rỗng),
  ""replyText"": ""Toàn bộ câu trả lời, lời chào và nội dung tóm tắt dành cho người dùng""
}}";

                // 2. Lấy lịch sử chat — lỗi DB không được dừng luồng
                List<ChatMessageDto> history = new();
                try { history = _chatHistoryRepo.GetHistoryByUserId(userId, 10); }
                catch (Exception ex) { _logger.LogWarning("[AiAssistant] Không thể đọc lịch sử: {Msg}", ex.Message); }

                var messages = new List<object> { new { role = "system", content = systemPrompt } };
                foreach (var msg in history)
                    messages.Add(new { role = msg.Role, content = msg.Content });

                var requestBody = new
                {
                    model = _modelName,
                    messages = messages,
                    stream = false,
                    format = "json"
                };

                var requestContent = new StringContent(
                    JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

                // 3. Gọi Ollama
                var response = await _httpClient.PostAsync(_ollamaUrl, requestContent);
                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    _logger.LogError("[AiAssistant] Ollama trả lỗi HTTP {Code}: {Err}", (int)response.StatusCode, err);
                    return "Dạ báo cáo, hệ thống AI đang gặp sự cố. Đề nghị kiểm tra lại dịch vụ Ollama trên server.";
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("[AiAssistant] Ollama raw response: {Json}", responseJson);

                using var ollamaDoc = JsonDocument.Parse(responseJson);
                var root = ollamaDoc.RootElement;

                if (!root.TryGetProperty("message", out var msgProp) ||
                    !msgProp.TryGetProperty("content", out var contentProp))
                {
                    _logger.LogError("[AiAssistant] Ollama response thiếu message.content");
                    return "Dạ báo cáo, tôi không thể xử lý dữ liệu từ Ollama lúc này.";
                }

                var text = contentProp.GetString()?.Trim() ?? "";
                if (string.IsNullOrEmpty(text))
                    return "Dạ báo cáo, tôi chưa hiểu rõ ý của đồng chí/sếp.";

                // Dọn dẹp markdown wrapper nếu có
                if (text.StartsWith("```json")) text = text[7..];
                else if (text.StartsWith("```")) text = text[3..];
                if (text.EndsWith("```")) text = text[..^3];
                text = text.Trim();

                // 4. Parse JSON - Cố gắng trích xuất chuỗi JSON nếu AI sinh ra text dư thừa
                string jsonPart = text;
                string extraText = "";
                int firstBrace = text.IndexOf('{');
                int lastBrace = text.LastIndexOf('}');
                
                if (firstBrace >= 0 && lastBrace > firstBrace)
                {
                    jsonPart = text.Substring(firstBrace, lastBrace - firstBrace + 1);
                    if (lastBrace < text.Length - 1)
                    {
                        extraText = text.Substring(lastBrace + 1).Trim();
                    }
                }

                string replyText;
                try
                {
                    using var jsonResult = JsonDocument.Parse(jsonPart);
                    var rootJson = jsonResult.RootElement;

                    replyText = rootJson.TryGetProperty("replyText", out var replyProp)
                        ? replyProp.GetString() ?? ""
                        : "";

                    var isReminder = rootJson.TryGetProperty("isReminder", out var isReminderProp) &&
                                     isReminderProp.ValueKind is JsonValueKind.True or JsonValueKind.False &&
                                     isReminderProp.GetBoolean();

                    var reminderContent = rootJson.TryGetProperty("reminderContent", out var rcProp) ? rcProp.GetString() : null;
                    if (string.IsNullOrWhiteSpace(reminderContent)) 
                    {
                        // Fallback in case the model used 'content' instead of 'reminderContent'
                        reminderContent = rootJson.TryGetProperty("content", out var legacyRcProp) ? legacyRcProp.GetString() : null;
                    }

                    if (string.IsNullOrWhiteSpace(replyText))
                    {
                        replyText = extraText;
                    }
                    else if (!string.IsNullOrWhiteSpace(extraText) && !replyText.Contains(extraText))
                    {
                        // Nối thêm nếu có đoạn text nằm ngoài block JSON mà replyText chưa có
                        replyText = $"{replyText}\n\n{extraText}".Trim();
                    }

                    // Fallback nếu model vẫn vứt tóm tắt vào reminderContent/content khi không phải reminder
                    if (!isReminder && !string.IsNullOrWhiteSpace(reminderContent) && reminderContent.Length > 15)
                    {
                        if (string.IsNullOrWhiteSpace(replyText) || !replyText.Contains(reminderContent))
                        {
                            replyText = $"{replyText}\n\n{reminderContent}".Trim();
                        }
                    }

                    if (string.IsNullOrWhiteSpace(replyText))
                    {
                        replyText = "Dạ em đã nghe ạ. Sếp/Đồng chí cần em hỗ trợ gì thêm không ạ?";
                    }

                    if (isReminder)
                    {
                        var remindAtStr = rootJson.TryGetProperty("remindAt", out var raProp) ? raProp.GetString() : null;

                        if (DateTime.TryParse(remindAtStr, out var remindAt) && !string.IsNullOrEmpty(reminderContent))
                        {
                            try
                            {
                                _reminderRepo.AddReminder(userId, reminderContent, remindAt.ToString("yyyy-MM-dd HH:mm:ss"));
                                _logger.LogInformation("[AiAssistant] Đã lưu nhắc nhở UserId={Id}: {Content} lúc {At}", userId, reminderContent, remindAt);
                            }
                            catch (Exception ex) { _logger.LogWarning("[AiAssistant] Không thể lưu reminder: {Msg}", ex.Message); }
                        }
                    }
                }
                catch (JsonException jsonEx)
                {
                    _logger.LogWarning("[AiAssistant] Model không trả JSON hợp lệ, dùng raw text. Lỗi: {Msg}", jsonEx.Message);
                    // Dọn dẹp JSON rác nếu parse lỗi hoàn toàn
                    replyText = text.Replace("{", "").Replace("}", "").Replace("\"", "").Trim();
                    if (string.IsNullOrWhiteSpace(replyText))
                    {
                        replyText = "Dạ báo cáo, hiện tại em chưa thể trích xuất được thông tin, mong sếp thử lại ạ.";
                    }
                }

                // Đảm bảo LUÔN CÓ từ thưa gửi nếu model quên (Hard fallback)
                var lowerReply = replyText.ToLower();
                if (!lowerReply.Contains("dạ") && !lowerReply.Contains("báo cáo") && !lowerReply.Contains("chào"))
                {
                    string greeting = (user.Role == "Admin" || user.Role == "LanhDao") 
                                      ? "Dạ báo cáo sếp,\n" 
                                      : "Chào đồng chí,\n";
                    replyText = greeting + replyText;
                }

                // 5. Lưu reply của AI — lỗi DB không được dừng luồng
                try { _chatHistoryRepo.AddMessage(userId, "assistant", replyText); }
                catch (Exception ex) { _logger.LogWarning("[AiAssistant] Không thể lưu tin nhắn assistant: {Msg}", ex.Message); }

                return replyText;
            }
            catch (Exception ex)
            {
                _logger.LogError("[AiAssistant] Lỗi nghiêm trọng: {Type} — {Message}", ex.GetType().Name, ex.Message);
                return "Dạ báo cáo, đã xảy ra lỗi hệ thống. Kính mong thông cảm.";
            }
        }
    }
}
