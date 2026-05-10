using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Data;
using ToolCalendar.Hubs;
using ToolCalendar.Models;
using ToolCalendar.Services;

namespace ToolCalendar.Api.Controllers
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
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly IDocumentRepository _documentRepository;

        public DocumentsController(IDocumentExtractorService extractor, IOcrQueueService ocrQueue, INotificationManager notificationManager, IWebHostEnvironment env, IHubContext<NotificationHub> hubContext, IDocumentRepository documentRepository)
        {
            _extractor = extractor;
            _ocrQueue = ocrQueue;
            _notificationManager = notificationManager;
            _env = env;
            _hubContext = hubContext;
            _documentRepository = documentRepository;
        }
        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] int page = 1,
            [FromQuery] int size = 10,
            [FromQuery] string search = "",
            [FromQuery] string status = "",
            [FromQuery] string sort = "deadline_asc")
        {
            var (items, totalCount) = await _documentRepository.GetPagedAsync(page, size, search, status, sort);
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
        [HttpGet("statuses")]
        public async Task<IActionResult> GetStatuses()
        {
            var statuses = await _documentRepository.GetUniqueStatusesAsync();
            return Ok(statuses);
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var data = await _documentRepository.GetDocumentByIdAsync(id);
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

            DocumentRecord record;
            try
            {
                // 2. Gọi OCR trực tiếp để Client nhận được kết quả ngay lập tức
                record = await _extractor.ExtractFromFileAsync(filePath);
                
                // 3. Lưu đường dẫn tương đối vào DB
                record.FilePath = $"Uploads/{fileName}";
                record.Status = "Chưa xử lý";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OCR_CRITICAL_ERROR] {ex}");
                record = new DocumentRecord
                {
                    Status = "Lỗi OCR",
                    FilePath = $"Uploads/{fileName}",
                    FullText = $"[Lỗi hệ thống OCR] Không thể trích xuất tự động. Vui lòng nhập tay. Chi tiết lỗi: {ex.Message}"
                };
            }

            // Nếu SoVanBan trống thì mặc định lấy theo tên file
            if (string.IsNullOrWhiteSpace(record.SoVanBan))
            {
                record.SoVanBan = Path.GetFileNameWithoutExtension(file.FileName);
            }

            // record.FilePath đã được set là đường dẫn tương đối ở trên
            // Đảm bảo mapping status chuẩn cho frontend
            record.Status = record.Status == "Lỗi OCR" ? "Lỗi OCR" : "Chưa xử lý";
            record.NgayThem = DateTime.Now;

            // Lưu vào DB kể cả khi OCR lỗi, để UI có ID thật và mở được ảnh con mắt (Preview)
            int id = await _documentRepository.InsertAsync(record);
            record.Id = id;

            return Ok(record);
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPost("bulk-confirm")]
        public async Task<IActionResult> BulkConfirm([FromBody] List<int> ids)
        {
            if (ids == null || ids.Count == 0) return BadRequest("Danh sách ID trống.");

            // Cập nhật trạng thái thành "Đã rà soát"
            await _documentRepository.BulkUpdateStatusAsync(ids, "Đã rà soát");

            return Ok(new { message = $"Đã xác nhận thành công {ids.Count} văn bản." });
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpDelete("bulk-delete")]
        public async Task<IActionResult> BulkDeleteBatch([FromBody] List<int> ids)
        {
            if (ids == null || ids.Count == 0) return BadRequest("Danh sách ID trống.");

            var allDocs = await _documentRepository.GetAllAsync();
            foreach (var id in ids)
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

            await _documentRepository.BulkDeleteAsync(ids);

            return Ok(new { message = $"Đã xóa thành công {ids.Count} văn bản cùng toàn bộ file đính kèm." });
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] DocumentRecord record)
        {
            if (record == null) return BadRequest();
            int id = await _documentRepository.InsertAsync(record);
            record.Id = id;
            return CreatedAtAction(nameof(GetById), new { id = record.Id }, record);
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] DocumentRecord record)
        {
            if (record == null) return BadRequest();
            record.Id = id;

            var existing = await _documentRepository.GetDocumentByIdAsync(id);
            await _documentRepository.UpdateAsync(record);

            // Nếu có sự thay đổi về người được giao hoặc gán mới
            if (record.AssignedTo.HasValue && record.AssignedTo != existing?.AssignedTo)
            {
                try {
                    await _notificationManager.SendToUserAsync(
                        record.AssignedTo.Value,
                        "Công việc được giao mới",
                        $"Văn bản {record.SoVanBan} đã được giao cho bạn xử lý.",
                        new { docId = id, type = "assignment" }
                    );
                } catch { }
            }

            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = id, status = record.Status });
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
            await _documentRepository.AssignDocumentAsync(id, departmentIdsJson, userIdsJson);

            // 2. Gửi thông báo tức thời cho tất cả Cán bộ được gán
            if (request.UserIds != null && request.UserIds.Count > 0)
            {
                var doc = await _documentRepository.GetDocumentByIdAsync(id);
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

            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound();

            // 1. Tạo thư mục lưu bằng chứng cho văn bản này
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
                // Lưu đường dẫn tương đối để đảm bảo hoạt động trên mọi môi trường (Docker/Linux/Windows)
                savedPaths.Add($"Uploads/Evidence/Doc_{id}/{fileName}");
            }

            // 2. Cập nhật vào DB (Lưu danh sách path dưới dạng JSON)
            var evidenceJson = System.Text.Json.JsonSerializer.Serialize(savedPaths);
            await _documentRepository.SubmitEvidenceAsync(id, evidenceJson, notes);

            // 3. Thông báo SignalR để các máy khác cập nhật giao diện (Dashboard, List)
            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = id, status = "Đã hoàn thành" });

            // 4. Ghi nhận hoạt động cán bộ cho dashboard
            try
            {
                var currentUserIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (int.TryParse(currentUserIdStr, out int currentUserId))
                {
                    DatabaseService.InsertAuditLog(currentUserId, $"Đã nộp bằng chứng hoàn thành văn bản {doc.SoVanBan}.");
                }
            }
            catch { }

            // 5. Gửi thông báo cho người giao việc
            try {
                var currentUserName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Cán bộ";
                await _notificationManager.SendToUserAsync(
                    doc.UploadedByUserId, 
                    "Công việc đã hoàn thành", 
                    $"{currentUserName} đã nộp bằng chứng và hoàn thành văn bản: {doc.SoVanBan}",
                    new { docId = id, type = "completed" }
                );
            } catch { }

            return Ok(new { message = "Nộp bằng chứng hoàn thành thành công.", paths = savedPaths });
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("my-tasks")]
        public async Task<IActionResult> GetMyTasks()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();
            var allDocs = await _documentRepository.GetAllAsync();
            var tasks = allDocs
                .Where(d => {
                    // Kiểm tra xem user có trong danh sách phân công không
                    bool isAssigned = (d.AssignedTo == userId);
                    if (!isAssigned && !string.IsNullOrEmpty(d.AssignedUserIds))
                    {
                        try {
                            var uids = System.Text.Json.JsonSerializer.Deserialize<List<int>>(d.AssignedUserIds);
                            if (uids != null && uids.Contains(userId)) isAssigned = true;
                        } catch { }
                    }
                    
                    // Chỉ lấy các việc chưa hoàn thành
                    bool isNotDone = d.Status != "Đã hoàn thành";
                    
                    return isAssigned && isNotDone;
                })
                .OrderBy(d => d.ThoiHan)
                .ToList();
            return Ok(tasks);
        }

        [AllowAnonymous]
        [HttpGet("{id}/file")]
        public async Task<IActionResult> GetFile(int id)
        {
            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc == null || string.IsNullOrEmpty(doc.FilePath)) return NotFound("File không tồn tại.");
            
            // Lấy đường dẫn từ DB và chuẩn hóa dấu gạch chéo cho Linux
            var normalizedPath = doc.FilePath.Replace('\\', '/').TrimStart('/');
            var filePath = Path.Combine(_env.ContentRootPath, normalizedPath);
            
            if (!System.IO.File.Exists(filePath)) return NotFound($"File vật lý không tìm thấy tại: {normalizedPath}");
            var fileBytes = System.IO.File.ReadAllBytes(filePath);

            var ext = Path.GetExtension(doc.FilePath).ToLower();
            var mimeType = ext switch
            {
                ".pdf" => "application/pdf",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                _ => "application/octet-stream"
            };
            return File(fileBytes, mimeType);
        }

        [AllowAnonymous]
        [HttpGet("{id}/evidence/{index}")]
        public async Task<IActionResult> GetEvidenceFile(int id, int index)
        {
            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc == null || string.IsNullOrEmpty(doc.EvidencePaths)) return NotFound("Không tìm thấy bằng chứng.");
            try
            {
                var paths = System.Text.Json.JsonSerializer.Deserialize<List<string>>(doc.EvidencePaths);
                if (paths == null || index < 0 || index >= paths.Count) return NotFound("Index file không hợp lệ.");

                var relativePath = paths[index];
                var normalizedPath = relativePath.Replace('\\', '/').TrimStart('/');
                var filePath = Path.Combine(_env.ContentRootPath, normalizedPath);
                
                if (!System.IO.File.Exists(filePath)) return NotFound("Không tìm thấy file vật lý.");
                
                var fileBytes = System.IO.File.ReadAllBytes(filePath);
                var fileName = Path.GetFileName(filePath);
                var ext = Path.GetExtension(filePath).ToLower();
                var mimeType = ext switch
                {
                    ".jpg" or ".jpeg" => "image/jpeg",
                    ".png" => "image/png",
                    ".pdf" => "application/pdf",
                    ".doc" => "application/msword",
                    ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    _ => "application/octet-stream"
                };
                return File(fileBytes, mimeType, fileName);
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message, stack = ex.StackTrace }); }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var doc = await _documentRepository.GetDocumentByIdAsync(id);
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
            await _documentRepository.DeleteAsync(id);
            return NoContent();
        }

        // =============================================
        // COMMENTS API
        // =============================================

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("{id}/comments")]
        public async Task<IActionResult> GetComments(int id)
        {
            var comments = await _documentRepository.GetCommentsAsync(id);
            // Attach reactions for each comment
            var result = new List<object>();
            foreach (var c in comments)
            {
                var rx = await _documentRepository.GetReactionsForCommentAsync(c.Id);
                result.Add(new
                {
                    c.Id,
                    c.DocumentId,
                    c.UserId,
                    c.Username,
                    c.Content,
                    c.AttachmentPaths,
                    c.CreatedAt,
                    Reactions = rx.GroupBy(r => r.ReactionType).ToDictionary(g => g.Key, g => new
                    {
                        Count = g.Count(),
                        Users = g.Select(r => r.Username).ToList()
                    })
                });
            }
            return Ok(result);
        }

        [AllowAnonymous]
        [HttpGet("comment-attachment")]
        public IActionResult GetCommentAttachment([FromQuery] string path)
        {
            if (string.IsNullOrEmpty(path)) return BadRequest("Đường dẫn không hợp lệ.");
            
            // Chuẩn hóa và bảo mật đường dẫn (chỉ cho phép trong thư mục Uploads/Comments)
            var normalizedPath = path.Replace('\\', '/').TrimStart('/');
            if (!normalizedPath.Contains("Uploads/Comments", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Truy cập trái phép.");

            var filePath = Path.Combine(_env.ContentRootPath, normalizedPath);
            if (!System.IO.File.Exists(filePath)) return NotFound("File đính kèm không tồn tại.");

            var fileBytes = System.IO.File.ReadAllBytes(filePath);
            var ext = Path.GetExtension(filePath).ToLower();
            var mimeType = ext switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".pdf" => "application/pdf",
                _ => "application/octet-stream"
            };
            return File(fileBytes, mimeType, Path.GetFileName(filePath));
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpPost("{id}/comments")]
        public async Task<IActionResult> AddComment(int id, [FromForm] string content, [FromForm] List<IFormFile> files)
        {
            if (string.IsNullOrWhiteSpace(content) && (files == null || files.Count == 0))
                return BadRequest("Bình luận phải có nội dung hoặc tệp đính kèm.");

            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
            var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Unknown";

            var savedPaths = new List<string>();
            if (files != null && files.Count > 0)
            {
                var commentUploadDir = Path.Combine(_env.ContentRootPath, "Uploads", "Comments", $"Doc_{id}");
                Directory.CreateDirectory(commentUploadDir);

                foreach (var file in files)
                {
                    var fileName = $"{DateTime.Now:yyyyMMddHHmmss}_{file.FileName}";
                    var filePath = Path.Combine(commentUploadDir, fileName);

                    // THỐNG NHẤT: Lưu đường dẫn không có dấu gạch chéo ở đầu
                    var relativePath = $"Uploads/Comments/Doc_{id}/{fileName}";

                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await file.CopyToAsync(stream);
                    }
                    savedPaths.Add(relativePath);
                }
            }

            var comment = new Comment
            {
                DocumentId = id,
                UserId = userId,
                Username = username,
                Content = content ?? "",
                AttachmentPaths = System.Text.Json.JsonSerializer.Serialize(savedPaths)
            };
            await _documentRepository.InsertCommentAsync(comment);

            // Realtime broadcast SignalR cho các client đang mở văn bản
            _ = _hubContext.Clients.All.SendAsync("ReceiveComment", new { documentId = id });

            // Gửi thông báo Notification cho người liên quan
            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc != null)
            {
                if (doc.AssignedTo.HasValue && doc.AssignedTo != userId)
                {
                    await _notificationManager.SendToUserAsync(doc.AssignedTo.Value, "Thảo luận mới", $"{username} vừa bình luận trong văn bản {doc.SoVanBan}", new { docId = id });
                }
            }

            return Ok(new { message = "Đã thêm comment thành công.", attachments = savedPaths });
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpDelete("{docId}/comments/{commentId}")]
        public async Task<IActionResult> DeleteComment(int docId, int commentId)
        {
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";
            bool isAdmin = role == "Admin";

            await _documentRepository.DeleteCommentAsync(commentId, userId, isAdmin);

            // Realtime broadcast SignalR
            _ = _hubContext.Clients.All.SendAsync("DeleteComment", new { documentId = docId, commentId = commentId });

            return Ok(new { message = "Đã xóa comment." });
        }

        // =============================================
        // REACTIONS API
        // =============================================

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpPost("{docId}/comments/{commentId}/react")]
        public async Task<IActionResult> ReactToComment(int docId, int commentId, [FromBody] ReactionRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.ReactionType))
                return BadRequest("Loại reaction không hợp lệ.");

            var validTypes = new[] { "like", "love", "hate", "dislike" };
            if (!validTypes.Contains(req.ReactionType.ToLower()))
                return BadRequest("Reaction type phải là: like, love, hate, dislike.");

            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
            var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Unknown";

            var result = await _documentRepository.ToggleReactionAsync(commentId, userId, username, req.ReactionType.ToLower());

            var rxList = await _documentRepository.GetReactionsForCommentAsync(commentId); var updatedReactions = rxList.GroupBy(r => r.ReactionType)
                .ToDictionary(g => g.Key, g => new
                {
                    Count = g.Count(),
                    Users = g.Select(r => r.Username).ToList()
                });

            // Realtime broadcast SignalR
            _ = _hubContext.Clients.All.SendAsync("ReceiveReaction", new
            {
                documentId = docId,
                commentId = commentId,
                reactions = updatedReactions
            });
            return Ok(new { status = result, reactions = updatedReactions });
        }

        [AllowAnonymous]
        [HttpGet("public-schedule")]
        public async Task<IActionResult> GetPublicSchedule()
        {
            var allDocs = await _documentRepository.GetAllAsync();
            var now = DateTime.Now.Date;

            // Lấy văn bản từ hôm nay trở đi
            var filtered = allDocs
                .Where(d => d.ThoiHan.HasValue && d.ThoiHan.Value.Date >= now)
                .OrderBy(d => d.ThoiHan)
                .Take(50) // Giới hạn 50 mục gần nhất
                .ToList();

            // Nhóm theo ngày
            var groups = filtered.GroupBy(d => d.ThoiHan.Value.Date)
                .Select(g => new
                {
                    date = g.Key.ToString("dd/MM/yyyy"),
                    dayLabel = GetDayLabel(g.Key),
                    items = g.Select(d => new
                    {
                        id = d.Id,
                        time = "08:00", 
                        docNumber = d.SoVanBan,
                        content = d.TrichYeu
                    }).ToList()
                })
                .OrderBy(x => DateTime.ParseExact(x.date, "dd/MM/yyyy", null))
                .ToList();

            return Ok(groups);
        }

        private string GetDayLabel(DateTime date)
        {
            var days = new[] { "Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy" };
            if (date.Date == DateTime.Now.Date) return "Hôm nay (" + days[(int)date.DayOfWeek] + ")";
            return days[(int)date.DayOfWeek];
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


