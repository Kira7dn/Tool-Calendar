using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using System.Net.Http.Json;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;
using Xunit;

namespace ToolCalendar.Tests.Cabinet
{
    public class CabinetConclusionsTests : IntegrationTestBase
    {
        public CabinetConclusionsTests() : base()
        {
        }

        [Fact]
        public async Task CreateAndGetConclusion_ShouldSucceed()
        {
            // Arrange
            await AuthenticateAsync("admin", "admin123");

            // Create room and meeting
            var roomRes = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/rooms", new Room { Name = "Phòng kết luận", Status = 1 });
            var roomContent = await roomRes.Content.ReadAsStringAsync();
            if (!roomRes.IsSuccessStatusCode) throw new Exception(roomContent);
            var roomId = (await roomRes.Content.ReadFromJsonAsync<ApiResponse<Room>>())!.Data!.Id;

            var meetingReq = new CreateMeetingRequest { Title = "Họp tổng kết", StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddHours(1), RoomId = roomId };
            var meetingRes = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/meetings", meetingReq);
            var meetingContent = await meetingRes.Content.ReadAsStringAsync();
            if (!meetingRes.IsSuccessStatusCode) throw new Exception(meetingContent);
            var meetingId = (await meetingRes.Content.ReadFromJsonAsync<ApiResponse<Meeting>>())!.Data!.Id;

            // Act - Create
            var createReq = new MeetingConclusion
            {
                MeetingId = meetingId,
                FileName = "Ket_luan_01.pdf",
                Status = "Chưa xử lý",
                Progress = 0
            };
            var createRes = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/conclusions", createReq);
            createRes.EnsureSuccessStatusCode();
            var createdData = (await createRes.Content.ReadFromJsonAsync<ApiResponse<MeetingConclusion>>())!.Data!;

            // Act - Get
            var getRes = await Client.GetAsync($"/api/phonghopkhonggiayto/conclusions/{createdData.Id}");

            // Assert
            getRes.EnsureSuccessStatusCode();
            var getResult = await getRes.Content.ReadFromJsonAsync<ApiResponse<MeetingConclusion>>();
            
            getResult.Should().NotBeNull();
            getResult!.Success.Should().BeTrue();
            getResult.Data.Should().NotBeNull();
            getResult.Data!.FileName.Should().Be("Ket_luan_01.pdf");
            getResult.Data.Progress.Should().Be(0);
        }

        [Fact]
        public async Task UpdateConclusionProgress_ShouldSucceed()
        {
            // Arrange
            await AuthenticateAsync("admin", "admin123");

            // Assuming there's a meeting ID 1 (or create one)
            var roomRes = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/rooms", new Room { Name = "Phòng kết luận 2", Status = 1 });
            var roomId = (await roomRes.Content.ReadFromJsonAsync<ApiResponse<Room>>())!.Data!.Id;

            var meetingReq = new CreateMeetingRequest { Title = "Họp giao ban 2", StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddHours(1), RoomId = roomId };
            var meetingRes = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/meetings", meetingReq);
            var meetingId = (await meetingRes.Content.ReadFromJsonAsync<ApiResponse<Meeting>>())!.Data!.Id;

            var createReq = new MeetingConclusion { MeetingId = meetingId, FileName = "KL2.pdf", Status = "Chưa xử lý", Progress = 0 };
            var createRes = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/conclusions", createReq);
            var createContent = await createRes.Content.ReadAsStringAsync();
            if (!createRes.IsSuccessStatusCode) throw new Exception(createContent);
            var conclusionId = (await createRes.Content.ReadFromJsonAsync<ApiResponse<MeetingConclusion>>())!.Data!.Id;

            // Act
            var updateReq = new { Status = "Đang xử lý", Progress = 50, LastHandlerId = 1 };
            var updateRes = await Client.PutAsJsonAsync($"/api/phonghopkhonggiayto/conclusions/{conclusionId}", updateReq);

            // Assert
            updateRes.EnsureSuccessStatusCode();
            var updateResult = await updateRes.Content.ReadFromJsonAsync<ApiResponse<MeetingConclusion>>();
            
            updateResult.Should().NotBeNull();
            updateResult!.Success.Should().BeTrue();
            updateResult.Data.Should().NotBeNull();
            updateResult.Data!.Progress.Should().Be(50);
            updateResult.Data!.Status.Should().Be("Đang xử lý");
        }
    }
}
