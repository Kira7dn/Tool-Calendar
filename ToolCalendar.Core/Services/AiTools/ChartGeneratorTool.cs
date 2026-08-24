using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace ToolCalendar.Core.Services.AiTools
{
    public class ChartGeneratorTool : IAiTool
    {
        public string Name => "generate_chart";
        public string Description => "Sinh ra biểu đồ (pie, bar) bằng Markdown Mermaid dựa trên dữ liệu sếp yêu cầu. Dùng sau khi đã có dữ liệu thống kê từ tool get_document_stats.";

        public object ParametersSchema => new
        {
            type = "object",
            properties = new
            {
                chart_type = new
                {
                    type = "string",
                    @enum = new[] { "pie", "bar" },
                    description = "Loại biểu đồ (pie = tròn, bar = cột)"
                },
                title = new
                {
                    type = "string",
                    description = "Tiêu đề biểu đồ"
                },
                data = new
                {
                    type = "array",
                    items = new
                    {
                        type = "object",
                        properties = new
                        {
                            label = new { type = "string" },
                            value = new { type = "number" }
                        },
                        required = new[] { "label", "value" }
                    },
                    description = "Mảng dữ liệu để vẽ biểu đồ"
                }
            },
            required = new[] { "chart_type", "title", "data" }
        };

        public Task<string> ExecuteAsync(Dictionary<string, object> arguments)
        {
            try
            {
                string chartType = arguments["chart_type"]?.ToString() ?? "pie";
                string title = arguments["title"]?.ToString() ?? "Biểu đồ";
                
                var dataElement = (JsonElement)arguments["data"];
                
                var sb = new StringBuilder();
                sb.AppendLine();
                sb.AppendLine("```mermaid");
                
                if (chartType == "pie")
                {
                    sb.AppendLine($"pie title {title}");
                    foreach (var item in dataElement.EnumerateArray())
                    {
                        string label = item.GetProperty("label").GetString() ?? "";
                        double value = item.GetProperty("value").GetDouble();
                        sb.AppendLine($"    \"{label}\" : {value}");
                    }
                }
                else
                {
                    // Bar chart can be rendered with gantt or xyChart in modern mermaid, 
                    // but standard xyChart is better or just markdown table if not supported.
                    // For simplicity we use xyChart
                    sb.AppendLine($"xychart-beta");
                    sb.AppendLine($"    title \"{title}\"");
                    
                    var xAxis = new List<string>();
                    var yAxis = new List<double>();
                    
                    foreach (var item in dataElement.EnumerateArray())
                    {
                        xAxis.Add($"\"{item.GetProperty("label").GetString()}\"");
                        yAxis.Add(item.GetProperty("value").GetDouble());
                    }
                    
                    sb.AppendLine($"    x-axis [{string.Join(", ", xAxis)}]");
                    sb.AppendLine($"    bar [{string.Join(", ", yAxis)}]");
                }
                
                sb.AppendLine("```");
                sb.AppendLine();
                
                return Task.FromResult(sb.ToString());
            }
            catch (Exception ex)
            {
                return Task.FromResult("Lỗi khi tạo biểu đồ: " + ex.Message);
            }
        }
    }
}
