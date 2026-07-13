using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using System.Net.Http.Json;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;
using Xunit;

namespace ToolCalendar.Tests.Cabinet
{
    public class CabinetNotesTests : IntegrationTestBase
    {
        public CabinetNotesTests() : base()
        {
        }

        [Fact]
        public async Task CreateNote_WithDummyFile_ShouldSucceed()
        {
            // Arrange
            await AuthenticateAsync("admin", "admin123");

            // Create room and meeting to link the note
            var roomRes = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/rooms", new Room { Name = "Phòng ghi chú", Status = 1 });
            var roomId = (await roomRes.Content.ReadFromJsonAsync<ApiResponse<Room>>())!.Data!.Id;

            var meetingReq = new CreateMeetingRequest { Title = "Họp test ghi chú", StartTime = DateTime.UtcNow, EndTime = DateTime.UtcNow.AddHours(1), RoomId = roomId };
            var meetingRes = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/meetings", meetingReq);
            var meetingId = (await meetingRes.Content.ReadFromJsonAsync<ApiResponse<Meeting>>())!.Data!.Id;

            // Act: Multipart form data upload
            using var content = new MultipartFormDataContent();
            content.Add(new StringContent(meetingId.ToString()), "meetingId");
            content.Add(new StringContent("Ghi chú cá nhân của tôi về cuộc họp"), "content");

            var fileContent = new ByteArrayContent(new byte[] { 1, 2, 3, 4 });
            fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/plain");
            content.Add(fileContent, "files", "dummy_note.txt");

            var response = await Client.PostAsync("/api/phonghopkhonggiayto/notes", content);

            // Assert
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<ApiResponse<MeetingNote>>();
            
            result.Should().NotBeNull();
            result!.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data!.Content.Should().Be("Ghi chú cá nhân của tôi về cuộc họp");
            result.Data.MeetingId.Should().Be(meetingId);
        }

        [Fact]
        public async Task GetMyNotes_ShouldReturnMyNotes()
        {
            // Arrange
            await AuthenticateAsync("admin", "admin123");

            // Act
            var response = await Client.GetAsync("/api/phonghopkhonggiayto/notes");

            // Assert
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<ApiResponse<List<MeetingNote>>>();
            
            result.Should().NotBeNull();
            result!.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
        }
    }
}
