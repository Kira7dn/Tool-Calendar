using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ToolCalender.Data;

namespace ToolCalender.Api.Controllers
{
    [Authorize(Roles = "Admin,LanhDao,VanThu")]
    [ApiController]
    [Route("api/[controller]")]
    public class StatsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetStats()
        {
            var all = DatabaseService.GetAll();
            
            var stats = new {
                Total = all.Count,
                Urgent = all.Count(d => d.SoNgayConLai >= 1 && d.SoNgayConLai <= 7),
                Overdue = all.Count(d => d.SoNgayConLai < 0),
                Today = all.Count(d => d.SoNgayConLai == 0)
            };
            
            return Ok(stats);
        }
    }
}
