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
        public IActionResult GetAll(
            [FromQuery] int page = 1,
            [FromQuery] int size = 10,
            [FromQuery] string search = "")
        {
            var (items, totalCount) = DatabaseService.GetPaged(page, size, search);
            var totalPages = (int)Math.Ceiling((double)totalCount / size);

            return Ok(new
            {
                data = items,
                page,
                pageSize = size,
                totalCount,
                totalPages
            });
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
            
            var fileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            var filePath = Path.Combine(uploadsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            try 
            {
                // 2. Gọi OCR trực tiếp để Client nhận được kết quả ngay lập tức
                var record = await _extractor.ExtractFromFileAsync(filePath);
                
                // Nếu SoVanBan trống thì mặc định lấy theo tên file
                if (string.IsNullOrWhiteSpace(record.SoVanBan))
                {
                    record.SoVanBan = Path.GetFileNameWithoutExtension(file.FileName);
                }

                record.FilePath = filePath;
                record.Status = record.Status == "Lỗi OCR" ? "Lỗi OCR" : "Chưa xử lý";
                record.NgayThem = DateTime.Now;
                
                // Lưu vào DB
                int id = DatabaseService.Insert(record);
                record.Id = id;
                
                return Ok(record);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi khởi tạo upload: {ex.Message}");
            }
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPost("bulk-confirm")]
        public IActionResult BulkConfirm([FromBody] List<int> ids)
        {
            if (ids == null || ids.Count == 0) return BadRequest("Danh sách ID trống.");
            
            // Cập nhật trạng thái thành "Đã rà soát"
            DatabaseService.BulkUpdateStatus(ids, "Đã rà soát");
            
            return Ok(new { message = $"Đã xác nhận thành công {ids.Count} văn bản." });
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpDelete("bulk-delete")]
        public IActionResult BulkDeleteBatch([FromBody] List<int> ids)
        {
            if (ids == null || ids.Count == 0) return BadRequest("Danh sách ID trống.");
            
            var allDocs = DatabaseService.GetAll();
            foreach(var id in ids)
            {
                var doc = allDocs.FirstOrDefault(x => x.Id == id);
                if (doc != null)
                {
                    if (!string.IsNullOrEmpty(doc.FilePath) && System.IO.File.Exists(doc.FilePath))
                    {
                        System.IO.File.Delete(doc.FilePath);
                    }
                    var evidenceDir = Path.Combine(_env.ContentRootPath, "Uploads", "Evidence", $"Doc_{id}");
                    if (Directory.Exists(evidenceDir))
                    {
                        Directory.Delete(evidenceDir, true);
                    }
                }
            }
            
            DatabaseService.BulkDelete(ids);
            
            return Ok(new { message = $"Đã xóa thành công {ids.Count} văn bản cùng toàn bộ file đính kèm." });
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
            
            var departmentIdsJson = System.Text.Json.JsonSerializer.Serialize(request.DepartmentIds ?? new List<int>());
            var userIdsJson = System.Text.Json.JsonSerializer.Serialize(request.UserIds ?? new List<int>());

            // 1. Thực hiện gán trong DB
            DatabaseService.AssignDocument(id, departmentIdsJson, userIdsJson);

            // 2. Gửi thông báo tức thời cho tất cả Cán bộ được gán
            if (request.UserIds != null && request.UserIds.Count > 0)
            {
                var doc = DatabaseService.GetAll().FirstOrDefault(x => x.Id == id);
                if (doc != null)
                {
                    foreach (var userId in request.UserIds)
                    {
                        await _notificationManager.SendToUserAsync(
                            userId,
                            "Giao việc mới",
                            $"Bạn được giao xử lý văn bản số {doc.SoVanBan}: {doc.TenCongVan}",
                            new { docId = id, type = "assignment" }
                        );
                    }
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

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("my-tasks")]
        public IActionResult GetMyTasks()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();
            var tasks = DatabaseService.GetAll().Where(d => d.AssignedTo == userId).OrderBy(d => d.ThoiHan).ToList();
            return Ok(tasks);
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("{id}/file")]
        public IActionResult GetFile(int id)
        {
            var doc = DatabaseService.GetAll().FirstOrDefault(x => x.Id == id);
            if (doc == null || string.IsNullOrEmpty(doc.FilePath)) return NotFound("File không tồn tại.");
            if (!System.IO.File.Exists(doc.FilePath)) return NotFound("File vật lý không tìm thấy.");
            var fileBytes = System.IO.File.ReadAllBytes(doc.FilePath);
            
            var ext = Path.GetExtension(doc.FilePath).ToLower();
            var mimeType = ext switch {
                ".pdf" => "application/pdf",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                _ => "application/octet-stream"
            };
            return File(fileBytes, mimeType);
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("{id}/evidence/{index}")]
        public IActionResult GetEvidenceFile(int id, int index)
        {
            var doc = DatabaseService.GetAll().FirstOrDefault(x => x.Id == id);
            if (doc == null || string.IsNullOrEmpty(doc.EvidencePaths)) return NotFound("Không tìm thấy bằng chứng.");
            try 
            {
                var paths = System.Text.Json.JsonSerializer.Deserialize<List<string>>(doc.EvidencePaths);
                if (paths == null || index < 0 || index >= paths.Count) return NotFound("Index file không hợp lệ.");
                
                var filePath = paths[index];
                if (!System.IO.File.Exists(filePath)) return NotFound("File vật lý không tìm thấy.");
                
                var ext = Path.GetExtension(filePath).ToLower();
                var mimeType = ext switch {
                    ".jpg" or ".jpeg" => "image/jpeg",
                    ".png" => "image/png",
                    ".pdf" => "application/pdf",
                    ".doc" => "application/msword",
                    ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    _ => "application/octet-stream"
                };
                return PhysicalFile(filePath, mimeType);
            } 
            catch { return BadRequest(); }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public IActionResult Delete(int id)
        {
            var doc = DatabaseService.GetAll().FirstOrDefault(x => x.Id == id);
            if (doc != null)
            {
                if (!string.IsNullOrEmpty(doc.FilePath) && System.IO.File.Exists(doc.FilePath))
                {
                    System.IO.File.Delete(doc.FilePath);
                }
                var evidenceDir = Path.Combine(_env.ContentRootPath, "Uploads", "Evidence", $"Doc_{id}");
                if (Directory.Exists(evidenceDir))
                {
                    Directory.Delete(evidenceDir, true);
                }
            }
            DatabaseService.Delete(id);
            return NoContent();
        }

        // =============================================
        // COMMENTS API
        // =============================================

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("{id}/comments")]
        public IActionResult GetComments(int id)
        {
            var comments = DatabaseService.GetComments(id);
            // Attach reactions for each comment
            var result = comments.Select(c => new {
                c.Id,
                c.DocumentId,
                c.UserId,
                c.Username,
                c.Content,
                c.CreatedAt,
                Reactions = DatabaseService.GetReactionsForComment(c.Id)
                    .GroupBy(r => r.ReactionType)
                    .ToDictionary(g => g.Key, g => new {
                        Count = g.Count(),
                        Users = g.Select(r => r.Username).ToList()
                    })
            });
            return Ok(result);
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpPost("{id}/comments")]
        public IActionResult AddComment(int id, [FromBody] CommentRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.Content))
                return BadRequest("Nội dung comment không được trống.");

            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
            var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Unknown";

            var comment = new Comment
            {
                DocumentId = id,
                UserId = userId,
                Username = username,
                Content = req.Content
            };
            DatabaseService.InsertComment(comment);
            return Ok(new { message = "Đã thêm comment thành công." });
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpDelete("{docId}/comments/{commentId}")]
        public IActionResult DeleteComment(int docId, int commentId)
        {
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";
            bool isAdmin = role == "Admin";

            DatabaseService.DeleteComment(commentId, userId, isAdmin);
            return Ok(new { message = "Đã xóa comment." });
        }

        // =============================================
        // REACTIONS API
        // =============================================

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpPost("{docId}/comments/{commentId}/react")]
        public IActionResult ReactToComment(int docId, int commentId, [FromBody] ReactionRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.ReactionType))
                return BadRequest("Loại reaction không hợp lệ.");

            var validTypes = new[] { "like", "love", "hate", "dislike" };
            if (!validTypes.Contains(req.ReactionType.ToLower()))
                return BadRequest("Reaction type phải là: like, love, hate, dislike.");

            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
            var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Unknown";

            var result = DatabaseService.ToggleReaction(commentId, userId, username, req.ReactionType.ToLower());

            var updatedReactions = DatabaseService.GetReactionsForComment(commentId)
                .GroupBy(r => r.ReactionType)
                .ToDictionary(g => g.Key, g => new {
                    Count = g.Count(),
                    Users = g.Select(r => r.Username).ToList()
                });

            return Ok(new { status = result, reactions = updatedReactions });
        }
    }

    public class AssignmentRequest
    {
        public List<int>? DepartmentIds { get; set; }
        public List<int>? UserIds { get; set; }
    }

    public class CommentRequest
    {
        public string Content { get; set; } = "";
    }

    public class ReactionRequest
    {
        public string ReactionType { get; set; } = "";
    }
}
