using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using HtmlAgilityPack;

namespace ToolCalendar.Core.Services.AiTools
{
    public class WebSearchTool : IAiTool
    {
        private readonly HttpClient _httpClient;

        public WebSearchTool(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public string Name => "search_web";
        public string Description => "Tra cứu thông tin, tin tức, luật pháp trên Internet (Google/DuckDuckGo). Sử dụng khi sếp hỏi các kiến thức bên ngoài mà không có trong cơ sở dữ liệu công văn nội bộ.";

        public object ParametersSchema => new
        {
            type = "object",
            properties = new
            {
                query = new
                {
                    type = "string",
                    description = "Từ khóa cần tra cứu trên mạng (ví dụ: 'Luật doanh nghiệp 2020 quy định về giải thể')"
                }
            },
            required = new[] { "query" }
        };

        public async Task<string> ExecuteAsync(Dictionary<string, object> arguments)
        {
            try
            {
                if (!arguments.TryGetValue("query", out var queryObj) || queryObj == null)
                {
                    return "Thiếu tham số query.";
                }

                string query = queryObj.ToString() ?? "";
                
                // DuckDuckGo HTML Lite search
                string searchUrl = $"https://html.duckduckgo.com/html/?q={Uri.EscapeDataString(query)}";
                
                var request = new HttpRequestMessage(HttpMethod.Get, searchUrl);
                request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                
                var response = await _httpClient.SendAsync(request);
                response.EnsureSuccessStatusCode();
                
                var html = await response.Content.ReadAsStringAsync();
                
                // Parse HTML
                var doc = new HtmlDocument();
                doc.LoadHtml(html);
                
                var resultNodes = doc.DocumentNode.SelectNodes("//a[@class='result__snippet']");
                if (resultNodes == null || resultNodes.Count == 0)
                {
                    return $"KHÔNG_TÌM_THẤY: Không có kết quả nào trên Internet cho từ khóa: {query}";
                }

                var sb = new System.Text.StringBuilder();
                sb.AppendLine($"[Kết quả tra cứu Internet cho: {query}]");
                
                int count = 0;
                foreach (var node in resultNodes)
                {
                    if (count >= 5) break; // Limit to 5 results
                    string text = HtmlEntity.DeEntitize(node.InnerText).Trim();
                    // Remove extra whitespaces
                    text = Regex.Replace(text, @"\s+", " ");
                    sb.AppendLine($"- {text}");
                    count++;
                }

                return sb.ToString();
            }
            catch (Exception ex)
            {
                return "Lỗi khi tra cứu Internet: " + ex.Message;
            }
        }
    }
}
