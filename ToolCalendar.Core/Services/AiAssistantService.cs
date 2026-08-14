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
using System.Linq;
using ToolCalendar.Core.Services.AiTools;

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
        private readonly IUserMemoryRepository _memoryRepo;
        private readonly AiToolRegistry _toolRegistry;
        private readonly ILogger<AiAssistantService> _logger;

        // ANYTHINGLLM Idea #1: N-Hop Tool Chain — tối đa 5 lượt tool call liên tiếp
        private const int MaxToolCalls = 5;
        // ANYTHINGLLM Idea #3: Similarity Threshold (0.20 = ngưỡng tối thiểu)
        private const float SimilarityThreshold = 0.20f;

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
            IUserMemoryRepository memoryRepo,
            AiToolRegistry toolRegistry,
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
            _memoryRepo = memoryRepo;
            _toolRegistry = toolRegistry;
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

            string userName = !string.IsNullOrEmpty(user.FullName) ? user.FullName : user.Username;
            bool isLeader = user.Role == "Admin" || user.Role == "LanhDao";

            // ANYTHINGLLM Idea #5: Long-Term Memory — inject memories vào System Prompt
            string memorySection = "";
            try
            {
                var questionVector = await _embeddingService.GenerateEmbeddingAsync(message);
                List<UserMemoryResult> memories = new();
                if (questionVector != null && questionVector.Length > 0)
                    memories = await _memoryRepo.RecallMemoriesAsync(userId, questionVector, topK: 5, minScore: 0.25f);
                if (memories.Count == 0)
                    memories = await _memoryRepo.GetRecentMemoriesAsync(userId, limit: 3);
                if (memories.Count > 0)
                {
                    var sb = new StringBuilder("## Những điều tôi nhớ về bạn\n");
                    foreach (var m in memories) sb.AppendLine($"- {m.Content}");
                    memorySection = "\n\n" + sb.ToString();
                }
            }
            catch (Exception ex) { _logger.LogWarning("[AiAssistant] Không thể load memories: {Msg}", ex.Message); }

            string persona = isLeader
                ? $"Bạn là Trợ lý AI của phần mềm Quản lý Công văn (cơ quan Nhà nước).\nNgười đang nói chuyện với bạn là Sếp/Lãnh đạo của cơ quan (Tên: {userName}).\nPhong thái: Kính trọng, báo cáo ngắn gọn, đi thẳng vào vấn đề.\nXưng hô: Đại từ của bạn là 'Em' hoặc 'AI', gọi người dùng là 'Sếp' hoặc 'Thủ trưởng'.\nLuôn dạ vâng lễ phép (ví dụ: Dạ vâng ạ, Em xin báo cáo sếp...)."
                : $"Bạn là Trợ lý AI của phần mềm Quản lý Công văn (cơ quan Nhà nước).\nNgười đang nói chuyện với bạn là Cán bộ/Văn thư (Tên: {userName}).\nPhong thái: Trực diện, chuyên nghiệp, hỗ trợ nghiệp vụ, lịch sự.\nXưng hô: Đại từ của bạn là 'Tôi', gọi người dùng là 'Đồng chí'.\nLuôn dùng từ ngữ chuẩn mực cơ quan Nhà nước (ví dụ: Chào đồng chí, Báo cáo đồng chí...).";

            var now = DateTime.UtcNow.AddHours(7);
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

            var systemPrompt = $@"{persona}
Hôm nay là {now:dd/MM/yyyy HH:mm:ss}.{documentContext}{memorySection}
Nhiệm vụ của bạn là trả lời thân thiện theo đúng phong thái trên và hỗ trợ công việc. LUÔN BẮT ĐẦU bằng lời xưng hô (ví dụ: Dạ báo cáo sếp, Chào đồng chí...).

LƯU Ý CỰC KỲ QUAN TRỌNG ĐỂ TRÁNH BỊA ĐẶT (HALLUCINATION):
1. TUYỆT ĐỐI KHÔNG tự bịa ra ngày tháng, số liệu, tên cơ quan, hoặc địa danh.
2. CHỈ sử dụng chính xác các con số và ngày tháng xuất hiện trong nội dung văn bản.
3. Nếu văn bản bị lỗi font (OCR rác), hãy tóm tắt phần nội dung đọc được ở bên dưới.
4. Nếu người dùng hỏi thông tin không có trong văn bản, BẮT BUỘC trả lời: ""Dạ, trong văn bản không đề cập đến thông tin này.""

KHOJ Idea #4 — ReAct (Reasoning and Acting):
Trước khi gọi bất kỳ công cụ (tool) nào, hoặc đưa ra câu trả lời cuối cùng, hãy TỰ SUY LUẬN (Thought Process) để đảm bảo kết quả chính xác nhất. Nếu cần gọi nhiều tool, hãy gọi lần lượt.

KHOJ Idea #8 — INLINE CITATION (TRÍCH DẪN NỐI TUYẾN):
Khi trả lời dựa vào dữ liệu từ công văn cụ thể, BẮT BUỘC trích dẫn theo format: (Công văn số X/YYY-ZZZ, ngày DD/MM/YYYY).
KHÔNG được viết trái lời chung chung khi đã có dữ liệu cụ thể.

NẾU người dùng yêu cầu nhắc nhở công việc, bạn BẮT BUỘC phải đính kèm tag sau vào CUỐI câu trả lời:
[REMINDER|YYYY-MM-DD HH:mm:ss|Nội dung việc cần nhắc]

NẾU người dùng nói 'hãy nhớ...', 'ghi nhớ rằng...', 'nhớ giúp tôi...', bạn BẮT BUỘC phải đính kèm tag sau vào CUỐI câu trả lời:
[STORE_MEMORY|Nội dung cần ghi nhớ]

Lưu ý: Không dùng JSON. Chỉ trả lời bằng Markdown bình thường và thêm tag đặc biệt ở cuối nếu cần.";

            // DIFY Idea #3: Token-Aware Memory — Cắt tỉa history theo số ký tự
            List<ChatMessageDto> history = new();
            try
            {
                var fullHistory = _chatHistoryRepo.GetHistoryByUserId(userId, 20);
                int totalChars = 0;
                foreach (var msg in fullHistory.AsEnumerable().Reverse())
                {
                    totalChars += msg.Content.Length;
                    if (totalChars > 3000) break;
                    history.Insert(0, msg);
                }
            }
            catch (Exception ex) { _logger.LogWarning("[AiAssistant] Không thể đọc lịch sử: {Msg}", ex.Message); }

            var messages = new List<object> { new { role = "system", content = systemPrompt } };
            foreach (var msg in history)
                messages.Add(new { role = msg.Role, content = msg.Content });
            messages.Add(new { role = "user", content = message });

            var tools = _toolRegistry.GetToolsSchema().ToArray();

            using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(90));

            // ============================================================
            // ANYTHINGLLM Idea #1: N-Hop Tool Chain
            // Vòng lặp agent — tối đa MaxToolCalls lượt, thay vì 2-hop cứng
            // ============================================================
            // ANYTHINGLLM Idea #2: Tool Dedup Guard — tránh gọi cùng tool 2+ lần
            var toolCallCount = new Dictionary<string, int>();
            bool foundFinalResponse = false;
            string? finalTextNoStream = null;

            for (int hop = 0; hop <= MaxToolCalls; hop++)
            {
                bool isLastHop = (hop == MaxToolCalls);

                // Nếu đây là hop cuối cùng, bỏ tools để buộc AI sinh text
                var requestBody = isLastHop
                    ? (object)new { model = _modelName, messages = messages, stream = false }
                    : (object)new { model = _modelName, messages = messages, stream = false, tools = tools };

                HttpResponseMessage? response1 = null;
                bool connectionError = false;
                bool isTimeout = false;

                try
                {
                    var req = new HttpRequestMessage(HttpMethod.Post, _ollamaUrl)
                    {
                        Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
                    };
                    response1 = await _httpClient.SendAsync(req, cts.Token);
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
                    yield return isLeader
                        ? "Dạ báo cáo sếp, hệ thống AI đang quá tải, xin sếp thử lại sau ạ."
                        : "Hệ thống AI đang bận, đồng chí vui lòng thử lại sau.";
                    yield break;
                }
                if (connectionError)
                {
                    yield return "Dạ báo cáo, hệ thống AI đang gặp sự cố kết nối.";
                    yield break;
                }
                if (!response1!.IsSuccessStatusCode)
                {
                    _logger.LogError("[AiAssistant] Ollama trả lỗi HTTP {Code}", (int)response1.StatusCode);
                    yield return "Dạ báo cáo, hệ thống AI đang gặp sự cố. Đề nghị kiểm tra lại dịch vụ Ollama trên server.";
                    yield break;
                }

                var result1 = await response1.Content.ReadAsStringAsync();
                using var doc1 = JsonDocument.Parse(result1);
                var msgNode = doc1.RootElement.GetProperty("message");

                bool hasToolCalls = msgNode.TryGetProperty("tool_calls", out var toolCallsNode)
                    && toolCallsNode.ValueKind == JsonValueKind.Array
                    && toolCallsNode.GetArrayLength() > 0;

                if (!hasToolCalls)
                {
                    // AI đã sinh text → exit loop
                    finalTextNoStream = msgNode.GetProperty("content").GetString()?.Trim() ?? "";
                    foundFinalResponse = true;
                    break;
                }

                // Có tool calls → xử lý từng tool
                _logger.LogInformation("[AiAssistant] Hop {Hop}: Tool Calling detected.", hop + 1);
                
                // Tránh lỗi "Cannot access a disposed object" khi doc1 bị dispose ở cuối vòng lặp
                messages.Add(JsonSerializer.Deserialize<object>(msgNode.GetRawText())!);

                foreach (var toolCall in toolCallsNode.EnumerateArray())
                {
                    var func = toolCall.GetProperty("function");
                    var name = func.GetProperty("name").GetString() ?? "unknown";
                    string args = func.TryGetProperty("arguments", out var argNode) ? argNode.GetRawText() : "{}";

                    // ANYTHINGLLM Idea #2: Tool Dedup Guard
                    toolCallCount.TryGetValue(name, out int prevCount);
                    if (prevCount >= 2)
                    {
                        _logger.LogWarning("[AiAssistant] Tool Dedup Guard: {Name} đã được gọi {Count} lần, bỏ qua.", name, prevCount);
                        messages.Add(new { role = "tool", content = $"Tool '{name}' đã được gọi quá nhiều lần. Hãy tổng hợp kết quả hiện có và trả lời người dùng." });
                        continue;
                    }
                    toolCallCount[name] = prevCount + 1;

                    string toolResult;
                    _logger.LogInformation("[AiAssistant] Executing Tool: {Name} (lần {Count})", name, toolCallCount[name]);

                    var dictArgs = new Dictionary<string, object>();
                    try
                    {
                        var argsObj = JsonDocument.Parse(args);
                        foreach (var prop in argsObj.RootElement.EnumerateObject())
                        {
                            dictArgs[prop.Name] = prop.Value.ValueKind switch
                            {
                                JsonValueKind.String => prop.Value.GetString() ?? "",
                                JsonValueKind.Number => prop.Value.GetDouble(),
                                JsonValueKind.True => true,
                                JsonValueKind.False => false,
                                JsonValueKind.Array => prop.Value.Clone(), // Lưu element clone cho Array
                                _ => prop.Value.GetRawText()
                            };
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("[AiAssistant] Lỗi parse JSON arguments: {Msg}", ex.Message);
                    }

                    if (_toolRegistry.HasTool(name))
                    {
                        toolResult = await _toolRegistry.ExecuteToolAsync(name, dictArgs);
                    }
                    else
                    {
                        toolResult = $"Tool '{name}' không tồn tại trong hệ thống.";
                    }

                    messages.Add(new { role = "tool", content = toolResult });
                }
            }

            if (!foundFinalResponse || finalTextNoStream == null)
            {
                // Fallback: nếu vòng lặp kết thúc mà không có text
                finalTextNoStream = isLeader
                    ? "Dạ báo cáo sếp, em đã xử lý xong nhưng không tổng hợp được kết quả. Xin sếp thử lại ạ."
                    : "Xin lỗi đồng chí, tôi không thể tổng hợp kết quả lúc này. Vui lòng thử lại.";
            }

            // ============================================================
            // HOP CUỐI: Sinh text streaming từ kết quả tổng hợp
            // ============================================================
            messages.Add(new { role = "assistant", content = finalTextNoStream });

            // Đảm bảo LUÔN CÓ từ thưa gửi
            var lowerReply = finalTextNoStream.ToLower();
            if (!lowerReply.Contains("dạ") && !lowerReply.Contains("báo cáo") && !lowerReply.Contains("chào"))
            {
                string greeting = isLeader ? "Dạ báo cáo sếp,\n" : "Chào đồng chí,\n";
                finalTextNoStream = greeting + finalTextNoStream;
            }

            // Stream text về client từng chunk
            foreach (var chunk in SplitIntoChunks(finalTextNoStream, 50))
                yield return chunk;

            // Xử lý tags đặc biệt
            string finalReplyForChat = await HandleSpecialTagsAsync(finalTextNoStream, userId);

            try { _chatHistoryRepo.AddMessage(userId, "assistant", finalReplyForChat); }
            catch (Exception ex) { _logger.LogWarning("[AiAssistant] Không thể lưu tin nhắn assistant: {Msg}", ex.Message); }
        }

        /// <summary>
        /// ANYTHINGLLM Idea #5: Xử lý tag [STORE_MEMORY|...] để ghi nhớ dài hạn
        /// Đồng thời xử lý tag [REMINDER|...] như cũ
        /// </summary>
        private async Task<string> HandleSpecialTagsAsync(string finalReply, int userId)
        {
            string result = finalReply;

            // Handle STORE_MEMORY tag
            var memMatch = Regex.Match(finalReply, @"\[STORE_MEMORY\|(.*?)\]");
            if (memMatch.Success)
            {
                var content = memMatch.Groups[1].Value.Trim();
                if (!string.IsNullOrWhiteSpace(content))
                {
                    try
                    {
                        var vector = await _embeddingService.GenerateEmbeddingAsync(content);
                        await _memoryRepo.StoreMemoryAsync(userId, content, vector);
                        _logger.LogInformation("[AiAssistant] Đã lưu memory: {Content}", content);
                    }
                    catch (Exception ex) { _logger.LogWarning("[AiAssistant] Lỗi lưu memory: {Msg}", ex.Message); }
                }
                result = result.Replace(memMatch.Value, "").Trim();
            }

            // Handle REMINDER tag (giữ nguyên logic cũ)
            result = HandleReminderTag(result, userId);

            return result;
        }

        private string HandleReminderTag(string finalReply, int userId)
        {
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
                        _logger.LogInformation("[AiAssistant] Đã lưu nhắc nhở: {Content} lúc {At}", content, remindAt);
                    }
                    catch (Exception ex) { _logger.LogWarning("[AiAssistant] Lỗi lưu reminder: {Msg}", ex.Message); }
                }
                finalReplyForChat = finalReply.Replace(match.Value, "").Trim();
            }
            return finalReplyForChat;
        }

        /// <summary>Tách chuỗi dài thành chunks để stream về client</summary>
        private static IEnumerable<string> SplitIntoChunks(string text, int chunkSize)
        {
            for (int i = 0; i < text.Length; i += chunkSize)
                yield return text.Substring(i, Math.Min(chunkSize, text.Length - i));
        }
    }
}
