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
            _ollamaUrl = config.GetValue<string>("Ollama:ChatUrl") ?? "http://127.0.0.1:11434/api/chat";
            _modelName = config.GetValue<string>("Ollama:Model") ?? "qwen2.5:3b";
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

                var prompt = $"Ban la chuyen gia phap ly Viet Nam. Tu doan van ban nay, hay trich xuat dung 3 cum tu khoa ngan gon (2-6 tu) de tim kiem van ban phap luat lien quan tren internet.\n\nVan ban:\n{textSample}\n\nTra ve DUNG dinh dang JSON array:\n[\"tu khoa 1\", \"tu khoa 2\", \"tu khoa 3\"]";

                var requestBody = new
                {
                    model = _modelName,
                    messages = new[] { new { role = "user", content = prompt } },
                    stream = false,
                    options = new { temperature = 0.1, num_predict = 100 }
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(20));
                var response = await _httpClient.PostAsync(_ollamaUrl, content, cts.Token);
                var responseBody = await response.Content.ReadAsStringAsync(cts.Token);

                using var doc = JsonDocument.Parse(responseBody);
                var aiText = doc.RootElement.GetProperty("message").GetProperty("content").GetString() ?? "";

                var match = System.Text.RegularExpressions.Regex.Match(aiText, @"\[.*?\]", System.Text.RegularExpressions.RegexOptions.Singleline);
                if (match.Success)
                {
                    var keywords = JsonSerializer.Deserialize<List<string>>(match.Value);
                    if (keywords != null && keywords.Count > 0) return keywords;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[AiReference] Ollama keyword extraction failed: {Msg}", ex.Message);
            }

            return new List<string> { documentTitle };
        }

        private async Task<List<DocumentReference>> SearchDuckDuckGoAsync(string keyword, string site)
        {
            var refs = new List<DocumentReference>();
            try
            {
                var query = HttpUtility.UrlEncode($"{keyword} site:{site}");
                var url = $"https://api.duckduckgo.com/?q={query}&format=json&no_html=1&no_redirect=1";

                using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(8));
                var response = await _httpClient.GetAsync(url, cts.Token);
                if (!response.IsSuccessStatusCode) return refs;

                var body = await response.Content.ReadAsStringAsync(cts.Token);
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                if (root.TryGetProperty("RelatedTopics", out var topics))
                {
                    foreach (var topic in topics.EnumerateArray())
                    {
                        if (!topic.TryGetProperty("FirstURL", out var urlProp)) continue;
                        if (!topic.TryGetProperty("Text", out var textProp)) continue;

                        var refUrl = urlProp.GetString() ?? "";
                        var refText = textProp.GetString() ?? "";
                        if (string.IsNullOrEmpty(refUrl) || !refUrl.StartsWith("http")) continue;

                        refs.Add(new DocumentReference
                        {
                            Title = refText.Length > 80 ? refText[..80] + "..." : refText,
                            Url = refUrl,
                            Snippet = refText,
                            Source = site
                        });

                        if (refs.Count >= 3) break;
                    }
                }

                if (refs.Count == 0 && root.TryGetProperty("AbstractURL", out var absUrl))
                {
                    var absUrlStr = absUrl.GetString() ?? "";
                    var absText = root.TryGetProperty("Abstract", out var abs) ? abs.GetString() ?? "" : keyword;
                    if (!string.IsNullOrEmpty(absUrlStr) && absUrlStr.StartsWith("http"))
                    {
                        refs.Add(new DocumentReference
                        {
                            Title = absText.Length > 80 ? absText[..80] + "..." : absText,
                            Url = absUrlStr,
                            Snippet = absText,
                            Source = site
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("[AiReference] DuckDuckGo failed for {Site}: {Msg}", site, ex.Message);
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
