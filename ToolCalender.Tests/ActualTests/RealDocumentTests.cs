using Xunit;
using ToolCalender.Services;
using ToolCalender.Tests.Helpers;
using System.IO;
using Microsoft.Extensions.Configuration;

namespace ToolCalender.Tests.ActualTests
{
    public class RealDocumentTests
    {
        private readonly IConfiguration _configuration;
        private readonly IOcrService _ocrService;

        public RealDocumentTests()
        {
            var resultsPath = Path.Combine(@"d:\Business Analyze\ToolCalendar\tests\test_results", "actual_test");
            var debugPath = Path.Combine(resultsPath, "debug_images");

            var configData = new Dictionary<string, string?> {
                {"OcrSettings:TessDataPath", @"d:\Business Analyze\ToolCalendar\ToolCalender.Core\tessdata"},
                {"OcrSettings:Language", "vie+eng"},
                {"OcrSettings:EnableDebug", "true"},
                {"OcrSettings:DebugPath", debugPath}
            };

            _configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(configData)
                .Build();

            _ocrService = new OcrService(_configuration);
        }

        private string GetResultsFolder()
        {
            string path = Path.Combine(@"d:\Business Analyze\ToolCalendar\tests\test_results", "actual_test");
            if (!Directory.Exists(path)) Directory.CreateDirectory(path);
            return path;
        }

        [Fact]
        public async Task Manual_Ocr_QuyetDinh189()
        {
            // --- ARRANGE ---
            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, "Quyết định 189.pdf");
            
            if (!File.Exists(pdfPath)) return;

            // --- ACT ---
            string extractedText = await _ocrService.ExtractTextFromPdfOcrAsync(pdfPath);

            // --- REPORT ---
            string reportPath = Path.Combine(resultsFolder, "Quyết định 189_result.md");
            string report = $"# Kết quả OCR - Quyết định 189.pdf\n\n```\n{extractedText}\n```";
            File.WriteAllText(reportPath, report);
        }
    }
}
