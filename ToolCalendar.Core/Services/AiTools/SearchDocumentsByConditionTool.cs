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
                    description = "Thời hạn (deadline) cần tìm, định dạng yyyy-MM-dd (ví dụ: '2026-08-06'). Nếu người dùng hỏi ngày mai, ngày kia, hãy tính toán ra ngày yyyy-MM-dd tương ứng. Để trống nếu không lọc theo thời hạn."
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

                DateTime? filterDate = null;
                if (!string.IsNullOrEmpty(thoiHanStr) && DateTime.TryParse(thoiHanStr, out var parsedDate))
                {
                    filterDate = parsedDate.Date;
                }

                // Gọi Repo để lấy dữ liệu (Page 1, 10 records)
                var result = await _documentRepo.GetPagedAsync(
                    page: 1, 
                    pageSize: 15, 
                    search: search, 
                    status: status, 
                    sort: "deadline_asc", 
                    fromDate: filterDate, 
                    toDate: filterDate
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
                    sb.AppendLine($"- [Id: {doc.Id}] Số VB: {doc.SoVanBan ?? "N/A"} | Tên: {doc.TenCongVan} | Trạng thái: {doc.Status} | Hạn: {dateStr}");
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
