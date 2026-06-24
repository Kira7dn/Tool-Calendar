using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

        public RoomsController(IRoomRepository roomRepository)
        {
            _roomRepository = roomRepository;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllRooms()
        {
            var rooms = await _roomRepository.GetAllAsync();
            return Ok(ApiResponse.Ok(rooms));
        }

        [HttpPost]
        [Authorize(Policy = "RequireAdminOrLanhDao")]
        public async Task<IActionResult> CreateRoom([FromBody] Room request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(ApiResponse.Fail("Tên phòng họp không được để trống."));

            var newId = await _roomRepository.CreateAsync(request);
            return Ok(ApiResponse.Ok(new { Id = newId }, "Thêm phòng họp thành công."));
        }

        [HttpPut("{id}/status")]
        [Authorize(Policy = "RequireAdminOrLanhDao")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusRequest request)
        {
            var success = await _roomRepository.UpdateStatusAsync(id, request.Status);
            if (!success)
                return NotFound(ApiResponse.Fail("Không tìm thấy phòng họp."));

            return Ok(ApiResponse.Ok("Cập nhật trạng thái thành công."));
        }
    }

    public class UpdateStatusRequest
    {
        public int Status { get; set; }
    }
}
