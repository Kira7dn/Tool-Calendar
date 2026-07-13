using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using System.Net.Http.Json;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;
using Xunit;

namespace ToolCalendar.Tests.Cabinet
{
    public class CabinetRoomsTests : IntegrationTestBase
    {
        public CabinetRoomsTests() : base()
        {
        }

        [Fact]
        public async Task CreateRoom_AsAdmin_ShouldSucceed()
        {
            // Arrange
            await AuthenticateAsync("admin", "admin123");

            var request = new Room
            {
                Name = "Phòng họp số 1 (Test)"
            };

            // Act
            var response = await Client.PostAsJsonAsync("/api/phonghopkhonggiayto/rooms", request);

            // Assert
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<ApiResponse<Room>>();
            
            result.Should().NotBeNull();
            result!.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data!.Name.Should().Be("Phòng họp số 1 (Test)");
            result.Data.Id.Should().BeGreaterThan(0);
        }

        [Fact]
        public async Task GetAllRooms_ShouldReturnList()
        {
            // Arrange
            await AuthenticateAsync("admin", "admin123");

            // Act
            var response = await Client.GetAsync("/api/phonghopkhonggiayto/rooms");

            // Assert
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<ApiResponse<List<Room>>>();
            
            result.Should().NotBeNull();
            result!.Success.Should().BeTrue();
            result.Data.Should().NotBeNull();
        }
    }
}
