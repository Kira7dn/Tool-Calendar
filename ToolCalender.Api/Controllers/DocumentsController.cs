using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ToolCalender.Data;
using ToolCalender.Models;
using ToolCalender.Services;

namespace ToolCalender.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet]
        public IActionResult GetAll()
        {
            var data = DatabaseService.GetAll();
            return Ok(data);
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("{id}")]
        public IActionResult GetById(int id)
        {
            var data = DatabaseService.GetAll().FirstOrDefault(x => x.Id == id);
            if (data == null) return NotFound();
            return Ok(data);
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPost("upload")]
        public async Task<IActionResult> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("Không có file.");

            // Lưu file tạm thời để xử lý OCR
            var tempPath = Path.Combine(Path.GetTempPath(), file.FileName);
            using (var stream = new FileStream(tempPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            try 
            {
                // Gọi Logic bóc tách dữ liệu (đã chuyển sang Tesseract)
                var record = await DocumentExtractorService.ExtractFromFileAsync(tempPath);
                
                // Trả về dữ liệu đã bóc tách để người dùng rà soát trên Web UI
                return Ok(record);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi xử lý OCR: {ex.Message}");
            }
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPost]
        public IActionResult Create([FromBody] DocumentRecord record)
        {
            if (record == null) return BadRequest();
            int id = DatabaseService.Insert(record);
            record.Id = id;
            return CreatedAtAction(nameof(GetById), new { id = record.Id }, record);
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPut("{id}")]
        public IActionResult Update(int id, [FromBody] DocumentRecord record)
        {
            if (record == null) return BadRequest();
            record.Id = id;
            DatabaseService.Update(record);
            return NoContent();
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public IActionResult Delete(int id)
        {
            DatabaseService.Delete(id);
            return NoContent();
        }
    }
}
