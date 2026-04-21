using Xunit;
using FluentAssertions;
using ToolCalender.Models;
using ToolCalender.Services;
using ToolCalender.Tests.Helpers;
using ToolCalender.Data;
using System.IO;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace ToolCalender.Tests
{
    public class OcrAutomationTests
    {
        private static bool _debugReset;
        private static readonly object DebugResetLock = new();
        private readonly IConfiguration _configuration;
        private readonly IOcrService _ocrService;
        private readonly IDocumentExtractorService _extractorService;
        private readonly bool _isLocalOcrRuntimeAvailable;

        public OcrAutomationTests()
        {
            string debugPath = Path.Combine(TestPathHelper.GetTestResultsRoot(), "unit_test", "debug_images", "automation");
            ResetDirectoryOnce(debugPath);
            ConfigureTestDatabase($"ocr-automation-tests-{Guid.NewGuid():N}.db");

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
            _extractorService = new DocumentExtractorService(_ocrService);
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
                if (Directory.Exists(path)) Directory.Delete(path, true);
                Directory.CreateDirectory(path);
                _debugReset = true;
            }
        }

        private string GetResultsFolder()
        {
            string path = Path.Combine(TestPathHelper.GetTestResultsRoot(), "unit_test");
            if (!Directory.Exists(path)) Directory.CreateDirectory(path);
            return path;
        }

        private async Task RunTestInstance(string fileName, string reportName, string testType)
        {
            if (!_isLocalOcrRuntimeAvailable) return;

            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, fileName);
            string expectedSoVb = "888/STTTT-BCĐ";
            string expectedThoiHan = "25/12/2026";

            // Ở đây SimulationDocHelper có thể được mở rộng để tạo từng loại test (Noise Only, Skew Only...)
            // Nhưng hiện tại GenerateProfessionalImagePdf tạo Combined (Noise + Skew). 
            // Ta sẽ dùng nó cho Combined test.
            string groundTruth = AutomationDocHelper.GenerateProfessionalImagePdf(pdfPath, expectedSoVb, expectedThoiHan);

            OcrExtractionResult ocrResult = await _ocrService.ExtractPdfOcrResultAsync(pdfPath);
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, ocrResult.FullText);

            string reportPath = Path.Combine(resultsFolder, reportName);
            string report = $"# Báo cáo đối chiếu OCR - {testType}\n\n" +
                            $"**Tỷ lệ trùng khớp: {accuracy}%**\n\n" +
                            $"## Văn bản gốc:\n```\n{groundTruth}\n```\n\n" +
                            $"## Văn bản trích xuất được:\n```\n{ocrResult.FullText}\n```\n";
            File.WriteAllText(reportPath, report);

            accuracy.Should().BeGreaterThan(80.0, $"Hệ thống phải đạt trên 80% cho {testType}");
        }

        [Fact]
        public async Task OcrProfessional_FullLongDocument_WithNoiseAndSkew_ShouldSucceed()
        {
            await RunTestInstance("Full_Professional_Noisy_Doc.pdf", "Comparison_Professional_Doc.md", "Professional Doc");
        }

        [Fact]
        public async Task OcrProfessional_Combined_ShouldSucceed()
        {
             await RunTestInstance("Prof_Combined_Doc.pdf", "Comparison_Prof_Combined.md", "Combined (Noise + Skew)");
        }

        [Fact]
        public async Task OcrProfessional_NoiseOnly_ShouldSucceed()
        {
             await RunTestInstance("Prof_NoiseOnly_Doc.pdf", "Comparison_Prof_NoiseOnly.md", "Noise Only");
        }

        [Fact]
        public async Task OcrProfessional_SkewOnly_ShouldSucceed()
        {
             await RunTestInstance("Prof_SkewOnly_Doc.pdf", "Comparison_Prof_SkewOnly.md", "Skew Only");
        }

        [Fact]
        public async Task FullWorkflow_StandardDocument_ShouldPass()
        {
            if (!_isLocalOcrRuntimeAvailable) return;
            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, "Standard_Long_Doc.pdf");
            string groundTruth = AutomationDocHelper.GenerateStandardPdf(pdfPath, "777/TEST-VB", "18/04/2026", "01/01/2027");
            
            OcrExtractionResult ocrResult = await _ocrService.ExtractPdfOcrResultAsync(pdfPath);
            var docData = await _extractorService.ExtractFromFileAsync(pdfPath, ocrResult);
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, ocrResult.FullText);

            string reportPath = Path.Combine(resultsFolder, "Comparison_Standard_Doc.md");
            string report = $"# Báo cáo đối chiếu OCR - Standard Doc\n\n" +
                            $"**Tỷ lệ trùng khớp: {accuracy}%**\n\n" +
                            $"## Văn bản gốc:\n```\n{groundTruth}\n```\n\n" +
                            $"## Văn bản trích xuất được:\n```\n{ocrResult.FullText}\n```\n";
            File.WriteAllText(reportPath, report);

            accuracy.Should().BeGreaterThan(90.0);
            docData.SoVanBan.Should().Contain("777");
        }
    }
}
