using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;
using System.Linq;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ToolCalendar.Core.Services
{
    public class DocumentReference
    {
        public string Title { get; set; } = "";
        public string Url { get; set; } = "";
        public string Snippet { get; set; } = "";
        public string Source { get; set; } = "";
    }

    public interface IAiReferenceService
    {
        Task<List<DocumentReference>> FindReferencesAsync(string fullText, string documentTitle);
    }

    public class AiReferenceService : IAiReferenceService
    {
        private readonly HttpClient _httpClient;
        private readonly string _ollamaUrl;
        private readonly string _modelName;
        private readonly ILogger<AiReferenceService> _logger;
        private readonly string? _tavilyApiKey;

        private static readonly string[] PrioritySites = new[]
        {
            "thuvienphapluat.vn",
            "vanban.chinhphu.vn",
            "chinhphu.vn",
            "moj.gov.vn",
            "quangninh.gov.vn",
        };

        public AiReferenceService(HttpClient httpClient, IConfiguration config, ILogger<AiReferenceService> logger)
        {
            _httpClient = httpClient;
            _httpClient.Timeout = TimeSpan.FromSeconds(100);
            _ollamaUrl = config.GetValue<string>("Ollama:ChatUrl") ?? "http://127.0.0.1:11434/api/chat";
            _modelName = config.GetValue<string>("Ollama:Model") ?? "qwen2.5:1.5b";
            _tavilyApiKey = config.GetValue<string>("Tavily:ApiKey") ?? config.GetValue<string>("TAVILY_API_KEY");
            _logger = logger;
        }

        public async Task<List<DocumentReference>> FindReferencesAsync(string fullText, string documentTitle)
        {
            var results = new List<DocumentReference>();

            try
            {
                var keywords = await ExtractKeywordsAsync(fullText, documentTitle);
                _logger.LogInformation("[AiReference] Keywords: {Keywords}", string.Join(", ", keywords));

                foreach (var keyword in keywords)
                {
                    var siteResults = await SearchTavilyAsync(keyword, PrioritySites);
                    results.AddRange(siteResults);
                }

                // Loại bỏ kết quả trùng lặp URL và lấy tối đa 12 kết quả
                results = results.DistinctBy(x => x.Url).Take(12).ToList();

                if (results.Count == 0 && keywords.Count > 0)
                    results.AddRange(BuildFallbackLinks(keywords));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AiReference] Error finding references");
                results.AddRange(BuildFallbackLinks(new List<string> { documentTitle }));
            }

            return results;
        }

        private async Task<List<string>> ExtractKeywordsAsync(string fullText, string documentTitle)
        {
            try
            {
                var textSample = fullText?.Length > 1500 ? fullText[..1500] : fullText ?? documentTitle;

                var prompt = $@"Bạn là AI chuyên trích xuất từ khóa tìm kiếm (Search Query Generator) giống như các hệ thống Khoj/Perplexity. 
Nhiệm vụ của bạn là đọc văn bản/câu hỏi sau và trích xuất ra 1-2 TỪ KHÓA (keywords) CỐT LÕI NHẤT để tra cứu trên trang Thư viện Pháp luật.

QUY TẮC BẮT BUỘC (NẾU VI PHẠM SẼ BỊ PHẠT):
- Tuyệt đối không đặt câu hỏi hoặc dùng câu dài (VD: sai: 'Nghị định nào liên quan đến...', sai: 'Tôi muốn tìm...').
- Từ khóa phải cực kỳ ngắn gọn, tập trung vào danh từ, số hiệu, tên luật pháp (VD: 'Luật Đất đai 2024', 'Nghị định 15/2020/NĐ-CP', 'Nghị quyết 01').
- Mỗi từ khóa trên 1 dòng, KHÔNG đánh số thứ tự, KHÔNG giải thích.

Văn bản/Câu hỏi: {textSample}

Từ khóa:";

                var requestBody = new
                {
                    model = _modelName,
                    messages = new[] { new { role = "user", content = prompt } },
                    stream = false,
                    options = new { temperature = 0.2, num_predict = 150 }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(90));
                var response = await _httpClient.PostAsync(_ollamaUrl, content, cts.Token);
                var responseBody = await response.Content.ReadAsStringAsync(cts.Token);

                using var doc = JsonDocument.Parse(responseBody);
                var aiText = doc.RootElement.GetProperty("message").GetProperty("content").GetString() ?? "";

                var lines = aiText.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                var keywordsList = new List<string>();
                foreach(var line in lines)
                {
                    var k = line.Trim().Trim('"', '\'', '.', '-', '*', '1', '2', '3');
                    if (!string.IsNullOrWhiteSpace(k) && k.Length < 100 && !k.StartsWith("["))
                    {
                        keywordsList.Add(k);
                    }
                }
                if (keywordsList.Count > 0)
                {
                    return keywordsList.Take(3).ToList();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[AiReference] Ollama keyword extraction failed: {Msg}", ex.Message);
            }

            if (string.IsNullOrWhiteSpace(documentTitle) || documentTitle.Trim().ToUpper() == "CÔNG VĂN")
            {
                var fb = !string.IsNullOrWhiteSpace(fullText) && fullText.Length > 50 ? fullText[..50] : "văn bản pháp luật";
                return new List<string> { fb };
            }
            return new List<string> { documentTitle };
        }

        private async Task<List<DocumentReference>> SearchTavilyAsync(string keyword, string[] domains)
        {
            var refs = new List<DocumentReference>();
            
            if (string.IsNullOrWhiteSpace(_tavilyApiKey))
            {
                _logger.LogWarning("[AiReference] Tavily Api Key is missing!");
                return refs;
            }

            try
            {
                var requestBody = new
                {
                    api_key = _tavilyApiKey,
                    query = keyword,
                    search_depth = "basic",
                    include_domains = domains,
                    max_results = 5
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
                var response = await _httpClient.PostAsync("https://api.tavily.com/search", content, cts.Token);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorMsg = await response.Content.ReadAsStringAsync(cts.Token);
                    _logger.LogWarning("[AiReference] Tavily error: {Code} - {Msg}", response.StatusCode, errorMsg);
                    return refs;
                }

                var responseBody = await response.Content.ReadAsStringAsync(cts.Token);
                using var doc = JsonDocument.Parse(responseBody);
                
                if (doc.RootElement.TryGetProperty("results", out var results))
                {
                    foreach (var result in results.EnumerateArray())
                    {
                        var title = result.GetProperty("title").GetString() ?? "";
                        var url = result.GetProperty("url").GetString() ?? "";
                        var snippet = result.GetProperty("content").GetString() ?? "";
                        
                        var uri = new Uri(url);
                        var source = uri.Host.Replace("www.", "");

                        refs.Add(new DocumentReference
                        {
                            Title = title,
                            Url = url,
                            Snippet = snippet,
                            Source = source
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[AiReference] Tavily API failed: {Msg}", ex.Message);
            }
            return refs;
        }

        private static List<DocumentReference> BuildFallbackLinks(List<string> keywords)
        {
            var refs = new List<DocumentReference>();
            var keyword = keywords.Count > 0 ? keywords[0] : "van ban phap luat";
            var encoded = HttpUtility.UrlEncode(keyword);

            refs.Add(new DocumentReference
            {
                Title = $"Tim \"{keyword}\" tren Thu vien Phap luat",
                Url = $"https://thuvienphapluat.vn/tim-van-ban.aspx?keyword={encoded}",
                Snippet = "Tra cuu van ban phap luat, quyet dinh, nghi dinh, thong tu lien quan.",
                Source = "thuvienphapluat.vn"
            });

            refs.Add(new DocumentReference
            {
                Title = $"Tim \"{keyword}\" tren Cong VBPQ Chinh phu",
                Url = $"https://vanban.chinhphu.vn/?pageid=27160&search={encoded}",
                Snippet = "He thong van ban phap luat cua Chinh phu Viet Nam.",
                Source = "vanban.chinhphu.vn"
            });

            refs.Add(new DocumentReference
            {
                Title = $"Tim \"{keyword}\" tren Bo Tu phap",
                Url = $"https://moj.gov.vn/Pages/van-ban-phap-luat.aspx?search={encoded}",
                Snippet = "Van ban phap luat chinh thuc cua Bo Tu phap.",
                Source = "moj.gov.vn"
            });

            return refs;
        }
    }
}
