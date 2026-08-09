using System;
using System.Threading.Tasks;
using Xunit;
using Moq;
using ToolCalendar.Services;
using ToolCalendar.Core.Data.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using System.Net.Http;

namespace ToolCalendar.Tests
{
    public class NewRegexTest
    {
        [Fact]
        public async Task Test_Deadline_With_Time()
        {
            var mockSettingRepo = new Mock<ISettingRepository>();
            mockSettingRepo.Setup(x => x.GetAppSetting("Document_DeadlineKeywords", It.IsAny<string>()))
                           .Returns("hoàn thành trong ngày, hoàn thành trước ngày, trước, ngày");
            mockSettingRepo.Setup(x => x.GetAppSetting("Document_DeadlineExcludeKeywords", It.IsAny<string>()))
                           .Returns("vào khoảng, phát hiện, sinh năm, xảy ra, tại bãi, vào ngày, ngày xảy, được phát hiện, lúc khoảng");
            mockSettingRepo.Setup(x => x.GetAppSetting("Document_MinDeadlineDays", It.IsAny<string>()))
                           .Returns("0");

            var mockServiceProvider = new Mock<IServiceProvider>();
            mockServiceProvider.Setup(x => x.GetService(typeof(ISettingRepository))).Returns(mockSettingRepo.Object);

            var mockScope = new Mock<IServiceScope>();
            mockScope.Setup(x => x.ServiceProvider).Returns(mockServiceProvider.Object);

            var mockScopeFactory = new Mock<IServiceScopeFactory>();
            mockScopeFactory.Setup(x => x.CreateScope()).Returns(mockScope.Object);

            var service = new OcrTextProcessingService(mockScopeFactory.Object, null, null);
            string text = @"Số: 9679/SNN&MT-QLĐĐ
Quảng Ninh, ngày 20 tháng 7 năm 2026
hoàn thành và báo cáo kết quả về UBND tỉnh chậm nhất ngày 25/7/2026
Đề nghị các địa phương gửi báo cáo về Sở Nông nghiệp và Môi trường trước 16h ngày 22/7/2026";
            
            var result = await service.ParseTextAsync(text, "test.pdf");
            Assert.Equal(new DateTime(2026, 7, 22), result.ThoiHan);
        }
    }
}
