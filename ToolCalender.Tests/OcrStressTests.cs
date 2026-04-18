using Xunit;
using FluentAssertions;
using ToolCalender.Services;
using ToolCalender.Tests.Helpers;
using System.IO;
using Microsoft.Extensions.Configuration;

namespace ToolCalender.Tests
{
    public class OcrStressTests
    {
        private readonly IConfiguration _configuration;
        private readonly IOcrService _ocrService;

        public OcrStressTests()
        {
            var configData = new Dictionary<string, string?> {
                {"OcrSettings:TessDataPath", @"d:\Business Analyze\ToolCalendar\ToolCalender.Core\tessdata"},
                {"OcrSettings:Language", "vie+eng"}
            };

            _configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(configData)
                .Build();

            _ocrService = new OcrService(_configuration);
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
            string extractedText = await _ocrService.ExtractTextFromPdfOcrAsync(pdfPath);
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, extractedText);

            // --- REPORT ---
            string reportPath = Path.Combine(resultsFolder, "Comparison_Stress_MultiPage.md");
            string report = $"# Báo cáo Stress Test - Đa trang\n\n**Tỷ lệ trùng khớp: {accuracy:F2}%**\n\n" +
                            $"## Văn bản gốc:\n```\n{groundTruth}\n```\n\n" +
                            $"## AI trích xuất:\n```\n{extractedText}\n```";
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
            string extractedText = await _ocrService.ExtractTextFromPdfOcrAsync(pdfPath);
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, extractedText);

            // --- REPORT ---
            string reportPath = Path.Combine(resultsFolder, "Comparison_Stress_Rotated.md");
            string report = $"# Báo cáo Stress Test - Xoay hướng\n\n**Tỷ lệ trùng khớp: {accuracy:F2}%**\n\n" +
                            $"## Văn bản gốc:\n```\n{groundTruth}\n```\n\n" +
                            $"## AI trích xuất:\n```\n{extractedText}\n```";
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
            string extractedText = await _ocrService.ExtractTextFromPdfOcrAsync(pdfPath);
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, extractedText);

            // --- REPORT ---
            string reportPath = Path.Combine(resultsFolder, "Comparison_Stress_BorderNoise.md");
            string report = $"# Báo cáo Stress Test - Nhiễu viền\n\n**Tỷ lệ trùng khớp: {accuracy:F2}%**\n\n" +
                            $"## Văn bản gốc:\n```\n{groundTruth}\n```\n\n" +
                            $"## AI trích xuất:\n```\n{extractedText}\n```";
            File.WriteAllText(reportPath, report);

            // --- ASSERT ---
            accuracy.Should().BeGreaterThan(90.0);
        }
    }
}
