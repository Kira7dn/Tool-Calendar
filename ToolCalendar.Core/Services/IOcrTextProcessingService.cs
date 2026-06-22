using ToolCalendar.Models;

namespace ToolCalendar.Services
{
    public interface IOcrTextProcessingService
    {
        Task<DocumentRecord> ParseTextAsync(string text, string filePath, string ocrPagesJson = "[]");
    }
}
