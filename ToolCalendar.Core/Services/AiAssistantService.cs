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
        private readonly IStatsRepository _statsRepo;
        private readonly IOllamaEmbeddingService _embeddingService;
        private readonly IDocumentChunkRepository _chunkRepo;
        private readonly ILogger<AiAssistantService> _logger;

        public AiAssistantService(
            HttpClient httpClient,
            IConfiguration config,
            IReminderRepository reminderRepo,
            IUserRepository userRepo,
            IChatHistoryRepository chatHistoryRepo,
            IDocumentRepository documentRepo,
            IStatsRepository statsRepo,
            IOllamaEmbeddingService embeddingService,
            IDocumentChunkRepository chunkRepo,
            ILogger<AiAssistantService> logger)
        {
            _httpClient = httpClient;
            _ollamaUrl = config.GetValue<string>("Ollama:ChatUrl") ?? "http://127.0.0.1:11434/api/chat";
            _modelName = config.GetValue<string>("Ollama:Model") ?? "qwen2.5:3b";
            _reminderRepo = reminderRepo;
            _userRepo = userRepo;
            _chatHistoryRepo = chatHistoryRepo;
            _documentRepo = documentRepo;
            _statsRepo = statsRepo;
            _embeddingService = embeddingService;
            _chunkRepo = chunkRepo;
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

            var now = DateTime.UtcNow.AddHours(7); // Bắt buộc dùng giờ VN (UTC+7) để tránh lỗi timezone trên Docker
            string documentContext = "";

            if (documentId.HasValue)
            {
                var doc = await _documentRepo.GetDocumentByIdAsync(documentId.Value);
                if (doc != null)
                {
                    documentContext = $"\n\nBối cảnh quan trọng: Công văn số {doc.SoVanBan}, tên: {doc.TenCongVan}. Trích yếu: {doc.TrichYeu}.";
                    if (!string.IsNullOrWhiteSpace(doc.FullText))
                    {
                        var text = doc.FullText;
                        if (text.Length > 3000) text = text.Substring(0, 3000) + "\n...[Nội dung đã được cắt bớt]...";
                        documentContext += $"\nNội dung toàn văn:\n\"\"\"{text}\"\"\"";
                    }
                }
            }
            else
            {
                // Agentic Router: Dùng chính LLM để phân loại câu hỏi (siêu tốc với max_tokens = 5)
                string intent = "CHAT";
                try
                {
                    var routerPrompt = $"Phân loại câu hỏi sau thành 1 trong 3 nhóm: [STATS] nếu hỏi về thống kê/số lượng/ngày hạn, [SEARCH] nếu tìm kiếm nội dung công văn, [CHAT] nếu trò chuyện bình thường. Câu hỏi: \"{message}\". Chỉ trả về đúng 1 từ (STATS, SEARCH, hoặc CHAT), không giải thích.";
                    var routerPayload = new { model = _modelName, messages = new[] { new { role = "user", content = routerPrompt } }, stream = false, options = new { temperature = 0.0, num_predict = 5 } };
                    var routerJson = System.Text.Json.JsonSerializer.Serialize(routerPayload);
                    var routerResponse = await _httpClient.PostAsync(_ollamaUrl, new StringContent(routerJson, System.Text.Encoding.UTF8, "application/json"));
                    
                    if (routerResponse.IsSuccessStatusCode)
                    {
                        var routerResult = await routerResponse.Content.ReadAsStringAsync();
                        var routerObj = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(routerResult);
                        var reply = routerObj.GetProperty("message").GetProperty("content").GetString()?.Trim().ToUpper() ?? "";
                        
                        if (reply.Contains("STAT")) intent = "STATS";
                        else if (reply.Contains("SEARCH")) intent = "SEARCH";
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("[AiAssistant] Lỗi Router: {Msg}", ex.Message);
                }

                _logger.LogInformation("[AiAssistant] Câu hỏi: {Message} -> Phân loại: {Intent}", message, intent);

                if (intent == "STATS")
                {
                    try { documentContext = $"\n\n{await _statsRepo.GetAiContextStatsAsync()}"; }
                    catch (Exception ex) { _logger.LogWarning(ex, "Lỗi lấy dữ liệu STATS"); }
                }
                else if (intent == "SEARCH")
                {
                    try
                    {
                        // PLAN-AND-SOLVE: Thay vì embedding câu hỏi gốc, gọi AI để sinh ra các sub-queries
                        var planPrompt = $"Bạn là chuyên gia phân tích dữ liệu. Hãy phân tích câu hỏi sau và chia nhỏ thành 2-3 câu hỏi phụ (sub-queries) ngắn gọn để tìm kiếm trong cơ sở dữ liệu. Chỉ trả về danh sách các câu hỏi phụ, mỗi câu 1 dòng, không đánh số, không giải thích. \nCâu hỏi gốc: \"{message}\"";
                        var planPayload = new { model = _modelName, messages = new[] { new { role = "user", content = planPrompt } }, stream = false, options = new { temperature = 0.3, num_predict = 100 } };
                        var planJson = System.Text.Json.JsonSerializer.Serialize(planPayload);
                        var planResponse = await _httpClient.PostAsync(_ollamaUrl, new StringContent(planJson, System.Text.Encoding.UTF8, "application/json"));
                        
                        List<string> searchQueries = new List<string> { message }; // Luôn giữ câu hỏi gốc
                        
                        if (planResponse.IsSuccessStatusCode)
                        {
                            var planResult = await planResponse.Content.ReadAsStringAsync();
                            var planObj = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(planResult);
                            var subQs = planObj.GetProperty("message").GetProperty("content").GetString()?.Trim() ?? "";
                            
                            var lines = subQs.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                                             .Select(l => l.Trim().TrimStart('-', '*', '1', '2', '3', '.', ' '))
                                             .Where(l => l.Length > 3).ToList();
                            searchQueries.AddRange(lines);
                        }

                        _logger.LogInformation("[AiAssistant] RAG Queries: {Queries}", string.Join(" | ", searchQueries));

                        var allSimilarChunks = new List<ToolCalendar.Core.Data.Interfaces.DocumentChunkResult>();
                        
                        // DIFY Idea #2: Hybrid Search — Kết hợp Keyword và Vector Search
                        var keywordChunks = await _chunkRepo.FindByKeywordAsync(message, topK: 3);
                        allSimilarChunks.AddRange(keywordChunks);

                        foreach (var query in searchQueries.Take(3)) // Giới hạn tối đa 3 queries để tránh quá tải
                        {
                            var questionVector = await _embeddingService.GenerateEmbeddingAsync(query);
                            if (questionVector != null && questionVector.Length > 0)
                            {
                                var chunks = await _chunkRepo.FindSimilarChunksAsync(questionVector, topK: 2); // Mỗi query lấy top 2
                                allSimilarChunks.AddRange(chunks);
                            }
                        }

                        // Lọc trùng lặp chunk (tránh việc nhiều queries tìm ra cùng 1 chunk)
                        var distinctChunks = allSimilarChunks.DistinctBy(c => c.TextContent).Take(5).ToList();

                        if (distinctChunks.Count > 0)
                        {
                            documentContext = "\n\n[DỮ LIỆU TÌM KIẾM TỪ CƠ SỞ DỮ LIỆU (RAG)]\nDựa vào câu hỏi và quá trình phân tích sâu, hệ thống đã trích xuất các đoạn văn bản sau từ các công văn:\n";
                            foreach (var chunk in distinctChunks)
                            {
                                var doc = await _documentRepo.GetDocumentByIdAsync(chunk.DocumentId);
                                string name = doc != null ? $"Công văn số {doc.SoVanBan} ({doc.TenCongVan})" : $"Công văn ID {chunk.DocumentId}";
                                documentContext += $"\n--- Trích đoạn từ {name} (Ngày: {doc?.NgayBanHanh?.ToString("dd/MM/yyyy") ?? "N/A"}) ---\n{chunk.TextContent}\n";
                            }
                            documentContext += "\nLUÔN dựa vào dữ liệu trích xuất trên để trả lời. Nếu không đủ thông tin, hãy báo là hệ thống không tìm thấy nội dung phù hợp.";
                        }
                    }
                    catch (Exception ex) { _logger.LogWarning(ex, "Lỗi quét Vector (SEARCH)"); }
                }
            }

            var systemPrompt = $@"{persona}
Hôm nay là {now:dd/MM/yyyy HH:mm:ss}.{documentContext}
Nhiệm vụ của bạn là trả lời thân thiện theo đúng phong thái trên và hỗ trợ công việc. LUÔN BẮT ĐẦU bằng lời xưng hô (ví dụ: Dạ báo cáo sếp, Chào đồng chí...).

LƯU Ý CỰC KỲ QUAN TRỌNG ĐỂ TRÁNH BỊA ĐẶT (HALLUCINATION):
1. TUYỆT ĐỐI KHÔNG tự bịa ra ngày tháng, số liệu, tên cơ quan, hoặc địa danh.
2. CHỈ sử dụng chính xác các con số và ngày tháng xuất hiện trong nội dung văn bản.
3. Nếu văn bản bị lỗi font (OCR rác), hãy tóm tắt phần nội dung đọc được ở bên dưới. Đừng cố dịch các đoạn mã rác.
4. Nếu người dùng hỏi thông tin không có trong văn bản, BẮT BUỘC trả lời: ""Dạ, trong văn bản không đề cập đến thông tin này.""

KHOJ Idea #8 — INLINE CITATION (TRÍCH DẪN NỐI TUYẾN):
Khi trả lời dựa vào dữ liệu từ công văn cụ thể, BẮT BUỘC trích dẫn theo format: (Công văn số X/YYY-ZZZ, ngày DD/MM/YYYY).
Ví dụ: ""Theo quy định về đầu tư xây dựng (Công văn số 148/BC-UBND, ngày 10/04/2025), mức hỗ trợ là...""
KHÔNG được viết trái lời chung chung khi đã có dữ liệu cụ thể.

NẾU người dùng yêu cầu nhắc nhở công việc (ví dụ: nhắc tôi lúc 3h chiều họp...), bạn BẮT BUỘC phải đính kèm một dòng tag sau ĐÚNG Y HỆT vào CUỐI câu trả lời của bạn (thay thế YYYY-MM-DD HH:mm:ss bằng thời gian tương ứng):
[REMINDER|YYYY-MM-DD HH:mm:ss|Nội dung việc cần nhắc]

Ví dụ nếu người dùng muốn nhắc đi họp lúc 15:00 hôm nay:
Dạ vâng ạ, em đã ghi nhận lịch họp cho sếp rồi ạ!
[REMINDER|{now:yyyy-MM-dd} 15:00:00|Đi họp giao ban]

Lưu ý: Bạn KHÔNG được dùng format JSON. Chỉ cần trả lời bằng văn bản bình thường (Markdown) và thêm tag [REMINDER] ở cuối nếu có lịch nhắc.";

            // DIFY Idea #3: Token-Aware Memory — Cắt tỉa history theo số ký tự
            List<ChatMessageDto> history = new();
            try 
            { 
                var fullHistory = _chatHistoryRepo.GetHistoryByUserId(userId, 20); 
                int totalChars = 0;
                foreach (var msg in fullHistory.AsEnumerable().Reverse())
                {
                    totalChars += msg.Content.Length;
                    if (totalChars > 3000) break; // ~1000 tokens, ngưỡng an toàn cho qwen2.5:3b (4096 tokens max)
                    history.Insert(0, msg);
                }
            }
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

            // ANYTHINGLLM Idea #10: Timeout Fallback 30 giây cho Ollama
            // Nếu Ollama bị chậm/quá tải, ChatBox sẽ trả lời thân thiện thay vì treo mãi mãi
            using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(90));

            HttpResponseMessage response = null;
            bool connectionError = false;
            bool isTimeout = false;
            try
            {
                response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cts.Token);
            }
            catch (System.Threading.Tasks.TaskCanceledException)
            {
                _logger.LogWarning("[AiAssistant] Ollama timeout sau 90 giây.");
                isTimeout = true;
            }
            catch (Exception ex)
            {
                _logger.LogError("[AiAssistant] Lỗi gọi Ollama: {Msg}", ex.Message);
                connectionError = true;
            }

            if (isTimeout)
            {
                yield return user.Role is "Admin" or "LanhDao"
                    ? "Dạ báo cáo sếp, hệ thống AI đang quá tải, xin sếp thử lại sau ạ."
                    : "Hệ thống AI đang bận, đồng chí vui lòng thử lại sau.";
                yield break;
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
