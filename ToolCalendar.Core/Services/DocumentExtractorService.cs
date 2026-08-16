using ToolCalendar.Models;

namespace ToolCalendar.Services
{
    /// <summary>
    /// Dịch vụ trích xuất nội dung tài liệu — delegate 100% sang Python AI Service (Docling).
    /// Trước đây dùng Tesseract OCR, đã chuyển sang Python để chất lượng tốt hơn.
    /// </summary>
    public class DocumentExtractorService : IDocumentExtractorService
    {
        private readonly IPythonAiService _aiService;

        public DocumentExtractorService(IPythonAiService aiService)
        {
            _aiService = aiService;
        }

        public async Task<DocumentRecord> ExtractFromFileAsync(string filePath)
        {
            var result = await _aiService.ExtractDocumentAsync(filePath);

            return new DocumentRecord
            {
                FullText = result.Text,
            };
        }
    }
}
