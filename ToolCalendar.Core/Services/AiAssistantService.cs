using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ToolCalendar.Core.Data.Interfaces;
using System.Text.RegularExpressions;

namespace ToolCalendar.Core.Services
{
    public interface IAiAssistantService
    {
        IAsyncEnumerable<string> ProcessChatStreamAsync(int userId, string message, int? documentId = null);
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

        public async IAsyncEnumerable<string> ProcessChatStreamAsync(int userId, string message, int? documentId = null)
        {
            var user = _userRepo.GetUserById(userId);
            if (user == null)
            {
                yield return "Lỗi xác thực người dùng.";
                yield break;
            }

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
                {
                    var text = doc.FullText;
                    if (text.Length > 3000) 
                    {
                        text = text.Substring(0, 3000) + "\n...[Nội dung đã được cắt bớt do quá dài]...";
                    }
                    documentContext = $"\n\nBối cảnh quan trọng: Công văn số {doc.SoVanBan}, tên: {doc.TenCongVan}. Nội dung:\n\"\"\"{text}\"\"\"";
                }
            }

            var systemPrompt = $@"{persona}
Hôm nay là {now:dd/MM/yyyy HH:mm:ss}.{documentContext}
Nhiệm vụ của bạn là trả lời thân thiện theo đúng phong thái trên và hỗ trợ công việc. LUÔN BẮT ĐẦU bằng lời xưng hô (ví dụ: Dạ báo cáo sếp, Chào đồng chí...).

NẾU người dùng yêu cầu nhắc nhở công việc (ví dụ: nhắc tôi lúc 3h chiều họp...), bạn BẮT BUỘC phải đính kèm một dòng tag sau ĐÚNG Y HỆT vào CUỐI câu trả lời của bạn (thay thế YYYY-MM-DD HH:mm:ss bằng thời gian tương ứng):
[REMINDER|YYYY-MM-DD HH:mm:ss|Nội dung việc cần nhắc]

Ví dụ nếu người dùng muốn nhắc đi họp lúc 15:00 hôm nay:
Dạ vâng ạ, em đã ghi nhận lịch họp cho sếp rồi ạ!
[REMINDER|{now:yyyy-MM-dd} 15:00:00|Đi họp giao ban]

Lưu ý: Bạn KHÔNG được dùng format JSON. Chỉ cần trả lời bằng văn bản bình thường (Markdown) và thêm tag [REMINDER] ở cuối nếu có lịch nhắc.";

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
                stream = true // Bật stream
            };

            var request = new HttpRequestMessage(HttpMethod.Post, _ollamaUrl)
            {
                Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
            };

            HttpResponseMessage response = null;
            bool connectionError = false;
            try
            {
                response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            }
            catch (Exception ex)
            {
                _logger.LogError("[AiAssistant] Lỗi gọi Ollama: {Msg}", ex.Message);
                connectionError = true;
            }

            if (connectionError)
            {
                yield return "Dạ báo cáo, hệ thống AI đang gặp sự cố kết nối.";
                yield break;
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("[AiAssistant] Ollama trả lỗi HTTP {Code}", (int)response.StatusCode);
                yield return "Dạ báo cáo, hệ thống AI đang gặp sự cố. Đề nghị kiểm tra lại dịch vụ Ollama trên server.";
                yield break;
            }

            var fullResponse = new StringBuilder();
            using var stream = await response.Content.ReadAsStreamAsync();
            using var reader = new StreamReader(stream);

            string line;
            while ((line = await reader.ReadLineAsync()) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;

                string chunk = null;
                try
                {
                    using var ollamaDoc = JsonDocument.Parse(line);
                    if (ollamaDoc.RootElement.TryGetProperty("message", out var msgProp) &&
                        msgProp.TryGetProperty("content", out var contentProp))
                    {
                        chunk = contentProp.GetString();
                    }
                }
                catch (JsonException) { /* Bỏ qua các line không phải JSON chuẩn */ }

                if (!string.IsNullOrEmpty(chunk))
                {
                    fullResponse.Append(chunk);
                    yield return chunk;
                }
            }

            string finalReply = fullResponse.ToString().Trim();

            // Đảm bảo LUÔN CÓ từ thưa gửi nếu model quên (Hard fallback)
            var lowerReply = finalReply.ToLower();
            if (!lowerReply.Contains("dạ") && !lowerReply.Contains("báo cáo") && !lowerReply.Contains("chào"))
            {
                string greeting = (user.Role == "Admin" || user.Role == "LanhDao") 
                                  ? "Dạ báo cáo sếp,\n" 
                                  : "Chào đồng chí,\n";
                finalReply = greeting + finalReply;
            }

            // Xử lý [REMINDER] tag nếu có
            string finalReplyForChat = finalReply;
            var match = Regex.Match(finalReply, @"\[REMINDER\|(.*?)\|(.*?)\]");
            if (match.Success)
            {
                var timeStr = match.Groups[1].Value;
                var content = match.Groups[2].Value;

                if (DateTime.TryParse(timeStr, out var remindAt) && !string.IsNullOrWhiteSpace(content))
                {
                    try
                    {
                        _reminderRepo.AddReminder(userId, content.Trim(), remindAt.ToString("yyyy-MM-dd HH:mm:ss"));
                        _logger.LogInformation("[AiAssistant] Đã lưu nhắc nhở qua Streaming UserId={Id}: {Content} lúc {At}", userId, content, remindAt);
                    }
                    catch (Exception ex) { _logger.LogWarning("[AiAssistant] Không thể lưu reminder: {Msg}", ex.Message); }
                }
                
                // Ẩn tag REMINDER khỏi lịch sử chat hiển thị cho người dùng
                finalReplyForChat = finalReply.Replace(match.Value, "").Trim();
            }

            try { _chatHistoryRepo.AddMessage(userId, "assistant", finalReplyForChat); }
            catch (Exception ex) { _logger.LogWarning("[AiAssistant] Không thể lưu tin nhắn assistant: {Msg}", ex.Message); }
        }
    }
}
