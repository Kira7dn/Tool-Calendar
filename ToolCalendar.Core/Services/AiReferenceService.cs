using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Web;
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
                    foreach (var site in PrioritySites)
                    {
                        var siteResults = await SearchDuckDuckGoAsync(keyword, site);
                        results.AddRange(siteResults);
                        if (results.Count >= 10) break;
                    }
                    if (results.Count >= 10) break;
                }

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

                var prompt = $"Bạn là chuyên gia. Hãy đọc văn bản sau và trích xuất đúng 1 cụm từ khóa (khoảng 3-6 từ, ưu tiên Số ký hiệu văn bản nếu có, ví dụ: 'Nghị định 15/2020', 'Công văn 123/UBND') để tra cứu trên Google. \n\nVăn bản: {textSample}\n\nChỉ trả về 1 cụm từ khóa, không giải thích gì thêm.";

                var requestBody = new
                {
                    model = _modelName,
                    messages = new[] { new { role = "user", content = prompt } },
                    stream = false,
                    options = new { temperature = 0.1, num_predict = 100 }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(90));
                var response = await _httpClient.PostAsync(_ollamaUrl, content, cts.Token);
                var responseBody = await response.Content.ReadAsStringAsync(cts.Token);

                using var doc = JsonDocument.Parse(responseBody);
                var aiText = doc.RootElement.GetProperty("message").GetProperty("content").GetString() ?? "";

                var keyword = aiText.Trim().Trim('"', '\'', '.', '\n');
                if (!string.IsNullOrWhiteSpace(keyword) && keyword.Length < 100 && !keyword.StartsWith("["))
                {
                    return new List<string> { keyword };
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

        private async Task<List<DocumentReference>> SearchDuckDuckGoAsync(string keyword, string site)
        {
            var refs = new List<DocumentReference>();
            try
            {
                var query = HttpUtility.UrlEncode($"{keyword} site:{site}");
                var url = $"https://html.duckduckgo.com/html?q={query}";

                var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(15));
                var response = await _httpClient.SendAsync(request, cts.Token);
                
                if (!response.IsSuccessStatusCode) return refs;

                var html = await response.Content.ReadAsStringAsync(cts.Token);
                
                var blocks = html.Split("<div class=\"result results_links");
                for (int i = 1; i < blocks.Length; i++)
                {
                    var block = blocks[i];
                    
                    var titleMatch = System.Text.RegularExpressions.Regex.Match(block, @"<a[^>]*class=""result__a""[^>]*>(.*?)<\/a>", System.Text.RegularExpressions.RegexOptions.Singleline);
                    var urlMatch = System.Text.RegularExpressions.Regex.Match(block, @"<a[^>]*class=""result__a""[^>]*href=""([^""]*)""", System.Text.RegularExpressions.RegexOptions.Singleline);
                    var snippetMatch = System.Text.RegularExpressions.Regex.Match(block, @"<a[^>]*class=""result__snippet""[^>]*>(.*?)<\/a>", System.Text.RegularExpressions.RegexOptions.Singleline);
                    
                    if (!titleMatch.Success || !urlMatch.Success) continue;
                    
                    var title = System.Text.RegularExpressions.Regex.Replace(titleMatch.Groups[1].Value, @"<[^>]+>|&nbsp;", "").Trim();
                    var snippet = snippetMatch.Success ? System.Text.RegularExpressions.Regex.Replace(snippetMatch.Groups[1].Value, @"<[^>]+>|&nbsp;", "").Trim() : "";
                    var rawUrl = urlMatch.Groups[1].Value;
                    
                    string actualUrl = rawUrl;
                    if (rawUrl.Contains("uddg="))
                    {
                        var uri = new Uri(rawUrl.StartsWith("//") ? $"https:{rawUrl}" : (rawUrl.StartsWith("http") ? rawUrl : $"https://duckduckgo.com{rawUrl}"));
                        var queryDict = HttpUtility.ParseQueryString(uri.Query);
                        if (queryDict["uddg"] != null)
                        {
                            actualUrl = queryDict["uddg"]!;
                        }
                    }

                    if (!string.IsNullOrEmpty(actualUrl) && actualUrl.StartsWith("http"))
                    {
                        refs.Add(new DocumentReference
                        {
                            Title = title,
                            Url = actualUrl,
                            Snippet = snippet,
                            Source = site
                        });
                    }

                    if (refs.Count >= 3) break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[AiReference] DuckDuckGo HTML scraping failed for {Site}: {Msg}", site, ex.Message);
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
