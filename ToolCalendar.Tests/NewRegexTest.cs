using System;
using Xunit;
using Moq;
using ToolCalendar.Core.Services;
using ToolCalendar.Core.Data.Repositories;

namespace ToolCalendar.Tests
{
    public class NewRegexTest
    {
        [Fact]
        public async void Test_Deadline_With_Time()
        {
            var mockSettingRepo = new Mock<ISettingRepository>();
            mockSettingRepo.Setup(x => x.GetAppSetting("Document_DeadlineKeywords", It.IsAny<string>()))
                           .Returns("hoàn thành trong ngày, hoàn thành trước ngày, trước, ngày");
            mockSettingRepo.Setup(x => x.GetAppSetting("Document_DeadlineExcludeKeywords", It.IsAny<string>()))
                           .Returns("vào khoảng, phát hiện, sinh năm, xảy ra, tại bãi, vào ngày, ngày xảy, được phát hiện, lúc khoảng");
            mockSettingRepo.Setup(x => x.GetAppSetting("Document_MinDeadlineDays", It.IsAny<string>()))
                           .Returns("0");

            var service = new OcrTextProcessingService(mockSettingRepo.Object, null);
            string text = @"Số: 9679/SNN&MT-QLĐĐ
Quảng Ninh, ngày 20 tháng 7 năm 2026
hoàn thành và báo cáo kết quả về UBND tỉnh chậm nhất ngày 25/7/2026
Đề nghị các địa phương gửi báo cáo về Sở Nông nghiệp và Môi trường trước 16h ngày 22/7/2026";
            
            var result = await service.ParseTextAsync(text, "test.pdf");
            Assert.Equal(new DateTime(2026, 7, 22), result.ThoiHan);
        }
    }
}
