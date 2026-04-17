using Xunit;
using FluentAssertions;
using ToolCalender.Services;
using ToolCalender.Tests.Helpers;
using System.IO;

namespace ToolCalender.Tests
{
    public class OcrAutomationTests
    {
        private string GetResultsFolder()
        {
            string path = @"d:\Business Analyze\ToolCalendar\tests\test_results";
            if (!Directory.Exists(path)) Directory.CreateDirectory(path);
            return path;
        }

        [Fact]
        public async Task OcrProfessional_FullLongDocument_WithNoiseAndSkew_ShouldSucceed()
        {
            // --- ARRANGE ---
            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, "Full_Professional_Noisy_Doc.pdf");
            
            // Dữ liệu "siêu khó" để AI bóc tách từ biển chữ 500 từ
            string expectedSoVb = "888/STTTT-BCĐ";
            string expectedThoiHan = "25/12/2026";

            // BƯỚC 1: Sinh công văn chuyên nghiệp dài hơi, có dấu, chữ ký, con dấu và NHIỄU + NGHIÊNG
            AutomationDocHelper.GenerateProfessionalImagePdf(pdfPath, expectedSoVb, expectedThoiHan);

            // --- ACT ---
            // AI sẽ phải đối mặt với file ảnh 100% bị nghiêng 5 độ và bị nhòe (Blur)
            var docData = await DocumentExtractorService.ExtractFromFileAsync(pdfPath);

            // Ghi nhật ký kết quả bóc tách để anh xem
            string logPath = Path.Combine(resultsFolder, "extraction_results_final.txt");
            string logContent = $"--- KẾT QUẢ BÓC TÁCH TỪ VĂN BẢN 500 CHỮ (NHIỄU) ---\n" +
                               $"Số hiệu tìm thấy: {docData.SoVanBan}\n" +
                               $"Hạn xử lý tìm thấy: {docData.ThoiHan?.ToString("dd/MM/yyyy")}\n" +
                               $"Trích yếu: {docData.TrichYeu}\n";
            File.WriteAllText(logPath, logContent);

            // --- ASSERT ---
            docData.SoVanBan.Should().Contain("888");
            docData.ThoiHan.Should().NotBeNull();
            docData.ThoiHan?.ToString("dd/MM/yyyy").Should().Be(expectedThoiHan);
        }

        [Fact]
        public async Task FullWorkflow_StandardDocument_ShouldPass()
        {
            string resultsFolder = GetResultsFolder();
            string pdfPath = Path.Combine(resultsFolder, "Standard_Long_Doc.pdf");
            AutomationDocHelper.GenerateStandardPdf(pdfPath, "777/TEST-VB", "18/04/2026", "01/01/2027");
            
            var docData = await DocumentExtractorService.ExtractFromFileAsync(pdfPath);
            
            docData.SoVanBan.Should().Contain("777");
            docData.ThoiHan?.Year.Should().Be(2027);
        }
    }
}
