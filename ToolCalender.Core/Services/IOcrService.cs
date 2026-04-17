namespace ToolCalender.Services
{
    public interface IOcrService
    {
        Task<string> ExtractTextFromPdfOcrAsync(string filePath);
    }
}
