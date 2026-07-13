using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using System.Net.Http.Json;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;
using Xunit;

namespace ToolCalendar.Tests.Cabinet
{
    public class CabinetMeetingsTests : IntegrationTestBase
    {
        public CabinetMeetingsTests() : base()
        {
        }

        [Fact]
        public async Task CreateMeeting_AsAdmin_ShouldSucceed()
        {
            // Arrange
            await AuthenticateAsync("admin", "admin123");

            // 1. Create a room first
            var roomRequest = new Room { Name = "Phòng họp số 2", Status = 1 };
            var roomResponse = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/rooms", roomRequest);
            var roomContent = await roomResponse.Content.ReadAsStringAsync();
            if (!roomResponse.IsSuccessStatusCode) throw new Exception(roomContent);
            var roomResult = await roomResponse.Content.ReadFromJsonAsync<ApiResponse<Room>>();
            int roomId = roomResult!.Data!.Id;

            // 2. Create the meeting
            var meetingRequest = new CreateMeetingRequest
            {
                Title = "Họp giao ban tháng",
                StartTime = DateTime.UtcNow.AddDays(1),
                EndTime = DateTime.UtcNow.AddDays(1).AddHours(2),
                RoomId = roomId,
                Presider = "Chủ tịch UBND",
                ExpectedAttendees = 10
            };

            // Act
            var meetingRes = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/meetings", meetingRequest);
            var meetingContent = await meetingRes.Content.ReadAsStringAsync();
            if (!meetingRes.IsSuccessStatusCode) throw new Exception(meetingContent);
            
            var result = await meetingRes.Content.ReadFromJsonAsync<ApiResponse<Meeting>>();

            // Assert
            result.Should().NotBeNull();
            result!.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data!.Title.Should().Be("Họp giao ban tháng");
            result.Data.Id.Should().BeGreaterThan(0);
        }

        [Fact]
        public async Task UpdateAttendance_ShouldChangeStatus()
        {
            // Arrange
            await AuthenticateAsync("admin", "admin123");
            var roomResponse = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/rooms", new Room { Name = "Phòng họp số 3", Status = 1 });
            var roomId = (await roomResponse.Content.ReadFromJsonAsync<ApiResponse<Room>>())!.Data!.Id;

            var meetingRequest = new CreateMeetingRequest
            {
                Title = "Họp điểm danh",
                StartTime = DateTime.UtcNow,
                EndTime = DateTime.UtcNow.AddHours(1),
                RoomId = roomId,
                Presider = "Phó Chủ tịch UBND",
                ParticipantUserIds = new List<int> { 1 }
            };
            var createResponse = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/meetings", meetingRequest);
            var meetingId = (await createResponse.Content.ReadFromJsonAsync<ApiResponse<Meeting>>())!.Data!.Id;

            int myId = 1; // Admin user id

            // Act
            var updateRequest = new { Status = "Có tham gia" };
            var response = await Client.PutAsJsonAsync($"/api/phonghopkhonggiayto/meetings/{meetingId}/attendance", updateRequest);

            // Assert
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
            
            result.Should().NotBeNull();
            result!.Success.Should().BeTrue();
        }
    }
}
