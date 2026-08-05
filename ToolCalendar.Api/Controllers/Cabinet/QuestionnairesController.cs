using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Data.Repositories;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Controllers.Cabinet
{
    [Route("api/phonghopkhonggiayto/questionnaires")]
    [ApiController]
    [Authorize]
    public class QuestionnairesController : ControllerBase
    {
        private readonly IQuestionnaireRepository _repo;

        public QuestionnairesController(IQuestionnaireRepository repo)
        {
            _repo = repo;
        }

        [HttpGet]
        public async Task<IActionResult> GetQuestionnaires([FromQuery] string? status = null)
        {
            var data = await _repo.GetAllAsync(status);
            return Ok(ApiResponse.Ok(data));
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromForm] string title, [FromForm] int? templateId, 
            [FromForm] string? type, [FromForm] string? content, [FromForm] string? assignedUserIdsStr, 
            [FromForm] DateTime deadline, [FromForm] List<IFormFile>? files)
        {
            if (string.IsNullOrWhiteSpace(title))
                return BadRequest(ApiResponse.Fail("Tên phiếu không được để trống."));

            var savedPaths = new List<string>();

            // Handle file uploads (save to Uploads/questionnaires/)
            if (files != null && files.Count > 0)
            {
                var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Cabinet", "Questionnaires");
                Directory.CreateDirectory(uploadDir);

                foreach (var file in files)
                {
                    if (file.Length > 0)
                    {
                        var safeFileName = $"{Guid.NewGuid():N}_{Path.GetFileName(file.FileName)}";
                        var filePath = Path.Combine(uploadDir, safeFileName);
                        using var stream = new FileStream(filePath, FileMode.Create);
                        await file.CopyToAsync(stream);
                        savedPaths.Add($"Uploads/Cabinet/Questionnaires/{safeFileName}");
                    }
                }
            }

            var assignedUsers = new List<int>();
            if (!string.IsNullOrEmpty(assignedUserIdsStr))
            {
                try {
                    assignedUsers = System.Text.Json.JsonSerializer.Deserialize<List<int>>(assignedUserIdsStr) ?? new List<int>();
                } catch {
                    // Ignore parse errors, maybe they sent comma separated string?
                }
            }

            var req = new CreateQuestionnaireRequest
            {
                MeetingId = 0, // Placeholder if no meeting context
                Title = title,
                TemplateId = templateId,
                Type = type,
                Content = content,
                AssignedUserIds = assignedUsers,
                Deadline = deadline,
                AttachmentPaths = savedPaths
            };

            var newId = await _repo.CreateAsync(req);
            return Ok(ApiResponse.Ok(newId, "Tạo phiếu lấy ý kiến thành công."));
        }
    }
}
