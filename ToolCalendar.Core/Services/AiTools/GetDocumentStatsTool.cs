using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Core.Services.AiTools
{
    public class GetDocumentStatsTool : IAiTool
    {
        private readonly IStatsRepository _statsRepo;

        public GetDocumentStatsTool(IStatsRepository statsRepo)
        {
            _statsRepo = statsRepo;
        }

        public string Name => "get_document_stats";
        public string Description => "Lấy thông tin thống kê số lượng công văn (chờ xử lý, đang xử lý, đã hoàn thành). Dùng khi sếp hỏi 'có bao nhiêu công văn', 'tình hình xử lý', 'thống kê'.";
        
        public object ParametersSchema => new
        {
            type = "object",
            properties = new { },
            required = Array.Empty<string>()
        };

        public async Task<string> ExecuteAsync(Dictionary<string, object> arguments)
        {
            try
            {
                return await _statsRepo.GetAiContextStatsAsync();
            }
            catch (Exception ex)
            {
                return "Lỗi khi lấy dữ liệu thống kê: " + ex.Message;
            }
        }
    }
}
