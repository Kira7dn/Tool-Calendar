using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Core.Services;
using ToolCalendar.Services;

namespace ToolCalendar.Core.Services.AiTools
{
    public class SearchDocumentContentTool : IAiTool
    {
        private readonly IDocumentChunkRepository _chunkRepo;
        private readonly IOllamaEmbeddingService _embeddingService;
        private readonly IDocumentRepository _documentRepo;
        private readonly ISettingRepository _settingRepo;
        private readonly IPythonAiService _pythonAiService;

        public SearchDocumentContentTool(
            IDocumentChunkRepository chunkRepo,
            IOllamaEmbeddingService embeddingService,
            IDocumentRepository documentRepo,
            ISettingRepository settingRepo,
            IPythonAiService pythonAiService)
        {
            _chunkRepo = chunkRepo;
            _embeddingService = embeddingService;
            _documentRepo = documentRepo;
            _settingRepo = settingRepo;
            _pythonAiService = pythonAiService;
        }

        public string Name => "search_document_content";
        public string Description => "Tìm kiếm chi tiết nội dung công văn. Dùng khi sếp hỏi các câu cụ thể về nội dung, quy định, luật pháp, thời hạn, hoặc yêu cầu tìm công văn cụ thể.";

        public object ParametersSchema => new
        {
            type = "object",
            properties = new
            {
                keyword = new
                {
                    type = "string",
                    description = "Từ khóa cần tìm kiếm (bắt buộc)"
                },
                so_hieu = new
                {
                    type = "string",
                    description = "Số hiệu công văn nếu có (ví dụ: '123/UBND', '22/KH')"
                },
                ngay_ban_hanh = new
                {
                    type = "string",
                    description = "Ngày ban hành nếu có (ví dụ: '15/08', '2023')"
                }
            },
            required = new[] { "keyword" }
        };

        public async Task<string> ExecuteAsync(Dictionary<string, object> arguments)
        {
            try
            {
                if (!arguments.TryGetValue("keyword", out var kwObj) || kwObj == null)
                    return "Thiếu tham số keyword.";

                string keyword = kwObj.ToString() ?? "";
                string? soHieu = arguments.TryGetValue("so_hieu", out var shObj) ? shObj?.ToString() : null;
                string? ngayBanHanh = arguments.TryGetValue("ngay_ban_hanh", out var ngObj) ? ngObj?.ToString() : null;

                float simThreshold = 0.20f;
                var settingVal = _settingRepo.GetAppSetting("AiSimilarityThreshold", "0.20");
                if (float.TryParse(settingVal, out var t)) simThreshold = t;

                // ============================================================
                // ANYTHINGLLM Idea #4: Multi-Query Expansion + Vector Dedup
                // ============================================================
                var queryVariants = GenerateQueryVariants(keyword);

                // Embed tất cả variants song song
                var embedTasks = queryVariants.Select(q => _embeddingService.GenerateEmbeddingAsync(q));
                var embeds = await Task.WhenAll(embedTasks);

                // ============================================================
                // KHOJ / GPT-Researcher: Hypothetical Document Embeddings (HyDE)
                // Sinh hypothetical document bằng LLM, dùng vector đó để search
                // Cải thiện recall đáng kể vì "document vector" gần hơn "chunk vector"
                // ============================================================
                var hydeTask = _pythonAiService.HyDEAsync(keyword);

                // Gom tất cả kết quả từ mọi variant
                var allChunks = new List<DocumentChunkResult>();

                for (int i = 0; i < queryVariants.Count; i++)
                {
                    var qv = queryVariants[i];
                    var qvec = embeds[i];
                    if (qvec == null || qvec.Length == 0) continue;

                    List<DocumentChunkResult> qResults;
                    if (i == 0)
                    {
                        // Query gốc → Hybrid Search (BM25 + Vector)
                        qResults = await _chunkRepo.FindHybridChunksAsync(
                            qv, qvec, topK: 5, minSimilarityScore: simThreshold,
                            soHieu: soHieu, ngayBanHanh: ngayBanHanh);
                    }
                    else
                    {
                        // Variants → Semantic Search thuần
                        qResults = await _chunkRepo.FindSimilarChunksAsync(qvec, topK: 3, minSimilarityScore: simThreshold);
                    }
                    allChunks.AddRange(qResults);
                }

                // HyDE search — thêm kết quả từ hypothetical document vector
                var hydeResult = await hydeTask;
                if (hydeResult != null && hydeResult.Vector.Count > 0)
                {
                    var hydeVec = hydeResult.Vector.ToArray();
                    var hydeChunks = await _chunkRepo.FindSimilarChunksAsync(hydeVec, topK: 3, minSimilarityScore: simThreshold);
                    allChunks.AddRange(hydeChunks);
                }

                // Vector Dedup: mỗi TextContent chỉ giữ lại record có score cao nhất
                var distinctChunks = allChunks
                    .GroupBy(c => c.TextContent.Trim())
                    .Select(g => g.OrderByDescending(c => c.SimilarityScore).First())
                    .OrderByDescending(c => c.SimilarityScore)
                    .Take(6)
                    .ToList();

                // Fallback về Keyword Search nếu không tìm được gì
                if (distinctChunks.Count == 0)
                    distinctChunks = await _chunkRepo.FindByKeywordAsync(keyword, topK: 5);

                if (distinctChunks.Count == 0)
                {
                    return "KHÔNG_TÌM_THẤY: Không có nội dung phù hợp trong cơ sở dữ liệu công văn. " +
                           "Hãy thông báo cho người dùng rằng hệ thống không tìm thấy thông tin liên quan, và không được tự bịa đặt.";
                }

                var sb = new StringBuilder();
                foreach (var c in distinctChunks)
                {
                    var doc = await _documentRepo.GetDocumentByIdAsync(c.DocumentId);
                    string metadata = $"Ngày BH: {doc?.NgayBanHanh?.ToString("dd/MM/yyyy") ?? "Không rõ"} | Cơ quan BH: {doc?.CoQuanBanHanh ?? "Không rõ"}";
                    sb.AppendLine($"[DOC|{doc?.Id}|Công văn số {doc?.SoVanBan ?? c.DocumentId.ToString()}] ({metadata}): {c.TextContent}");
                }
                return sb.ToString();
            }
            catch (Exception ex)
            {
                return "Lỗi khi tìm kiếm dữ liệu: " + ex.Message;
            }
        }

        /// <summary>
        /// ANYTHINGLLM Idea #4: Sinh các biến thể query bằng rule-based transformations.
        /// Không cần gọi LLM — nhanh, không tốn tài nguyên, hiệu quả với tiếng Việt.
        /// </summary>
        private static List<string> GenerateQueryVariants(string keyword)
        {
            var variants = new List<string> { keyword };

            // Variant 2: Loại stop words, chỉ giữ danh từ/động từ quan trọng
            var stopWords = new HashSet<string>
            {
                "của", "và", "các", "là", "có", "được", "để", "trong", "về",
                "với", "theo", "từ", "đến", "này", "đó", "đã", "đang", "sẽ",
                "hãy", "bao", "nhiều", "tất", "cả", "hay", "hoặc", "khi", "nếu"
            };
            var tokens = keyword.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var coreTokens = tokens.Where(t => !stopWords.Contains(t) && t.Length > 2).ToArray();
            if (coreTokens.Length > 0 && coreTokens.Length < tokens.Length)
                variants.Add(string.Join(" ", coreTokens));

            // Variant 3: Thêm prefix ngữ cảnh công văn
            bool isQuestion = keyword.Contains("?") || keyword.StartsWith("hỏi") || keyword.StartsWith("tìm");
            if (isQuestion)
            {
                var cleaned = keyword.TrimEnd('?').TrimStart().Replace("hỏi ", "").Replace("tìm ", "");
                variants.Add("thông tin " + cleaned);
            }
            else
            {
                variants.Add("quy định " + keyword);
            }

            return variants.Distinct().Take(3).ToList();
        }
    }
}
