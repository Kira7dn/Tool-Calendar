using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ToolCalendar.Services
{
    public interface IPythonAiService
    {
        Task<DoclingExtractionResult> ExtractDocumentAsync(string filePath);
        Task<string> ExtractFastTextAsync(string filePath);
        Task<ChunkResponse> ChunkDocumentAsync(ChunkRequest request);
        Task<BatchEmbedResponse> BatchEmbedAsync(BatchEmbedRequest request);
        Task<GenerateQAResponse> GenerateQAAsync(GenerateQARequest request);
        Task<HyDEResponse?> HyDEAsync(string question, string model = "qwen2.5:3b");
        Task<DocSummaryResult?> DocSummaryAsync(string text, string docTitle, string model = "qwen2.5:3b");
        Task<ContextualChunkResult?> ContextualChunkAsync(string chunkText, string docTitle, string docSummary, string model = "qwen2.5:3b");
        Task<DocumentMetadataResult?> ExtractMetadataAsync(string text, List<string> deadlineKeywords, List<string> excludeKeywords, string model = "qwen2.5:3b");
    }

    public class PythonAiService : IPythonAiService
    {
        private readonly HttpClient _httpClient;

        public PythonAiService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<DoclingExtractionResult> ExtractDocumentAsync(string filePath)
        {
            // Trỏ thẳng tới /app/Uploads trong container python-ai-service
            // vì container này đã mount volume giống như official-doc-backend
            string containerPath = filePath.StartsWith("Uploads/") ? $"/app/{filePath}" : filePath;

            var response = await _httpClient.PostAsJsonAsync("/api/extract", new { file_path = containerPath });
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<DoclingExtractionResult>();
            return result ?? new DoclingExtractionResult();
        }

        public async Task<string> ExtractFastTextAsync(string filePath)
        {
            try
            {
                string containerPath = filePath.StartsWith("Uploads/") ? $"/app/{filePath}" : filePath;
                var response = await _httpClient.PostAsJsonAsync("/api/extract-fast", new { file_path = containerPath });
                if (!response.IsSuccessStatusCode) return string.Empty;

                var result = await response.Content.ReadFromJsonAsync<ExtractFastResponse>();
                return result?.Text ?? string.Empty;
            }
            catch
            {
                return string.Empty;
            }
        }

        public async Task<ChunkResponse> ChunkDocumentAsync(ChunkRequest request)
        {
            var response = await _httpClient.PostAsJsonAsync("/api/chunk", request);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<ChunkResponse>();
            return result ?? new ChunkResponse();
        }

        public async Task<BatchEmbedResponse> BatchEmbedAsync(BatchEmbedRequest request)
        {
            var response = await _httpClient.PostAsJsonAsync("/api/embed/batch", request);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<BatchEmbedResponse>();
            return result ?? new BatchEmbedResponse();
        }

        public async Task<GenerateQAResponse> GenerateQAAsync(GenerateQARequest request)
        {
            var response = await _httpClient.PostAsJsonAsync("/api/generate-qa", request);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<GenerateQAResponse>();
            return result ?? new GenerateQAResponse();
        }

        public async Task<HyDEResponse?> HyDEAsync(string question, string model = "qwen2.5:3b")
        {
            try
            {
                var request = new { question, model };
                var response = await _httpClient.PostAsJsonAsync("/api/hyde", request);
                if (!response.IsSuccessStatusCode) return null;
                return await response.Content.ReadFromJsonAsync<HyDEResponse>();
            }
            catch
            {
                return null;
            }
        }

        public async Task<DocSummaryResult?> DocSummaryAsync(string text, string docTitle, string model = "qwen2.5:3b")
        {
            try
            {
                var request = new { text, doc_title = docTitle, model };
                var response = await _httpClient.PostAsJsonAsync("/api/doc-summary", request);
                if (!response.IsSuccessStatusCode) return null;
                return await response.Content.ReadFromJsonAsync<DocSummaryResult>();
            }
            catch
            {
                return null;
            }
        }

        public async Task<ContextualChunkResult?> ContextualChunkAsync(string chunkText, string docTitle, string docSummary, string model = "qwen2.5:3b")
        {
            try
            {
                var request = new { text = chunkText, doc_title = docTitle, doc_summary = docSummary, model };
                var response = await _httpClient.PostAsJsonAsync("/api/contextual-chunk", request);
                if (!response.IsSuccessStatusCode) return null;
                return await response.Content.ReadFromJsonAsync<ContextualChunkResult>();
            }
            catch
            {
                return null; // Optional enhancement, never block
            }
        }

        public async Task<DocumentMetadataResult?> ExtractMetadataAsync(string text, List<string> deadlineKeywords, List<string> excludeKeywords, string model = "qwen2.5:3b")
        {
            try
            {
                var request = new { text, deadline_keywords = deadlineKeywords, deadline_exclude_keywords = excludeKeywords, model };
                var response = await _httpClient.PostAsJsonAsync("/api/extract-metadata", request);
                if (!response.IsSuccessStatusCode) return null;
                return await response.Content.ReadFromJsonAsync<DocumentMetadataResult>();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error extracting metadata: {ex.Message}");
                return null;
            }
        }
    }

    // Models 
    public class DoclingExtractionResult
    {
        [JsonPropertyName("text")]
        public string Text { get; set; } = string.Empty;

        [JsonPropertyName("pages")]
        public List<DoclingPage> Pages { get; set; } = new List<DoclingPage>();
    }

    public class DoclingPage
    {
        [JsonPropertyName("page_no")]
        public int PageNo { get; set; }

        [JsonPropertyName("width")]
        public float Width { get; set; }

        [JsonPropertyName("height")]
        public float Height { get; set; }
    }

    public class ChunkRequest
    {
        [JsonPropertyName("text")]
        public string Text { get; set; } = string.Empty;

        [JsonPropertyName("doc_title")]
        public string DocTitle { get; set; } = string.Empty;

        [JsonPropertyName("doc_date")]
        public string DocDate { get; set; } = string.Empty;

        [JsonPropertyName("doc_source")]
        public string DocSource { get; set; } = string.Empty;

        [JsonPropertyName("doc_id")]
        public int? DocId { get; set; }

        [JsonPropertyName("chunk_size")]
        public int ChunkSize { get; set; } = 800;

        [JsonPropertyName("chunk_overlap")]
        public int ChunkOverlap { get; set; } = 100;
    }

    public class ChunkResponse
    {
        [JsonPropertyName("chunks")]
        public List<ChunkItem> Chunks { get; set; } = new List<ChunkItem>();

        [JsonPropertyName("total_chunks")]
        public int TotalChunks { get; set; }
    }

    public class ChunkItem
    {
        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;

        [JsonPropertyName("metadata")]
        public Dictionary<string, object> Metadata { get; set; } = new Dictionary<string, object>();
    }

    public class BatchEmbedRequest
    {
        [JsonPropertyName("texts")]
        public List<string> Texts { get; set; } = new List<string>();

        [JsonPropertyName("normalize")]
        public bool Normalize { get; set; } = true;
    }

    public class BatchEmbedResponse
    {
        [JsonPropertyName("vectors")]
        public List<List<float>> Vectors { get; set; } = new List<List<float>>();

        [JsonPropertyName("count")]
        public int Count { get; set; }
    }

    public class GenerateQARequest
    {
        [JsonPropertyName("text")]
        public string Text { get; set; } = string.Empty;

        [JsonPropertyName("model")]
        public string Model { get; set; } = "qwen2.5:3b";
    }

    public class GenerateQAResponse
    {
        [JsonPropertyName("qa_pairs")]
        public List<string> QaPairs { get; set; } = new List<string>();
    }

    public class HyDEResponse
    {
        [JsonPropertyName("hypothetical_document")]
        public string HypotheticalDocument { get; set; } = string.Empty;

        [JsonPropertyName("vector")]
        public List<float> Vector { get; set; } = new List<float>();
    }

    public class DocSummaryResult
    {
        [JsonPropertyName("summary")]
        public string Summary { get; set; } = string.Empty;

        [JsonPropertyName("summary_vector")]
        public List<float> SummaryVector { get; set; } = new List<float>();
    }

    public class ContextualChunkResult
    {
        [JsonPropertyName("contextual_text")]
        public string ContextualText { get; set; } = string.Empty;

        [JsonPropertyName("context_sentence")]
        public string ContextSentence { get; set; } = string.Empty;
    }

    public class DocumentMetadataResult
    {
        [JsonPropertyName("SoVanBan")]
        public string SoVanBan { get; set; } = string.Empty;

        [JsonPropertyName("TenCongVan")]
        public string TenCongVan { get; set; } = string.Empty;

        [JsonPropertyName("TrichYeu")]
        public string TrichYeu { get; set; } = string.Empty;

        [JsonPropertyName("NgayBanHanh")]
        public string NgayBanHanh { get; set; } = string.Empty;

        [JsonPropertyName("ThoiHan")]
        public string ThoiHan { get; set; } = string.Empty;

        [JsonPropertyName("CoQuanBanHanh")]
        public string CoQuanBanHanh { get; set; } = string.Empty;

        [JsonPropertyName("CoQuanChuQuan")]
        public string CoQuanChuQuan { get; set; } = string.Empty;

        [JsonPropertyName("Priority")]
        public string Priority { get; set; } = "Thường";
    }

    public class ExtractFastResponse
    {
        [JsonPropertyName("text")]
        public string Text { get; set; } = string.Empty;
    }
}
