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
        private readonly ISemanticRouterService _semanticRouter;
        private readonly IAiSemanticCacheRepository _semanticCacheRepo;
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
            ISemanticRouterService semanticRouter,
            IAiSemanticCacheRepository semanticCacheRepo,
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
            _semanticRouter = semanticRouter;
            _semanticCacheRepo = semanticCacheRepo;
            _logger = logger;
        }

        public async IAsyncEnumerable<string> ProcessChatStreamAsync(int userId, string message, int? documentId = null)
        {
            // Xử lý fake-stream để flush headers ngay lập tức, tắt trạng thái "đang tải" của frontend
            yield return "(Đang phân tích yêu cầu...)\n\n";

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
                var memoryVector = await _embeddingService.GenerateEmbeddingAsync(message);
                List<UserMemoryResult> memories = new();
                if (memoryVector != null && memoryVector.Length > 0)
                    memories = await _memoryRepo.RecallMemoriesAsync(userId, memoryVector, topK: 5, minScore: 0.25f);
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

            // Semantic Caching & Routing
            float[]? questionVector = null;
            string? cacheHitResponse = null; // CS1626 fix: không yield trong try-catch
            try
            {
                questionVector = await _embeddingService.GenerateEmbeddingAsync(message);
                if (questionVector != null && questionVector.Length > 0)
                {
                    // 1. Semantic Cache
                    var cachedResponse = await _semanticCacheRepo.GetCachedResponseAsync(questionVector, 0.85f);
                    if (!string.IsNullOrEmpty(cachedResponse))
                    {
                        _logger.LogInformation("[AiAssistant] CACHE HIT! Trả về từ AiSemanticCache.");
                        string finalReplyForChatCache = await HandleSpecialTagsAsync(cachedResponse, userId);
                        try { _chatHistoryRepo.AddMessage(userId, "assistant", finalReplyForChatCache); }
                        catch (Exception ex) { _logger.LogWarning("[AiAssistant] Lỗi lưu tin nhắn assistant: {Msg}", ex.Message); }
                        cacheHitResponse = cachedResponse; // Lưu lại, yield bên ngoài try
                    }
                }
            }
            catch (Exception ex) { _logger.LogWarning("[AiAssistant] Lỗi xử lý Caching: {Msg}", ex.Message); }

            // CS1626: yield phải nằm ngoài try-catch block
            if (cacheHitResponse != null)
            {
                foreach (var chunk in SplitIntoChunks(cacheHitResponse, 50))
                    yield return chunk;
                yield break;
            }

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

                    // === RAG Context Compression (học từ gpt-researcher ContextCompressor) ===
                    // Thay vì cắt thủ công 3000 ký tự, gọi Python AI Service để lấy
                    // các đoạn liên quan nhất đến câu hỏi của user (cosine similarity >= 0.65)
                    if (!string.IsNullOrWhiteSpace(doc.FullText))
                    {
                        try
                        {
                            var compressPayload = new
                            {
                                query = message,
                                documents = new[]
                                {
                                    new
                                    {
                                        text = doc.FullText,
                                        title = doc.TenCongVan ?? "",
                                        date = doc.NgayBanHanh ?? "",
                                        source = doc.SoVanBan ?? "",
                                        id = doc.Id
                                    }
                                },
                                max_results = 5
                            };

                            using var compressClient = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
                            var compressJson = System.Text.Json.JsonSerializer.Serialize(compressPayload);
                            var compressContent = new StringContent(compressJson, System.Text.Encoding.UTF8, "application/json");
                            var compressResp = await compressClient.PostAsync("http://python-ai-service:8001/api/compress", compressContent);

                            if (compressResp.IsSuccessStatusCode)
                            {
                                var compressResult = System.Text.Json.JsonSerializer.Deserialize<CompressApiResponse>(
                                    await compressResp.Content.ReadAsStringAsync(),
                                    new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                                );
                                if (!string.IsNullOrWhiteSpace(compressResult?.ContextString))
                                {
                                    documentContext += $"\n\nCác đoạn nội dung liên quan nhất:\n{compressResult.ContextString}";
                                    _logger.LogInformation("[AiAssistant] Compressed context: {ChunkCount} chunks for doc #{DocId}", compressResult.Chunks?.Length ?? 0, doc.Id);
                                }
                                else
                                {
                                    // Fallback: dùng substring nếu compress không có kết quả
                                    var text = doc.FullText;
                                    if (text.Length > 3000) text = text.Substring(0, 3000) + "\n...[Nội dung đã được cắt bớt]...";
                                    documentContext += $"\nNội dung toàn văn:\n\"\"\"{text}\"\"\"";
                                }
                            }
                            else
                            {
                                // Fallback
                                var text = doc.FullText;
                                if (text.Length > 3000) text = text.Substring(0, 3000) + "\n...[Nội dung đã được cắt bớt]...";
                                documentContext += $"\nNội dung toàn văn:\n\"\"\"{text}\"\"\"";
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning("[AiAssistant] Compress API failed, using fallback: {Msg}", ex.Message);
                            var text = doc.FullText;
                            if (text.Length > 3000) text = text.Substring(0, 3000) + "\n...[Nội dung đã được cắt bớt]...";
                            documentContext += $"\nNội dung toàn văn:\n\"\"\"{text}\"\"\"";
                        }
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
Khi nhắc đến công văn, BẮT BUỘC chèn liên kết bằng định dạng: [DOC|Id|Tên công văn]. Ví dụ: [DOC|12|Báo cáo công tác tháng 8].
KHÔNG được viết trả lời chung chung khi đã có dữ liệu cụ thể.

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

            // 2. Semantic Routing (Fast-path)
            bool skipToolLoop = false;
            try
            {
                if (questionVector != null && questionVector.Length > 0)
                {
                    string? routedTool = await _semanticRouter.RouteQueryAsync(questionVector);
                    if (!string.IsNullOrEmpty(routedTool))
                    {
                        _logger.LogInformation("[AiAssistant] SEMANTIC ROUTING HIT: {Tool}", routedTool);
                        
                        // Fake user message
                        messages.Add(new { role = "user", content = message });
                        
                        // Execute tool directly
                        var dictArgs = new Dictionary<string, object>();
                        if (routedTool == "search_documents_by_condition")
                        {
                            // Đẩy thẳng raw query vào keyword để search cơ bản
                            dictArgs["keyword"] = message;
                        }
                        
                        string toolResult = await _toolRegistry.ExecuteToolAsync(routedTool, dictArgs);
                        
                        // Thêm fake tool call và tool result vào context để AI sinh text ngay lập tức
                        messages.Add(new { 
                            role = "assistant", 
                            content = "", 
                            tool_calls = new[] { 
                                new { 
                                    function = new { name = routedTool, arguments = JsonSerializer.Serialize(dictArgs) } 
                                } 
                            } 
                        });
                        messages.Add(new { role = "tool", content = toolResult });
                        
                        skipToolLoop = true;
                    }
                }
            }
            catch (Exception ex) { _logger.LogWarning("[AiAssistant] Lỗi Semantic Routing: {Msg}", ex.Message); }

            if (!skipToolLoop)
            {
                messages.Add(new { role = "user", content = message });
            }

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
                bool isLastHop = skipToolLoop || (hop == MaxToolCalls);

                // Nếu đây là hop cuối cùng, bỏ tools để buộc AI sinh text
                var requestBody = isLastHop
                    ? (object)new { model = _modelName, messages = messages, stream = false }
                    : (object)new { model = _modelName, messages = messages, stream = false, tools = tools };

                HttpResponseMessage? response1 = null;
                bool connectionError = false;
                bool isTimeout = false;

                int retryCount = 0;
                const int MaxRetries = 1;

                while (retryCount <= MaxRetries)
                {
                    try
                    {
                        var req = new HttpRequestMessage(HttpMethod.Post, _ollamaUrl)
                        {
                            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
                        };
                        response1 = await _httpClient.SendAsync(req, cts.Token);
                        
                        if (response1.IsSuccessStatusCode)
                        {
                            connectionError = false;
                            isTimeout = false;
                            break;
                        }
                    }
                    catch (System.Threading.Tasks.TaskCanceledException)
                    {
                        _logger.LogWarning("[AiAssistant] Ollama timeout. Retry {Count}/{Max}", retryCount, MaxRetries);
                        isTimeout = true;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError("[AiAssistant] Lỗi gọi Ollama: {Msg}. Retry {Count}/{Max}", ex.Message, retryCount, MaxRetries);
                        connectionError = true;
                    }

                    retryCount++;
                    if (retryCount <= MaxRetries)
                    {
                        try { await Task.Delay(2000, cts.Token); } catch { break; }
                    }
                }

                if (isTimeout || connectionError || response1 == null || !response1.IsSuccessStatusCode)
                {
                    if (response1 != null && !response1.IsSuccessStatusCode)
                    {
                        _logger.LogError("[AiAssistant] Ollama trả lỗi HTTP {Code}", (int)response1.StatusCode);
                    }
                    
                    _logger.LogWarning("[AiAssistant] Ollama failed after retries. Graceful degradation.");
                    
                    yield return isLeader 
                        ? "Dạ báo cáo sếp, hệ thống AI hiện đang xử lý khối lượng lớn tài liệu nên bị quá tải. Sếp vui lòng thử lại sau vài giây nhé ạ!" 
                        : "Hệ thống AI hiện đang xử lý khối lượng lớn tài liệu nên bị quá tải. Đồng chí vui lòng thử lại sau vài giây nhé!";
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
                
                yield return $"(Đang tra cứu hệ thống...)\n\n";

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

            // Lưu vào Semantic Cache để tái sử dụng
            if (questionVector != null && questionVector.Length > 0 && !string.IsNullOrWhiteSpace(finalTextNoStream))
            {
                try 
                {
                    await _semanticCacheRepo.StoreCacheAsync(questionVector, finalTextNoStream);
                    _logger.LogInformation("[AiAssistant] Đã lưu response vào AiSemanticCache.");
                }
                catch (Exception ex) { _logger.LogWarning("[AiAssistant] Lỗi lưu Cache: {Msg}", ex.Message); }
            }
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

    /// <summary>
    /// Response DTO từ Python AI Service /api/compress endpoint
    /// Học từ gpt-researcher ContextCompressor pattern
    /// </summary>
    internal class CompressApiResponse
    {
        public object[]? Chunks { get; set; }
        public string? ContextString { get; set; }
        public int TotalChunksEvaluated { get; set; }
    }
}
