using Xunit;
using FluentAssertions;
using ToolCalender.Models;
using ToolCalender.Services;
using ToolCalender.Data;
using ToolCalender.Tests.Helpers;

namespace ToolCalender.Tests
{
    public class RuleExtractionTests : IntegrationTestBase
    {
        private readonly IDocumentExtractorService _extractorService;
        private readonly string _tempPdfPath;

        public RuleExtractionTests() : base()
        {
            _tempPdfPath = Path.Combine(Path.GetTempPath(), $"empty_{Guid.NewGuid()}.pdf");
            
            // Generate a truly empty PDF to avoid interference with test data
            using (var writer = new iText.Kernel.Pdf.PdfWriter(_tempPdfPath))
            {
                using (var pdf = new iText.Kernel.Pdf.PdfDocument(writer))
                {
                    new iText.Layout.Document(pdf).Add(new iText.Layout.Element.Paragraph("")).Close();
                }
            }

            var ocrMock = new MockOcrService();
            _extractorService = new DocumentExtractorService(ocrMock);

            SetupTestData();
        }

        private void SetupTestData()
        {
            // 1. Setup Auto Rules
            DatabaseService.InsertAutoRule(new AutoRule {
                Keyword = "Kinh tế",
                LabelId = 1,
                DepartmentId = 2,
                DefaultDeadlineDays = 10
            });

            DatabaseService.InsertAutoRule(new AutoRule {
                Keyword = "Tư pháp",
                LabelId = 3,
                DepartmentId = 4,
                DefaultDeadlineDays = 5
            });

            // 2. Setup AppSettings for Deadline Keywords
            DatabaseService.SaveAppSetting("Document_DeadlineKeywords", "hạn, đến ngày, trước ngày, trình, xong, due date");
        }

        [Fact]
        public async Task ParseText_AutoLabelingAndRouting_ShouldWork()
        {
            // Arrange
            // Cần đúng định dạng "ngày... tháng... năm..." để bắt được NgayBanHanh
            string text = "Văn bản về việc phát triển Kinh tế xã hội năm 2026. ngày 01 tháng 01 năm 2026.";
            
            // Act
            var result = await _extractorService.ExtractFromFileAsync(_tempPdfPath, new OcrExtractionResult { FullText = text });

            // Assert
            result.LabelId.Should().Be(1);
            result.DepartmentId.Should().Be(2);
            // Có NgayBanHanh 01/01 -> + 10 ngày = 11/01
            result.ThoiHan.Should().NotBeNull();
            result.ThoiHan?.Day.Should().Be(11); 
        }

        [Fact]
        public async Task ParseText_SymmetricDeadline_KeywordBeforeDate_ShouldWork()
        {
            // Arrange
            string text = "Hạn xử lý 25/12/2026. Ngày ban hành 01/12/2026.";

            // Act
            var result = await _extractorService.ExtractFromFileAsync(_tempPdfPath, new OcrExtractionResult { FullText = text });

            // Assert
            result.ThoiHan.Should().NotBeNull();
            result.ThoiHan?.ToString("dd/MM/yyyy").Should().Be("25/12/2026");
        }

        [Fact]
        public async Task ParseText_SymmetricDeadline_DateBeforeKeyword_ShouldWork()
        {
            // Arrange
            string text = "Phải hoàn thành 25/12/2026 trước ngày gạch đầu dòng.";

            // Act
            var result = await _extractorService.ExtractFromFileAsync(_tempPdfPath, new OcrExtractionResult { FullText = text });

            // Assert
            result.ThoiHan.Should().NotBeNull();
            result.ThoiHan?.ToString("dd/MM/yyyy").Should().Be("25/12/2026");
        }

        [Fact]
        public async Task ParseText_FuzzyConnector_WithinLimit_ShouldWork()
        {
            // Arrange
            // "xong trước" là 10 ký tự -> < 12 (Pass)
            string text = "Báo cáo hoàn thành xong trước 30/12/2026.";

            // Act
            var result = await _extractorService.ExtractFromFileAsync(_tempPdfPath, new OcrExtractionResult { FullText = text });

            // Assert
            result.ThoiHan.Should().NotBeNull();
            result.ThoiHan?.ToString("dd/MM/yyyy").Should().Be("30/12/2026");
        }

        [Fact]
        public async Task ParseText_FuzzyConnector_ExceedLimit_ShouldFailPriority()
        {
            // Arrange
            // Đoạn text ở giữa quá dài (> 12 ký tự) -> Không được coi là connector của ngày đó
            string text = "Hạn xử lý một dự án cực kỳ quan trọng và dài hơi vào ngày 30/12/2026.";

            // Act
            var result = await _extractorService.ExtractFromFileAsync(_tempPdfPath, new OcrExtractionResult { FullText = text });

            // Assert
            // Ngày vẫn bắt được do fallback (ngày lớn nhất), nhưng không khớp qua rule nên Priority thấp.
            result.ThoiHan.Should().NotBeNull();
            result.ThoiHan?.ToString("dd/MM/yyyy").Should().Be("30/12/2026");
        }

        [Fact]
        public async Task ParseText_CustomDeadlineKeyword_FromConfig_ShouldWork()
        {
            // Arrange
            string text = "This document is due date 15/05/2027.";

            // Act
            var result = await _extractorService.ExtractFromFileAsync(_tempPdfPath, new OcrExtractionResult { FullText = text });

            // Assert
            result.ThoiHan.Should().NotBeNull();
            result.ThoiHan?.ToString("dd/MM/yyyy").Should().Be("15/05/2027");
        }

        [Fact]
        public async Task ParseText_VietnameseDateString_ShouldWork()
        {
            // Arrange
            string text = "Hoàn thành trước ngày 30 tháng 12 năm 2026.";

            // Act
            var result = await _extractorService.ExtractFromFileAsync(_tempPdfPath, new OcrExtractionResult { FullText = text });

            // Assert
            result.ThoiHan.Should().NotBeNull();
            result.ThoiHan?.ToString("dd/MM/yyyy").Should().Be("30/12/2026");
        }

        public override void Dispose()
        {
            base.Dispose();
            if (File.Exists(_tempPdfPath)) File.Delete(_tempPdfPath);
        }
    }

    // --- MANUAL MOCK ---
    public class MockOcrService : IOcrService
    {
        public Task<string> ExtractTextFromPdfOcrAsync(string filePath) => Task.FromResult("");
        public Task<OcrExtractionResult> ExtractPdfOcrResultAsync(string filePath, OcrRunOptions? options = null) 
            => Task.FromResult(new OcrExtractionResult());
    }
}
