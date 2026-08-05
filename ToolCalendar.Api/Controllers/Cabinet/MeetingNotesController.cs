using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Data.Repositories;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Controllers.Cabinet
{
    [Route("api/phonghopkhonggiayto/notes")]
    [ApiController]
    [Authorize]
    public class MeetingNotesController : ControllerBase
    {
        private readonly IMeetingNoteRepository _repo;
        private readonly IWebHostEnvironment _env;

        public MeetingNotesController(IMeetingNoteRepository repo, IWebHostEnvironment env)
        {
            _repo = repo;
            _env = env;
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)
                ?? User.FindFirst("sub")
                ?? User.FindFirst("id");
            return int.TryParse(claim?.Value, out var id) ? id : 0;
        }

        // GET /api/phonghopkhonggiayto/notes?search=...
        [HttpGet]
        public async Task<IActionResult> GetMyNotes([FromQuery] string? search)
        {
            var userId = GetCurrentUserId();
            var notes = await _repo.GetByUserAsync(userId, search);
            return Ok(ApiResponse.Ok(notes));
        }

        // POST /api/phonghopkhonggiayto/notes (multipart/form-data)
        [HttpPost]
        public async Task<IActionResult> Create([FromForm] int meetingId, [FromForm] string? content,
            [FromForm] List<IFormFile>? files)
        {
            if (meetingId <= 0)
                return BadRequest(ApiResponse.Fail("Cần chọn phiên họp."));

            var userId = GetCurrentUserId();
            var savedPaths = new List<string>();

            // Xử lý upload file đính kèm (lưu vào subfolder notes/)
            if (files != null && files.Count > 0)
            {
                var uploadDir = Path.Combine(_env.ContentRootPath, "Uploads", "Cabinet", "Notes");
                Directory.CreateDirectory(uploadDir);

                foreach (var file in files)
                {
                    if (file.Length > 0)
                    {
                        var safeFileName = $"{Guid.NewGuid():N}_{Path.GetFileName(file.FileName)}";
                        var filePath = Path.Combine(uploadDir, safeFileName);
                        using var stream = new FileStream(filePath, FileMode.Create);
                        await file.CopyToAsync(stream);
                        savedPaths.Add($"Uploads/Cabinet/Notes/{safeFileName}");
                    }
                }
            }

            var req = new CreateNoteRequest
            {
                MeetingId = meetingId,
                Content = content,
                AttachmentPaths = savedPaths
            };

            var newId = await _repo.CreateAsync(req, userId);
            var created = await _repo.GetByIdAsync(newId);
            return Ok(ApiResponse.Ok(created, "Đã lưu ghi chú thành công."));
        }

        // DELETE /api/phonghopkhonggiayto/notes/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetCurrentUserId();
            var success = await _repo.DeleteAsync(id, userId);
            if (!success)
                return NotFound(ApiResponse.Fail("Không tìm thấy ghi chú hoặc bạn không có quyền xóa."));
            return Ok(ApiResponse.Ok(null, "Đã xóa ghi chú."));
        }
    }
}
