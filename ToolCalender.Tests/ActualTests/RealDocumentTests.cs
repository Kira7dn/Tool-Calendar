using Xunit;
using ToolCalender.Models;
using ToolCalender.Services;
using ToolCalender.Tests.Helpers;
using System.IO;
using Microsoft.Extensions.Configuration;

namespace ToolCalender.Tests.ActualTests
{
    public class RealDocumentTests
    {
        private static bool _debugReset;
        private static readonly object DebugResetLock = new();
        private readonly IConfiguration _configuration;
        private readonly IOcrService _ocrService;

        public RealDocumentTests()
        {
            var resultsPath = Path.Combine(@"d:\Business Analyze\ToolCalendar\tests\test_results", "actual_test");
            var debugPath = Path.Combine(resultsPath, "debug_images");
            ResetDirectoryOnce(debugPath);

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

        private static void ResetDirectoryOnce(string path)
        {
            lock (DebugResetLock)
            {
                if (_debugReset) return;

                if (Directory.Exists(path))
                {
                    Directory.Delete(path, true);
                }

                Directory.CreateDirectory(path);
                _debugReset = true;
            }
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
            OcrExtractionResult ocrResult = await _ocrService.ExtractPdfOcrResultAsync(pdfPath);

            // --- REPORT ---
            string reportPath = Path.Combine(resultsFolder, "Quyết định 189_result.md");
            string report = $"# Kết quả OCR - Quyết định 189.pdf\n\n```\n{ocrResult.FullText}\n```";
            File.WriteAllText(reportPath, report);
        }
    }
}
