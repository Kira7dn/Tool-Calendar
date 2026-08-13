using Microsoft.Extensions.DependencyInjection;
using Xunit;
using FluentAssertions;
using ToolCalendar.Services;
using System.Threading.Tasks;
using ToolCalendar.Data;

namespace ToolCalendar.Tests
{
    public class OcrTextRegexTests : IntegrationTestBase
    {
        private readonly OcrTextProcessingService _service;

        public OcrTextRegexTests() : base()
        {
            var scopeFactory = Factory.Services.GetRequiredService<Microsoft.Extensions.DependencyInjection.IServiceScopeFactory>();
            var configuration = Factory.Services.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>();
            var httpClientFactory = Factory.Services.GetRequiredService<System.Net.Http.IHttpClientFactory>();
            _service = new OcrTextProcessingService(scopeFactory, configuration, httpClientFactory);
        }

        [Fact]
        public async Task ParseTextAsync_ShouldExtract_SoVanBan()
        {
            // Arrange
            string text = "UBND TỈNH QUẢNG NINH\nSỞ Y TẾ\n\nSố: 148 /SYT-NVY\nV/v phòng chống dịch bệnh\n...";
            
            // Act
            var result = await _service.ParseTextAsync(text, "test.pdf");

            // Assert
            result.SoVanBan.Should().Be("148/SYT-NVY");
            result.CoQuanChuQuan.Should().Be("UBND TỈNH QUẢNG NINH");
            result.CoQuanBanHanh.Should().Be("SỞ Y TẾ");
        }

        [Fact]
        public async Task ParseTextAsync_ShouldFixOcrDigitErrors()
        {
            // Arrange
            string text = "UBND TỈNH\nSố: f0/SYT-NVY\nV/v báo cáo ngày f1 tháng lO năm 2026\n...";
            
            // Act
            var result = await _service.ParseTextAsync(text, "test.pdf");

            // Assert
            result.SoVanBan.Should().Be("10/SYT-NVY");
        }

        [Fact]
        public async Task ParseTextAsync_ShouldSubtractOneDay_WhenKeywordContainsTruoc()
        {
            // Arrange
            // "hoàn thành trước ngày 15/08/2026" -> Hạn phải là 14/08/2026
            string text = "UBND TỈNH\nSố: 10/SYT-NVY\nYêu cầu hoàn thành trước ngày 15/08/2026 nhé\n...";
            
            // Act
            var result = await _service.ParseTextAsync(text, "test.pdf");

            // Assert
            result.ThoiHan.Should().HaveValue();
            result.ThoiHan.Value.Should().Be(new System.DateTime(2026, 8, 14));
        }
    }
}
