using System.Threading.Tasks;
using ToolCalendar.Models;

namespace ToolCalendar.Services
{
    public interface IDocumentExtractorService
    {
        /// <summary>
        /// Trích xuất nội dung tài liệu (PDF, DOCX, ảnh) thông qua Python AI Service (Docling).
        /// </summary>
        Task<DocumentRecord> ExtractFromFileAsync(string filePath);
    }
}
