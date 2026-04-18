using Xunit;
using FluentAssertions;
using ToolCalender.Models;
using ToolCalender.Services;
using ToolCalender.Tests.Helpers;
using System.IO;
using Microsoft.Extensions.Configuration;

namespace ToolCalender.Tests
{
    public class OcrStressTests
    {
        private static bool _debugReset;
        private static readonly object DebugResetLock = new();
        private readonly IConfiguration _configuration;
        private readonly IOcrService _ocrService;

        public OcrStressTests()
        {
            string debugPath = Path.Combine(@"d:\Business Analyze\ToolCalendar\tests\test_results", "stress_tests", "debug_images");
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
            string path = @"d:\Business Analyze\ToolCalendar\tests\test_results\stress_tests";
            if (!Directory.Exists(path)) Directory.CreateDirectory(path);
            return path;
        }

        [Fact]
        public async Task ExtractMultiPage_ShouldReadEverything()
        {
            // --- ARRANGE ---
            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, "Stress_MultiPage.pdf");
            string groundTruth = AutomationDocHelper.GenerateMultiPageScannedPdf(pdfPath, 3);

            // --- ACT ---
            OcrExtractionResult ocrResult = await _ocrService.ExtractPdfOcrResultAsync(pdfPath);
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, ocrResult.FullText);

            // --- REPORT ---
            string reportPath = Path.Combine(resultsFolder, "Comparison_Stress_MultiPage.md");
            string report = $"# Báo cáo Stress Test - Đa trang\n\n**Tỷ lệ trùng khớp: {accuracy:F2}%**\n\n" +
                            $"## Văn bản gốc:\n```\n{groundTruth}\n```\n\n" +
                            $"## AI trích xuất:\n```\n{ocrResult.FullText}\n```";
            File.WriteAllText(reportPath, report);

            // --- ASSERT ---
            // Sau khi tối ưu, accuracy phải đạt mức cao (>90%)
            accuracy.Should().BeGreaterThan(90.0, "Hệ thống đã hỗ trợ đa trang nên phải bóc tách đủ nội dung");
        }

        [Fact]
        public async Task ExtractRotatedPage_ShouldAutoFixOrientation()
        {
            // --- ARRANGE ---
            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, "Stress_Rotated.pdf");
            string groundTruth = AutomationDocHelper.GenerateRotatedScannedPdf(pdfPath);

            // --- ACT ---
            OcrExtractionResult ocrResult = await _ocrService.ExtractPdfOcrResultAsync(pdfPath);
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, ocrResult.FullText);

            // --- REPORT ---
            string reportPath = Path.Combine(resultsFolder, "Comparison_Stress_Rotated.md");
            string report = $"# Báo cáo Stress Test - Xoay hướng\n\n**Tỷ lệ trùng khớp: {accuracy:F2}%**\n\n" +
                            $"## Văn bản gốc:\n```\n{groundTruth}\n```\n\n" +
                            $"## AI trích xuất:\n```\n{ocrResult.FullText}\n```";
            File.WriteAllText(reportPath, report);

            // --- ASSERT ---
            // Sau khi tối ưu dùng OSD, Accuracy phải đạt mức cao
            accuracy.Should().BeGreaterThan(90.0, "Hệ thống đã hỗ trợ Auto-OSD nên phải tự xoay đúng chiều");
        }

        [Fact]
        public async Task ExtractBorderNoisePage_ShouldIgnoreBorders()
        {
            // --- ARRANGE ---
            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, "Stress_BorderNoise.pdf");
            string groundTruth = AutomationDocHelper.GenerateBorderNoiseScannedPdf(pdfPath);

            // --- ACT ---
            OcrExtractionResult ocrResult = await _ocrService.ExtractPdfOcrResultAsync(pdfPath);
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, ocrResult.FullText);

            // --- REPORT ---
            string reportPath = Path.Combine(resultsFolder, "Comparison_Stress_BorderNoise.md");
            string report = $"# Báo cáo Stress Test - Nhiễu viền\n\n**Tỷ lệ trùng khớp: {accuracy:F2}%**\n\n" +
                            $"## Văn bản gốc:\n```\n{groundTruth}\n```\n\n" +
                            $"## AI trích xuất:\n```\n{ocrResult.FullText}\n```";
            File.WriteAllText(reportPath, report);

            // --- ASSERT ---
            accuracy.Should().BeGreaterThan(90.0);
        }
    }
}
