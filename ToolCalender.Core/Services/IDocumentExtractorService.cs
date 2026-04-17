using ToolCalender.Models;

namespace ToolCalender.Services
{
    public interface IDocumentExtractorService
    {
        Task<DocumentRecord> ExtractFromFileAsync(string filePath);
    }
}
