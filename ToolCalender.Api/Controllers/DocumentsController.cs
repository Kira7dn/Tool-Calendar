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
        private readonly IDocumentExtractorService _extractor;
        private readonly IOcrQueueService _ocrQueue;
        private readonly INotificationManager _notificationManager;
        private readonly IWebHostEnvironment _env;

        public DocumentsController(IDocumentExtractorService extractor, IOcrQueueService ocrQueue, INotificationManager notificationManager, IWebHostEnvironment env)
        {
            _extractor = extractor;
            _ocrQueue = ocrQueue;
            _notificationManager = notificationManager;
            _env = env;
        }
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

            // 1. Lưu file vào thư mục Uploads
            var uploadsDir = Path.Combine(_env.ContentRootPath, "Uploads");
            Directory.CreateDirectory(uploadsDir);
            
            var fileName = $"{Guid.NewGuid()}_{file.FileName}";
            var filePath = Path.Combine(uploadsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            try 
            {
                // 2. Tạo bản ghi tạm thời trong DB
                var record = new DocumentRecord
                {
                    SoVanBan = Path.GetFileNameWithoutExtension(file.FileName),
                    FilePath = filePath,
                    Status = "Đang xử lý",
                    NgayThem = DateTime.Now
                };
                
                int id = DatabaseService.Insert(record);
                record.Id = id;

                // 3. Đẩy vào hàng đợi OCR xử lý nền
                await _ocrQueue.EnqueueAsync(id);
                
                return Ok(record);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi khởi tạo upload: {ex.Message}");
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

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPost("{id}/assign")]
        public async Task<IActionResult> Assign(int id, [FromBody] AssignmentRequest request)
        {
            if (request == null) return BadRequest();
            
            // 1. Thực hiện gán trong DB
            DatabaseService.AssignDocument(id, request.DepartmentId, request.UserId);

            // 2. Gửi thông báo tức thời cho Cán bộ (nếu có user được gán)
            if (request.UserId.HasValue)
            {
                var doc = DatabaseService.GetAll().FirstOrDefault(x => x.Id == id);
                if (doc != null)
                {
                    await _notificationManager.SendToUserAsync(
                        request.UserId.Value,
                        "Giao việc mới",
                        $"Bạn được giao xử lý văn bản số {doc.SoVanBan}: {doc.TenCongVan}",
                        new { docId = id, type = "assignment" }
                    );
                }
            }

            return Ok(new { message = "Giao việc thành công." });
        }

        [Authorize(Roles = "Admin,CanBo")]
        [HttpPost("{id}/submit-evidence")]
        public async Task<IActionResult> SubmitEvidence(int id, [FromForm] List<IFormFile> files, [FromForm] string notes)
        {
            if (files == null || files.Count == 0) return BadRequest("Cần ít nhất một file bằng chứng.");

            var doc = DatabaseService.GetAll().FirstOrDefault(x => x.Id == id);
            if (doc == null) return NotFound();

            // 1. Tạo thư mục lưu bằng chứng cho văn bản này
            var evidenceDir = Path.Combine(_env.ContentRootPath, "Uploads", "Evidence", $"Doc_{id}");
            Directory.CreateDirectory(evidenceDir);

            var savedPaths = new List<string>();
            foreach (var file in files)
            {
                var fileName = $"{DateTime.Now:yyyyMMddHHmmss}_{file.FileName}";
                var filePath = Path.Combine(evidenceDir, fileName);
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }
                savedPaths.Add(filePath);
            }

            // 2. Cập nhật vào DB (Lưu danh sách path dưới dạng JSON)
            var evidenceJson = System.Text.Json.JsonSerializer.Serialize(savedPaths);
            DatabaseService.SubmitEvidence(id, evidenceJson, notes);

            return Ok(new { message = "Nộp bằng chứng hoàn thành thành công.", paths = savedPaths });
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public IActionResult Delete(int id)
        {
            DatabaseService.Delete(id);
            return NoContent();
        }
    }

    public class AssignmentRequest
    {
        public int? DepartmentId { get; set; }
        public int? UserId { get; set; }
    }
}
