using System.Text.Json;
using ToolCalendar.Models;

namespace ToolCalendar.Services
{
    public class DocumentExtractorService : IDocumentExtractorService
    {
        private readonly IOcrService _ocrService;
        private readonly IOcrImageProcessingService _imageProcessingService;
        private readonly IOcrTextProcessingService _textProcessingService;

        public DocumentExtractorService(IOcrService ocrService, IOcrImageProcessingService imageProcessingService, IOcrTextProcessingService textProcessingService)
        {
            _ocrService = ocrService;
            _imageProcessingService = imageProcessingService;
            _textProcessingService = textProcessingService;
        }

        public async Task<DocumentRecord> ExtractFromFileAsync(string filePath)
        {
            return await ExtractFromFileAsync(filePath, null);
        }

        public async Task<DocumentRecord> ExtractFromFileAsync(string filePath, OcrExtractionResult? ocrResult)
        {
            string ext = Path.GetExtension(filePath).ToLower();
            string text = "";
            string ocrPagesJson = "[]";

            if (ext == ".pdf")
            {
                var resolvedOcrResult = ocrResult ?? await _ocrService.ExtractPdfOcrResultAsync(filePath);
                text = resolvedOcrResult.FullText;
                ocrPagesJson = JsonSerializer.Serialize(
                    resolvedOcrResult.Pages
                        .OrderBy(page => page.PageNumber)
                        .Select(page => new
                        {
                            pageNumber = page.PageNumber,
                            text = page.Text ?? string.Empty
                        }));

                string rawText = _imageProcessingService.ExtractFromPdf(filePath);
                if (!string.IsNullOrWhiteSpace(rawText)) text += "\n" + rawText;

                var parsedRecord = await _textProcessingService.ParseTextAsync(text, filePath, ocrPagesJson);
                if (resolvedOcrResult.HasCriticalError)
                {
                    parsedRecord.Status = "Lỗi OCR";
                }

                return parsedRecord;
            }
            else if (ext == ".doc" || ext == ".docx")
            {
                text = _imageProcessingService.ExtractFromWord(filePath);
            }
            else
            {
                throw new NotSupportedException($"Định dạng '{ext}' không hỗ trợ.");
            }

            return await _textProcessingService.ParseTextAsync(text, filePath, ocrPagesJson);
        }
    }
}
