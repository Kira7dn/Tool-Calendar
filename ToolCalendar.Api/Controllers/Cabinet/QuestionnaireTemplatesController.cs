using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Data.Repositories;
using ToolCalendar.Core.Models;
using ToolCalendar.Models;

namespace ToolCalendar.Api.Controllers.Cabinet
{
    [Route("api/phonghopkhonggiayto/questionnaire-templates")]
    [ApiController]
    [Authorize]
    public class QuestionnaireTemplatesController : ControllerBase
    {
        private readonly IQuestionnaireTemplateRepository _repo;

        public QuestionnaireTemplatesController(IQuestionnaireTemplateRepository repo)
        {
            _repo = repo;
        }

        [HttpGet]
        public async Task<IActionResult> GetTemplates()
        {
            var data = await _repo.GetAllAsync();
            return Ok(ApiResponse<List<QuestionnaireTemplate>>.Ok(data));
        }

        [HttpPost]
        public async Task<IActionResult> CreateTemplate([FromBody] QuestionnaireTemplate template)
        {
            if (string.IsNullOrWhiteSpace(template.Name))
            {
                return BadRequest(ApiResponse.Fail("Tên mẫu phiếu không hợp lệ."));
            }

            var newId = await _repo.CreateAsync(template);
            template.Id = newId;
            template.CreatedAt = DateTime.UtcNow;
            
            return Ok(ApiResponse<QuestionnaireTemplate>.Ok(template));
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTemplate(int id, [FromBody] QuestionnaireTemplate template)
        {
            if (string.IsNullOrWhiteSpace(template.Name))
            {
                return BadRequest(ApiResponse.Fail("Tên mẫu phiếu không hợp lệ."));
            }

            template.Id = id;
            await _repo.UpdateAsync(template);
            return Ok(ApiResponse.Ok("Cập nhật mẫu phiếu thành công."));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTemplate(int id)
        {
            await _repo.DeleteAsync(id);
            return Ok(ApiResponse.Ok("Xóa mẫu phiếu thành công."));
        }
    }
}
