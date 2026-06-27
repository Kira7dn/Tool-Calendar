using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Repositories;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Controllers.Cabinet
{
    [Route("api/phonghopkhonggiayto/rooms")]
    [ApiController]
    [Authorize]
    public class RoomsController : ControllerBase
    {
        private readonly IRoomRepository _roomRepository;
        private readonly string _connectionString;

        public RoomsController(IRoomRepository roomRepository, IConfiguration configuration)
        {
            _roomRepository = roomRepository;
            var dbPath = Environment.GetEnvironmentVariable("DB_PATH")
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ToolCalendar", "documents.db");
            _connectionString = $"Data Source={dbPath};Pooling=True;Default Timeout=30;Cache=Shared";
        }

        // GET /api/phonghopkhonggiayto/rooms
        [HttpGet]
        public async Task<IActionResult> GetAllRooms()
        {
            var rooms = await _roomRepository.GetAllAsync();
            return Ok(ApiResponse.Ok(rooms));
        }

        // GET /api/phonghopkhonggiayto/rooms/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetRoom(int id)
        {
            var room = await _roomRepository.GetByIdAsync(id);
            if (room == null)
                return NotFound(ApiResponse.Fail("Không tìm thấy phòng họp."));
            return Ok(ApiResponse.Ok(room));
        }

        // GET /api/phonghopkhonggiayto/rooms/departments
        [HttpGet("departments")]
        public async Task<IActionResult> GetDepartments()
        {
            var departments = new List<Department>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = "SELECT Id, Name, IsActive FROM Departments WHERE IsActive = 1 ORDER BY Name";
            using var cmd = new SqliteCommand(sql, connection);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                departments.Add(new Department
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Name = reader["Name"]?.ToString() ?? "",
                    IsActive = Convert.ToInt32(reader["IsActive"]) == 1
                });
            }
            return Ok(ApiResponse.Ok(departments));
        }

        // POST /api/phonghopkhonggiayto/rooms
        [HttpPost]
        [Authorize(Policy = "RequireAdminOrLanhDao")]
        public async Task<IActionResult> CreateRoom([FromBody] Room request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(ApiResponse.Fail("Tên phòng họp không được để trống."));

            var newId = await _roomRepository.CreateAsync(request);
            var created = await _roomRepository.GetByIdAsync(newId);
            return Ok(ApiResponse.Ok(created, "Thêm phòng họp thành công."));
        }

        // PUT /api/phonghopkhonggiayto/rooms/{id}
        [HttpPut("{id}")]
        [Authorize(Policy = "RequireAdminOrLanhDao")]
        public async Task<IActionResult> UpdateRoom(int id, [FromBody] Room request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(ApiResponse.Fail("Tên phòng họp không được để trống."));

            var success = await _roomRepository.UpdateAsync(id, request);
            if (!success)
                return NotFound(ApiResponse.Fail("Không tìm thấy phòng họp."));

            var updated = await _roomRepository.GetByIdAsync(id);
            return Ok(ApiResponse.Ok(updated, "Cập nhật phòng họp thành công."));
        }

        // PUT /api/phonghopkhonggiayto/rooms/{id}/status
        [HttpPut("{id}/status")]
        [Authorize(Policy = "RequireAdminOrLanhDao")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusRequest request)
        {
            var success = await _roomRepository.UpdateStatusAsync(id, request.Status);
            if (!success)
                return NotFound(ApiResponse.Fail("Không tìm thấy phòng họp."));

            return Ok(ApiResponse.Ok(null, "Cập nhật trạng thái thành công."));
        }

        // DELETE /api/phonghopkhonggiayto/rooms/{id}
        [HttpDelete("{id}")]
        [Authorize(Policy = "RequireAdminOrLanhDao")]
        public async Task<IActionResult> DeleteRoom(int id)
        {
            var success = await _roomRepository.DeleteAsync(id);
            if (!success)
                return BadRequest(ApiResponse.Fail("Không thể xóa phòng họp đang có lịch họp trong tương lai."));

            return Ok(ApiResponse.Ok(null, "Xóa phòng họp thành công."));
        }
    }

    public class UpdateStatusRequest
    {
        public int Status { get; set; }
    }
}
