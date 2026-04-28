using ToolCalendar.Models;

namespace ToolCalendar.Services
{
    public interface IDocumentExtractorService
    {
        Task<DocumentRecord> ExtractFromFileAsync(string filePath);
        Task<DocumentRecord> ExtractFromFileAsync(string filePath, OcrExtractionResult? ocrResult);
    }
}
