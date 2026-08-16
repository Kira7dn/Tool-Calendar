using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Core.Services.AiTools
{
    public class SearchDocumentsByConditionTool : IAiTool
    {
        private readonly IDocumentRepository _documentRepo;

        public SearchDocumentsByConditionTool(IDocumentRepository documentRepo)
        {
            _documentRepo = documentRepo;
        }

        public string Name => "search_documents_by_condition";
        
        public string Description => "Truy vấn cơ sở dữ liệu công văn dựa trên các điều kiện lọc (ngày đến hạn, trạng thái, từ khóa). Dùng khi người dùng yêu cầu thống kê, đếm số lượng, hoặc lấy danh sách các công văn đến hạn vào một ngày cụ thể, công văn chưa xử lý, hoàn thành, v.v.";

        public object ParametersSchema => new
        {
            type = "object",
            properties = new
            {
                thoi_han = new
                {
                    type = "string",
                    description = "Thời hạn (deadline) cần tìm. Có thể là định dạng yyyy-MM-dd hoặc ngôn ngữ tự nhiên (ví dụ: 'ngày mai', 'tuần trước', 'tháng này'). Để trống nếu không lọc."
                },
                status = new
                {
                    type = "string",
                    description = "Trạng thái công văn. Chỉ được điền 1 trong các giá trị: 'Chưa xử lý', 'Đang xử lý', 'Hoàn thành'. Để trống nếu không lọc."
                },
                keyword = new
                {
                    type = "string",
                    description = "Từ khóa tìm kiếm chung (Số hiệu, tên, trích yếu). Để trống nếu không lọc."
                }
            },
            required = new string[] { }
        };

        public async Task<string> ExecuteAsync(Dictionary<string, object> arguments)
        {
            try
            {
                string search = arguments.TryGetValue("keyword", out var kwObj) ? kwObj?.ToString() ?? "" : "";
                string status = arguments.TryGetValue("status", out var stObj) ? stObj?.ToString() ?? "" : "";
                string thoiHanStr = arguments.TryGetValue("thoi_han", out var thObj) ? thObj?.ToString() ?? "" : "";

                DateTime? filterFromDate = null;
                DateTime? filterToDate = null;

                if (!string.IsNullOrEmpty(thoiHanStr))
                {
                    if (DateTime.TryParse(thoiHanStr, out var parsedDate))
                    {
                        filterFromDate = parsedDate.Date;
                        filterToDate = parsedDate.Date;
                    }
                    else
                    {
                        // Fallback: Gọi Python API để parse natural language date (Khoj DateFilter pattern)
                        try
                        {
                            using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(5) };
                            var payload = new { text = thoiHanStr };
                            var json = System.Text.Json.JsonSerializer.Serialize(payload);
                            var content = new System.Net.Http.StringContent(json, Encoding.UTF8, "application/json");
                            var response = await client.PostAsync("http://python-ai-service:8001/api/parse-date", content);
                            if (response.IsSuccessStatusCode)
                            {
                                var respJson = await response.Content.ReadAsStringAsync();
                                using var doc = System.Text.Json.JsonDocument.Parse(respJson);
                                var startStr = doc.RootElement.TryGetProperty("start_date", out var sd) ? sd.GetString() : null;
                                var endStr = doc.RootElement.TryGetProperty("end_date", out var ed) ? ed.GetString() : null;
                                
                                if (!string.IsNullOrEmpty(startStr) && DateTime.TryParse(startStr, out var sD))
                                    filterFromDate = sD;
                                if (!string.IsNullOrEmpty(endStr) && DateTime.TryParse(endStr, out var eD))
                                    filterToDate = eD;
                            }
                        }
                        catch (Exception)
                        {
                            // Bỏ qua nếu lỗi
                        }
                    }
                }

                // Gọi Repo để lấy dữ liệu (Page 1, 10 records)
                var result = await _documentRepo.GetPagedAsync(
                    page: 1, 
                    pageSize: 15, 
                    search: search, 
                    status: status, 
                    sort: "deadline_asc", 
                    fromDate: filterFromDate, 
                    toDate: filterToDate
                );

                if (result.Items == null || result.Items.Count == 0)
                {
                    return "Không tìm thấy công văn nào khớp với điều kiện tìm kiếm.";
                }

                var sb = new StringBuilder();
                sb.AppendLine($"Tìm thấy tổng cộng {result.TotalCount} công văn. Dưới đây là danh sách (hiển thị tối đa 15):");
                foreach (var doc in result.Items)
                {
                    string dateStr = doc.ThoiHan.HasValue ? doc.ThoiHan.Value.ToString("dd/MM/yyyy") : "Không có";
                    sb.AppendLine($"- [DOC|{doc.Id}|{doc.TenCongVan}] | Số VB: {doc.SoVanBan ?? "N/A"} | Trạng thái: {doc.Status} | Hạn: {dateStr}");
                }

                return sb.ToString();
            }
            catch (Exception ex)
            {
                return $"Lỗi khi truy vấn dữ liệu: {ex.Message}";
            }
        }
    }
}
