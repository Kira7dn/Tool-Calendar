using Xunit;
using FluentAssertions;
using ToolCalender.Services;
using ToolCalender.Tests.Helpers;
using System.IO;
using Microsoft.Extensions.Configuration;

namespace ToolCalender.Tests.UnitTests
{
    public class StandardFlowTests
    {
        private readonly IConfiguration _configuration;
        private readonly IOcrService _ocrService;
        private readonly IDocumentExtractorService _extractorService;

        public StandardFlowTests()
        {
            var configData = new Dictionary<string, string?> {
                {"OcrSettings:TessDataPath", @"d:\Business Analyze\ToolCalendar\ToolCalender.Core\tessdata"},
                {"OcrSettings:Language", "vie+eng"}
            };

            _configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(configData)
                .Build();

            _ocrService = new OcrService(_configuration);
            _extractorService = new DocumentExtractorService(_ocrService);
        }

        private string GetResultsFolder()
        {
            string path = Path.Combine(@"d:\Business Analyze\ToolCalendar\tests\test_results", "unit_test");
            if (!Directory.Exists(path)) Directory.CreateDirectory(path);
            return path;
        }

        [Fact]
        public async Task FullWorkflow_StandardDocument_ShouldPass()
        {
            // --- ARRANGE ---
            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, "Standard_Long_Doc.pdf");
            string groundTruth = AutomationDocHelper.GenerateStandardPdf(pdfPath, "777/TEST-VB", "18/04/2026", "01/01/2027");
            
            // --- ACT ---
            var docData = await _extractorService.ExtractFromFileAsync(pdfPath);
            string extractedText = await _ocrService.ExtractTextFromPdfOcrAsync(pdfPath); 
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, extractedText);

            // Xuất báo cáo
            string reportPath = Path.Combine(resultsFolder, "Comparison_Standard_Doc.md");
            string report = $"# Báo cáo đối chiếu OCR - Standard Doc\n\n" +
                            $"**Tỷ lệ trùng khớp: {accuracy}%**\n\n" +
                            $"## Văn bản gốc:\n```\n{groundTruth}\n```\n\n" +
                            $"## Văn bản AI đọc được:\n```\n{extractedText}\n```\n";
            File.WriteAllText(reportPath, report);

            // --- ASSERT ---
            accuracy.Should().BeGreaterThan(80.0);
            docData.SoVanBan.Should().Contain("777");
            docData.ThoiHan?.Year.Should().Be(2027);
        }
    }
}
