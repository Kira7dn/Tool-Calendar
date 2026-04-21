using Xunit;
using ToolCalender.Models;
using ToolCalender.Services;
using ToolCalender.Tests.Helpers;
using ToolCalender.Data;
using System.IO;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace ToolCalender.Tests
{
    public class RealDocumentTests
    {
        private static bool _debugReset;
        private static readonly object DebugResetLock = new();
        private readonly IConfiguration _configuration;
        private readonly IOcrService _ocrService;
        private readonly bool _isLocalOcrRuntimeAvailable;

        public RealDocumentTests()
        {
            var resultsPath = Path.Combine(TestPathHelper.GetTestResultsRoot(), "actual_test");
            var debugPath = Path.Combine(resultsPath, "debug_images");
            ResetDirectoryOnce(debugPath);
            ConfigureTestDatabase($"real-document-tests-{Guid.NewGuid():N}.db");

            var configData = new Dictionary<string, string?> {
                {"OcrSettings:TessDataPath", TestPathHelper.GetCoreTessdataPath()},
                {"OcrSettings:Language", "vie+eng"},
                {"OcrSettings:EnableDebug", "true"},
                {"OcrSettings:DebugPath", debugPath}
            };

            _configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(configData)
                .Build();

            _isLocalOcrRuntimeAvailable = OcrTestRuntimeHelper.IsTesseractCliAvailable();
            _ocrService = new OcrService(_configuration, NullLogger<OcrService>.Instance);
        }

        private static void ConfigureTestDatabase(string fileName)
        {
            string dbDirectory = TestPathHelper.GetTestDbRoot();
            Directory.CreateDirectory(dbDirectory);
            string dbPath = Path.Combine(dbDirectory, fileName);
            if (File.Exists(dbPath))
            {
                File.Delete(dbPath);
            }
            Environment.SetEnvironmentVariable("DB_PATH", dbPath);
            DatabaseService.Initialize();
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
            string path = Path.Combine(TestPathHelper.GetTestResultsRoot(), "actual_test");
            if (!Directory.Exists(path)) Directory.CreateDirectory(path);
            return path;
        }

        [Fact]
        public async Task Manual_Ocr_QuyetDinh189()
        {
            if (!_isLocalOcrRuntimeAvailable) return;

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
