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
        private readonly string _pythonAiUrl;

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
            _modelName = config.GetValue<string>("Ollama:Model") ?? "qwen2.5:0.5b";
            _tavilyApiKey = config.GetValue<string>("Tavily:ApiKey") ?? config.GetValue<string>("TAVILY_API_KEY");
            _pythonAiUrl = config.GetValue<string>("PythonAiServiceUrl") ?? "http://python-ai-service:8001";
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
                var requestBody = new
                {
                    text = fullText ?? "",
                    doc_title = documentTitle ?? "",
                    model = _modelName
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(60));
                var response = await _httpClient.PostAsync($"{_pythonAiUrl.TrimEnd('/')}/api/extract-keywords", content, cts.Token);
                
                if (response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync(cts.Token);
                    using var doc = JsonDocument.Parse(responseBody);
                    if (doc.RootElement.TryGetProperty("keywords", out var keywordsElement))
                    {
                        var keywordsList = new List<string>();
                        foreach(var k in keywordsElement.EnumerateArray())
                        {
                            var keywordStr = k.GetString();
                            if (!string.IsNullOrWhiteSpace(keywordStr))
                            {
                                keywordsList.Add(keywordStr);
                            }
                        }
                        if (keywordsList.Count > 0)
                        {
                            return keywordsList;
                        }
                    }
                }
                else
                {
                    _logger.LogWarning("[AiReference] Python AI service returned status: {Status}", response.StatusCode);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[AiReference] ExtractKeywords failed: {Msg}", ex.Message);
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
