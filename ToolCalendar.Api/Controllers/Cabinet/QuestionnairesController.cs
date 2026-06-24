using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToolCalendar.Core.Data.Repositories;
using ToolCalendar.Core.Models;

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
    }
}
