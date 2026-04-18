using Xunit;
using FluentAssertions;
using ToolCalender.Services;
using ToolCalender.Tests.Helpers;
using System.IO;
using Microsoft.Extensions.Configuration;

namespace ToolCalender.Tests.UnitTests
{
    public class ProfessionalNoiseTests
    {
        private readonly IConfiguration _configuration;
        private readonly IOcrService _ocrService;

        public ProfessionalNoiseTests()
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
            string path = Path.Combine(@"d:\Business Analyze\ToolCalendar\tests\test_results", "unit_test");
            if (!Directory.Exists(path)) Directory.CreateDirectory(path);
            return path;
        }

        [Fact]
        public async Task OcrProfessional_NoiseOnly_ShouldSucceed()
        {
            // --- ARRANGE ---
            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, "Prof_NoiseOnly_Doc.pdf");
            string expectedSoVb = "111/NOISE-ONLY";
            string groundTruth = AutomationDocHelper.GenerateProfessionalImagePdf(pdfPath, expectedSoVb, "25/12/2026", includeNoise: true, includeSkew: false);

            // --- ACT ---
            string extractedText = await _ocrService.ExtractTextFromPdfOcrAsync(pdfPath);
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, extractedText);

            // --- REPORT ---
            string reportPath = Path.Combine(resultsFolder, "Comparison_Prof_NoiseOnly.md");
            File.WriteAllText(reportPath, $"# Noise Only Test\nAccuracy: {accuracy}%\n\nGround Truth:\n{groundTruth}\n\nExtracted:\n{extractedText}");

            // --- ASSERT ---
            accuracy.Should().BeGreaterThan(80.0);
        }

        [Fact]
        public async Task OcrProfessional_SkewOnly_ShouldSucceed()
        {
            // --- ARRANGE ---
            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, "Prof_SkewOnly_Doc.pdf");
            string expectedSoVb = "222/SKEW-ONLY";
            string groundTruth = AutomationDocHelper.GenerateProfessionalImagePdf(pdfPath, expectedSoVb, "25/12/2026", includeNoise: false, includeSkew: true);

            // --- ACT ---
            string extractedText = await _ocrService.ExtractTextFromPdfOcrAsync(pdfPath);
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, extractedText);

            // --- REPORT ---
            string reportPath = Path.Combine(resultsFolder, "Comparison_Prof_SkewOnly.md");
            File.WriteAllText(reportPath, $"# Skew Only Test\nAccuracy: {accuracy}%\n\nGround Truth:\n{groundTruth}\n\nExtracted:\n{extractedText}");

            // --- ASSERT ---
            accuracy.Should().BeGreaterThan(90.0);
        }

        [Fact]
        public async Task OcrProfessional_Combined_ShouldSucceed()
        {
            // --- ARRANGE ---
            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, "Prof_Combined_Doc.pdf");
            string expectedSoVb = "333/COMBINED";
            string groundTruth = AutomationDocHelper.GenerateProfessionalImagePdf(pdfPath, expectedSoVb, "25/12/2026", includeNoise: true, includeSkew: true);

            // --- ACT ---
            string extractedText = await _ocrService.ExtractTextFromPdfOcrAsync(pdfPath);
            double accuracy = AccuracyCalculator.CalculateMatchRate(groundTruth, extractedText);

            // --- REPORT ---
            string reportPath = Path.Combine(resultsFolder, "Comparison_Prof_Combined.md");
            File.WriteAllText(reportPath, $"# Combined Test\nAccuracy: {accuracy}%\n\nGround Truth:\n{groundTruth}\n\nExtracted:\n{extractedText}");

            // --- ASSERT ---
            accuracy.Should().BeGreaterThan(70.0);
        }
    }
}
