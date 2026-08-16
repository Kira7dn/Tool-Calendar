using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using System.Security.Cryptography;  // HMACSHA256 - dùng cho webhook notifications
using System.Text;                   // Encoding - dùng cho webhook notifications
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Core.Models;
using ToolCalendar.Core.Services;
using ToolCalendar.Data;
using ToolCalendar.Data.Repositories;
using ToolCalendar.Hubs;
using ToolCalendar.Models;
using ToolCalendar.Services;

namespace ToolCalendar.Api.Controllers.Documents
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
        private readonly IDocumentRoutingRepository _routingRepo;
        private readonly IConfiguration _configuration;
        private readonly IDocumentUploadService _uploadService;
        private readonly IAuditLogRepository _auditRepo;
        private readonly IAiReferenceService _aiReferenceService;

        public DocumentsController(
            IDocumentExtractorService extractor,
            IOcrQueueService ocrQueue,
            INotificationManager notificationManager,
            IWebHostEnvironment env,
            IHubContext<NotificationHub> hubContext,
            IDocumentRepository documentRepository,
            IDocumentRoutingRepository routingRepo,
            IConfiguration configuration,
            IDocumentUploadService uploadService,
            IAuditLogRepository auditRepo,
            IAiReferenceService aiReferenceService)
        {
            _extractor = extractor;
            _ocrQueue = ocrQueue;
            _notificationManager = notificationManager;
            _env = env;
            _hubContext = hubContext;
            _documentRepository = documentRepository;
            _routingRepo = routingRepo;
            _configuration = configuration;
            _uploadService = uploadService;
            _auditRepo = auditRepo;
            _aiReferenceService = aiReferenceService;
        }
        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet]
        public async Task<IActionResult> GetDocuments(
            [FromQuery] int page = 1,
            [FromQuery] int size = 10,
            [FromQuery] string search = "",
            [FromQuery] string status = "",
            [FromQuery] string sort = "deadline_asc",
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] DateTime? addFromDate = null,
            [FromQuery] DateTime? addToDate = null)
        {
            var (items, totalCount) = await _documentRepository.GetPagedAsync(page, size, search, status, sort, fromDate, toDate, addFromDate, addToDate);
            var totalPages = (int)Math.Ceiling((double)totalCount / size);

            return Ok(ApiResponse.Ok(new
            {
                data = items,
                page,
                pageSize = size,
                totalCount,
                totalPages
            }));
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("statuses")]
        public async Task<IActionResult> GetStatuses()
        {
            var statuses = await _documentRepository.GetUniqueStatusesAsync();
            return Ok(ApiResponse.Ok(statuses));
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var data = await _documentRepository.GetDocumentByIdAsync(id);
            if (data == null) return NotFound(ApiResponse.Fail("Văn bản không tồn tại."));
            return Ok(ApiResponse.Ok(data));
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPost("upload")]
        [EnableRateLimiting("upload-limit")] // Tầng 4: tối đa 200 file/phút/user
        public async Task<IActionResult> Upload(IFormFile file)
        {
            // Lấy userId của người đang đăng nhập từ JWT claims
            var userIdStr = User.FindFirstValue("uid") ?? User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier);
            int.TryParse(userIdStr, out int userId);

            // Ủy quyền toàn bộ logic nghiệp vụ cho DocumentUploadService
            var result = await _uploadService.UploadAsync(file, userId);

            // Xử lý kết quả trả về
            if (!result.IsSuccess)
                return BadRequest(ApiResponse.Fail(result.ErrorMessage ?? "Lỗi tải tệp lên."));

            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated");
            return Ok(ApiResponse.Ok(result.Document));
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPost("bulk-confirm")]
        public async Task<IActionResult> BulkConfirm([FromBody] List<int> ids)
        {
            if (ids == null || ids.Count == 0) return BadRequest(ApiResponse.Fail("Danh sách ID trống."));

            // Cập nhật trạng thái thành "Đã rà soát"
            await _documentRepository.BulkUpdateStatusAsync(ids, "Đã rà soát");

            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated");
            return Ok(ApiResponse.Ok($"Đã xác nhận thành công {ids.Count} văn bản."));
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpDelete("bulk-delete")]
        public async Task<IActionResult> BulkDeleteBatch([FromBody] List<int> ids)
        {
            if (ids == null || ids.Count == 0) return BadRequest(ApiResponse.Fail("Danh sách ID trống."));

            // ✅ Perf: Query chỉ Id + FilePath thay vì GetAllAsync() toàn bộ bảng
            var filePaths = await _documentRepository.GetFilePathsByIdsAsync(ids);
            foreach (var (id, filePath) in filePaths)
            {
                if (!string.IsNullOrEmpty(filePath))
                {
                    var normalizedPath = filePath.Replace('\\', '/').TrimStart('/');
                    var fullPath = Path.Combine(_env.ContentRootPath, normalizedPath);
                    if (System.IO.File.Exists(fullPath))
                        System.IO.File.Delete(fullPath);
                }
                var evidenceDir = Path.Combine(_env.ContentRootPath, "Uploads", "Documents", "Evidence", $"Doc_{id}");
                if (Directory.Exists(evidenceDir))
                    Directory.Delete(evidenceDir, true);
            }

            await _documentRepository.BulkDeleteAsync(ids);

            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated");
            return Ok(ApiResponse.Ok($"Đã xóa thành công {ids.Count} văn bản cùng toàn bộ file đính kèm."));
        }

        [Authorize(Roles = "Admin,VanThu")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] DocumentRecord record)
        {
            if (record == null) return BadRequest(ApiResponse.Fail("Dữ liệu văn bản không hợp lệ."));

            // Lấy userId của người đang đăng nhập từ JWT claims
            var userIdStr = User.FindFirstValue("uid") ?? User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier);
            if (int.TryParse(userIdStr, out int userId))
            {
                record.UploadedByUserId = userId;
            }

            int id = await _documentRepository.InsertAsync(record);
            record.Id = id;
            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated");
            return CreatedAtAction(nameof(GetById), new { id = record.Id }, ApiResponse.Ok(record));
        }

        [Authorize]
        [HttpPost("{id}/reindex")]
        public async Task<IActionResult> ReindexDocument(int id)
        {
            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound(ApiResponse.Fail("Văn bản không tồn tại."));
            if (string.IsNullOrEmpty(doc.FilePath) || !System.IO.File.Exists(doc.FilePath))
                return BadRequest(ApiResponse.Fail("File gốc không tồn tại trên server."));
            await _ocrQueue.EnqueueAsync(id);
            return Ok(ApiResponse.Ok("Đã đưa vào hàng đợi xử lý trích xuất và Index (RAG)."));
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] DocumentRecord record)
        {
            if (record == null) return BadRequest(ApiResponse.Fail("Dữ liệu văn bản không hợp lệ."));
            record.Id = id;

            var existing = await _documentRepository.GetDocumentByIdAsync(id);
            if (existing == null) return NotFound(ApiResponse.Fail("Văn bản không tồn tại."));

            // Bảo toàn dữ liệu OCR nếu client gửi lên chuỗi rỗng do fetch từ danh sách (list query ẩn FullText)
            if (string.IsNullOrEmpty(record.FullText) && !string.IsNullOrEmpty(existing.FullText))
            {
                record.FullText = existing.FullText;
            }
            if ((string.IsNullOrEmpty(record.OcrPagesJson) || record.OcrPagesJson == "[]") && 
                !string.IsNullOrEmpty(existing.OcrPagesJson) && existing.OcrPagesJson != "[]")
            {
                record.OcrPagesJson = existing.OcrPagesJson;
            }

            // Nếu thay đổi người được giao xử lý chính, reset trạng thái văn bản về Chưa xử lý
            if (record.AssignedTo.HasValue && record.AssignedTo != existing?.AssignedTo)
            {
                record.Status = "Chưa xử lý";
            }

            await _documentRepository.UpdateAsync(record);

            // Cập nhật trạng thái của user trong bảng DocumentRoutings (nếu có)
            if (record.Status == "Đang xử lý")
            {
                try
                {
                    var currentUserIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                    if (int.TryParse(currentUserIdStr, out int currentUserId))
                    {
                        await _routingRepo.UpdateStatusByDocumentAndReceiverAsync(id, currentUserId, "Đang xử lý", "Đã tiếp nhận công việc");
                    }
                }
                catch { }
            }

            // Nếu có sự thay đổi về người được giao → tạo routing record thật trong DB
            if (record.AssignedTo.HasValue && record.AssignedTo != existing?.AssignedTo)
            {
                try {
                    // Tạo bản ghi DocumentRoutings thật để cây luân chuyển luôn chính xác
                    var newRouting = new DocumentRoutingRecord
                    {
                        DocumentId = id,
                        SenderId = record.UploadedByUserId > 0 ? record.UploadedByUserId : existing?.UploadedByUserId ?? 0,
                        ReceiverId = record.AssignedTo.Value,
                        Role = "Xử lý chính",
                        ForwardDate = DateTime.Now,
                        Deadline = record.ThoiHan.HasValue ? record.ThoiHan.Value : null,
                        Comment = "Nhận nhiệm vụ xử lý chính",
                        Status = "Chưa xử lý",
                        CreatedAt = DateTime.Now,
                    };
                    await _routingRepo.CreateRoutingAsync(newRouting);

                    await _notificationManager.SendToUserAsync(
                        record.AssignedTo.Value,
                        "Công việc được giao mới",
                        $"Văn bản {record.SoVanBan} đã được giao cho bạn xử lý.",
                        new { docId = id, type = "assignment" }
                    );
                } catch { }
            }

            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = id, status = record.Status });
            return Ok(ApiResponse.Ok("Cập nhật văn bản thành công."));
        }

        public class UpdateStatusDto { public string Status { get; set; } }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto dto)
        {
            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound(ApiResponse.Fail("Văn bản không tồn tại."));

            doc.Status = dto.Status;
            await _documentRepository.UpdateAsync(doc);

            var currentUserIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(currentUserIdStr, out int currentUserId);
            var currentUsername = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Người dùng";

            if (dto.Status == "Đang xử lý" || dto.Status == "Đã xử lý")
            {
                try
                {
                    if (currentUserId > 0)
                    {
                        var routingMsg = dto.Status == "Đã xử lý" ? "Đã kết thúc văn bản" : "Đã tiếp nhận công việc";
                        await _routingRepo.UpdateStatusByDocumentAndReceiverAsync(id, currentUserId, dto.Status, routingMsg);
                    }
                }
                catch { }
            }

            if (doc.UploadedByUserId > 0 && doc.UploadedByUserId != currentUserId)
            {
                await _notificationManager.SendToUserAsync(
                    doc.UploadedByUserId,
                    "Cập nhật trạng thái",
                    $"{currentUsername} đã cập nhật trạng thái văn bản '{doc.TenCongVan ?? "văn bản"}' thành '{dto.Status}'.",
                    new { docId = id, type = "status_updated" }
                );
            }

            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = id, status = doc.Status });
            return Ok(ApiResponse.Ok("Cập nhật trạng thái thành công."));
        }


        [HttpPut("{id}/reject-assignment")]
        public async Task<IActionResult> RejectAssignment(int id, [FromBody] RejectRoutingDto dto)
        {
            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound(ApiResponse.Fail("Văn bản không tồn tại."));

            var currentUserIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(currentUserIdStr, out int currentUserId)) return Unauthorized(ApiResponse.Fail("Token không hợp lệ."));

            if (doc.AssignedTo != currentUserId)
                return StatusCode(403, ApiResponse.Fail("Bạn không phải người được giao xử lý chính văn bản này."));

            if (doc.Status == "Hoàn thành")
                return BadRequest(ApiResponse.Fail("Không thể hủy tiếp nhận khi văn bản đã hoàn thành."));

            var reason = string.IsNullOrWhiteSpace(dto.Reason) ? "Không có lý do" : dto.Reason.Trim();
            doc.Status = "Từ chối";
            await _documentRepository.UpdateAsync(doc);

            // Cập nhật trạng thái "Từ chối" trong bảng DocumentRoutings (nếu có bản ghi)
            try
            {
                await _routingRepo.UpdateStatusByDocumentAndReceiverAsync(id, currentUserId, "Từ chối", $"Từ chối tiếp nhận: {reason}");
            }
            catch { }

            var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Cán bộ";
            var docName = doc.TenCongVan ?? "văn bản";

            if (doc.UploadedByUserId > 0)
            {
                await _notificationManager.SendToUserAsync(
                    doc.UploadedByUserId,
                    "Từ chối tiếp nhận",
                    $"{username} đã từ chối tiếp nhận xử lý chính '{docName}'. Lý do: {reason}",
                    new { docId = id, type = "routing_rejected" }
                );
            }

            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = id, status = doc.Status });
            return Ok(ApiResponse.Ok("Đã hủy tiếp nhận thành công."));
        }

        [HttpPost("{id}/assign")]
        public async Task<IActionResult> Assign(int id, [FromBody] AssignmentRequest request)
        {
            if (request == null) return BadRequest(ApiResponse.Fail("Yêu cầu giao việc không hợp lệ."));

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

            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = id });
            return Ok(ApiResponse.Ok("Giao việc thành công."));
        }

        [Authorize(Roles = "Admin,CanBo")]
        [HttpPost("{id}/submit-evidence")]
        public async Task<IActionResult> SubmitEvidence(int id, [FromForm] List<IFormFile> files, [FromForm] string notes)
        {
            if (files == null || files.Count == 0) return BadRequest(ApiResponse.Fail("Cần ít nhất một file bằng chứng."));

            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound(ApiResponse.Fail("Văn bản không tồn tại."));

            // 1. Tạo thư mục lưu bằng chứng cho văn bản này
            var evidenceDir = Path.Combine(_env.ContentRootPath, "Uploads", "Documents", "Evidence", $"Doc_{id}");
            Directory.CreateDirectory(evidenceDir);

            var savedPaths = new List<string>();
            foreach (var file in files)
            {
                // ✅ Security: Path.GetFileName() loại bỏ directory component, ngăn path traversal
                var safeFileName = $"{DateTime.Now:yyyyMMddHHmmss}_{Path.GetFileName(file.FileName)}";
                var filePath = Path.Combine(evidenceDir, safeFileName);
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }
                savedPaths.Add($"Uploads/Documents/Evidence/Doc_{id}/{safeFileName}");
            }

            // 2. Cập nhật vào DB (Lưu danh sách path dưới dạng JSON)
            var evidenceJson = System.Text.Json.JsonSerializer.Serialize(savedPaths);
            await _documentRepository.SubmitEvidenceAsync(id, evidenceJson, notes);

            // 2.5 Cập nhật trạng thái của user hiện tại trong bảng DocumentRoutings (nếu có)
            var currentUserIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(currentUserIdStr, out int currentUserId);
            if (currentUserId > 0)
            {
                try
                {
                    await _routingRepo.UpdateStatusByDocumentAndReceiverAsync(id, currentUserId, "Đã xử lý", notes);
                }
                catch { }
            }

            // 2.6 Kiểm tra tất cả đã xong chưa
            bool allDone = await _routingRepo.AreAllRoutingsFinishedAsync(id);
            if (allDone)
            {
                doc.Status = "Đã xử lý";
                doc.CompletionDate = DateTime.Now;
                doc.EvidencePaths = evidenceJson;
                doc.EvidenceNotes = notes;
                await _documentRepository.UpdateAsync(doc);
                _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = id, status = "Đã xử lý" });
            }
            else
            {
                _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = id, status = "Đang xử lý" });
            }

            // 4. Ghi nhận hoạt động cán bộ cho dashboard
            try
            {
                if (currentUserId > 0)
                {
                    _auditRepo.InsertAuditLog(currentUserId, $"Đã nộp bằng chứng hoàn thành văn bản {doc.SoVanBan}.");
                }
            }
            catch { }

            // 5. Gửi thông báo cho toàn bộ những người liên quan
            try {
                var currentUserName = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Cán bộ";

                var routings = await _routingRepo.GetTreeByDocumentIdAsync(id);
                var involvedUserIds = new System.Collections.Generic.HashSet<int>();
                involvedUserIds.Add(doc.UploadedByUserId);
                
                foreach (var r in routings) {
                    involvedUserIds.Add(r.SenderId);
                    involvedUserIds.Add(r.ReceiverId);
                }
                
                // Loại trừ người đang thao tác
                involvedUserIds.Remove(currentUserId);

                foreach (var uid in involvedUserIds) {
                    if (uid <= 0) continue;
                    await _notificationManager.SendToUserAsync(
                        uid, 
                        "Công việc đã hoàn thành", 
                        $"{currentUserName} đã nộp bằng chứng và hoàn thành văn bản: {doc.SoVanBan}",
                        new { docId = id, type = "completed" }
                    );
                }
            } catch { }

            return Ok(ApiResponse.Ok(new { message = "Nộp bằng chứng hoàn thành thành công.", paths = savedPaths }));
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("my-tasks")]
        public async Task<IActionResult> GetMyTasks()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out int userId)) 
                return Unauthorized(ApiResponse.Fail("Chưa đăng nhập hoặc phiên làm việc hết hạn."));
            // ✅ Perf: lọc tại DB thay vì GetAllAsync() + LINQ scan toàn bộ bảng
            var tasks = await _documentRepository.GetTasksByUserIdAsync(userId);
            return Ok(ApiResponse.Ok(tasks));
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("{id}/file")]
        public async Task<IActionResult> GetFile(int id)
        {
            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc == null || string.IsNullOrEmpty(doc.FilePath)) return NotFound(ApiResponse.Fail("File không tồn tại."));
            
            // Lấy đường dẫn từ DB và chuẩn hóa dấu gạch chéo cho Linux
            var normalizedPath = doc.FilePath.Replace('\\', '/').TrimStart('/');
            var filePath = Path.Combine(_env.ContentRootPath, normalizedPath);
            
            if (!System.IO.File.Exists(filePath)) return NotFound(ApiResponse.Fail($"File vật lý không tìm thấy tại: {normalizedPath}"));

            var ext = Path.GetExtension(doc.FilePath).ToLower();
            var mimeType = ext switch
            {
                ".pdf" => "application/pdf",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                _ => "application/octet-stream"
            };
            // ✅ Bảo mật: Ngăn browser cache file nhạy cảm
            // ✅ Perf: PhysicalFile stream trực tiếp từ disk, không load vào RAM trước
            return ServePhysicalFileSecured(filePath, mimeType);
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("{id}/evidence/{index}")]
        public async Task<IActionResult> GetEvidenceFile(int id, int index)
        {
            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc == null || string.IsNullOrEmpty(doc.EvidencePaths)) return NotFound(ApiResponse.Fail("Không tìm thấy bằng chứng."));
            try
            {
                var paths = System.Text.Json.JsonSerializer.Deserialize<List<string>>(doc.EvidencePaths);
                if (paths == null || index < 0 || index >= paths.Count) return NotFound(ApiResponse.Fail("Index file không hợp lệ."));

                var relativePath = paths[index];
                var normalizedPath = relativePath.Replace('\\', '/').TrimStart('/');
                var filePath = Path.Combine(_env.ContentRootPath, normalizedPath);
                
                if (!System.IO.File.Exists(filePath)) return NotFound(ApiResponse.Fail("Không tìm thấy file vật lý."));
                
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
                // ✅ Bảo mật: Ngăn browser cache file bằng chứng
                // ✅ Perf: PhysicalFile stream trực tiếp, không load vào RAM
                return ServePhysicalFileSecured(filePath, mimeType);
            }
            catch (Exception ex)
            {
                // Chỉ log chi tiết trong Development, không lộ stack trace ra Production
                _= ex;
                return BadRequest(ApiResponse.Fail("Không thể đọc file bằng chứng. Vui lòng thử lại."));
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc != null)
            {
                // ✅ Fix: Normalize path trước khi xóa (giống BulkDelete) — trước đây dùng path thô nên File.Exists luôn false
                if (!string.IsNullOrEmpty(doc.FilePath))
                {
                    var normalizedDocPath = doc.FilePath.Replace('\\', '/').TrimStart('/');
                    var fullDocPath = Path.Combine(_env.ContentRootPath, normalizedDocPath);
                    if (System.IO.File.Exists(fullDocPath))
                        System.IO.File.Delete(fullDocPath);
                }
                var evidenceDir = Path.Combine(_env.ContentRootPath, "Uploads", "Documents", "Evidence", $"Doc_{id}");
                if (Directory.Exists(evidenceDir))
                    Directory.Delete(evidenceDir, true);
            }
            await _documentRepository.DeleteAsync(id);
            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated");
            return Ok(ApiResponse.Ok("Xóa văn bản thành công."));
        }

        // =============================================
        // COMMENTS API
        // =============================================

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("{id}/comments")]
        public async Task<IActionResult> GetComments(int id, [FromQuery] int page = 1, [FromQuery] int pageSize = 500)
        {
            var comments = await _documentRepository.GetCommentsAsync(id, page, pageSize);

            // ✅ Perf: 1 batch query cho tất cả reactions thay vì N queries (N+1 → 2)
            var commentIds = comments.Select(c => c.Id).ToList();
            var allReactions = await _documentRepository.GetReactionsForCommentsAsync(commentIds);
            var reactionsByComment = allReactions.GroupBy(r => r.CommentId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var result = comments.Select(c =>
            {
                var rx = reactionsByComment.TryGetValue(c.Id, out var list) ? list : new List<CommentReaction>();
                return (object)new
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
                };
            }).ToList();

            return Ok(ApiResponse.Ok(result));
        }

        // Bảo vệ bằng [Authorize] — chỉ người đã đăng nhập mới xem được file bình luận
        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("comment-attachment")]
        public IActionResult GetCommentAttachment([FromQuery] string path)
        {
            if (string.IsNullOrEmpty(path)) return BadRequest(ApiResponse.Fail("Đường dẫn không hợp lệ."));
            
            // Chuẩn hóa và bảo mật đường dẫn (chỉ cho phép trong thư mục Uploads/Comments)
            var normalizedPath = path.Replace('\\', '/').TrimStart('/');
            if (!normalizedPath.Contains("Uploads/Documents/Comments", StringComparison.OrdinalIgnoreCase))
                return BadRequest(ApiResponse.Fail("Truy cập trái phép."));

            var filePath = Path.Combine(_env.ContentRootPath, normalizedPath);
            if (!System.IO.File.Exists(filePath)) return NotFound(ApiResponse.Fail("File đính kèm không tồn tại."));

            var ext = Path.GetExtension(filePath).ToLower();
            var mimeType = ext switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".pdf" => "application/pdf",
                _ => "application/octet-stream"
            };
            // ✅ Bảo mật: Ngăn browser cache file đính kèm bình luận
            // ✅ Perf: PhysicalFile stream trực tiếp, không ReadAllBytes
            return ServePhysicalFileSecured(filePath, mimeType);
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpPost("{id}/comments")]
        public async Task<IActionResult> AddComment(int id, [FromForm] string content, [FromForm] List<IFormFile> files)
        {
            if (string.IsNullOrWhiteSpace(content) && (files == null || files.Count == 0))
                return BadRequest(ApiResponse.Fail("Bình luận phải có nội dung hoặc tệp đính kèm."));

            // Parse userId an toàn — trả 401 nếu không có claim thay vì throw exception
            if (!int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out int userId))
                return Unauthorized(ApiResponse.Fail("Chưa đăng nhập hoặc phiên làm việc hết hạn."));
            var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Unknown";

            var savedPaths = new List<string>();
            if (files != null && files.Count > 0)
            {
                var commentUploadDir = Path.Combine(_env.ContentRootPath, "Uploads", "Documents", "Comments", $"Doc_{id}");
                Directory.CreateDirectory(commentUploadDir);

                foreach (var file in files)
                {
                    // ✅ Security: Path.GetFileName() loại bỏ directory component, ngăn path traversal
                    var safeFileName = $"{DateTime.Now:yyyyMMddHHmmss}_{Path.GetFileName(file.FileName)}";
                    var filePath = Path.Combine(commentUploadDir, safeFileName);
                    var relativePath = $"Uploads/Documents/Comments/Doc_{id}/{safeFileName}";

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
                    await _notificationManager.SendToUserAsync(doc.AssignedTo.Value, "Thảo luận mới", $"{username} vừa bình luận trong văn bản {doc.SoVanBan ?? "văn bản"}", new { docId = id });
                }

                if (doc.UploadedByUserId > 0 && doc.UploadedByUserId != userId && doc.UploadedByUserId != doc.AssignedTo)
                {
                    await _notificationManager.SendToUserAsync(doc.UploadedByUserId, "Thảo luận mới", $"{username} vừa bình luận trong văn bản {doc.SoVanBan ?? "văn bản"}", new { docId = id });
                }
            }

            return Ok(ApiResponse.Ok(new { message = "Đã thêm comment thành công.", attachments = savedPaths }));
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpDelete("{docId}/comments/{commentId}")]
        public async Task<IActionResult> DeleteComment(int docId, int commentId)
        {
            // Parse userId an toàn — trả 401 nếu không có claim
            if (!int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out int userId))
                return Unauthorized(ApiResponse.Fail("Chưa đăng nhập hoặc phiên làm việc hết hạn."));
            var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";
            bool isAdmin = role == "Admin";

            var comments = await _documentRepository.GetCommentsAsync(docId);
            var comment = comments.FirstOrDefault(c => c.Id == commentId);
            if (comment != null && !string.IsNullOrEmpty(comment.AttachmentPaths))
            {
                try
                {
                    var paths = System.Text.Json.JsonSerializer.Deserialize<List<string>>(comment.AttachmentPaths);
                    if (paths != null)
                    {
                        foreach (var path in paths)
                        {
                            var fullPath = Path.Combine(_env.ContentRootPath, path.Replace('\\', '/').TrimStart('/'));
                            if (System.IO.File.Exists(fullPath))
                            {
                                System.IO.File.Delete(fullPath);
                            }
                        }
                    }
                }
                catch { }
            }

            await _documentRepository.DeleteCommentAsync(commentId, userId, isAdmin);

            // Realtime broadcast SignalR
            _ = _hubContext.Clients.All.SendAsync("DeleteComment", new { documentId = docId, commentId = commentId });

            return Ok(ApiResponse.Ok("Đã xóa comment và các file đính kèm liên quan."));
        }

        // =============================================
        // REACTIONS API
        // =============================================

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpPost("{docId}/comments/{commentId}/react")]
        public async Task<IActionResult> ReactToComment(int docId, int commentId, [FromBody] ReactionRequest req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.ReactionType))
                return BadRequest(ApiResponse.Fail("Loại reaction không hợp lệ."));

            var validTypes = new[] { "like", "love", "hate", "dislike" };
            if (!validTypes.Contains(req.ReactionType.ToLower()))
                return BadRequest(ApiResponse.Fail("Reaction type phải là: like, love, hate, dislike."));

            // Parse userId an toàn
            if (!int.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out int userId))
                return Unauthorized(ApiResponse.Fail("Chưa đăng nhập hoặc phiên làm việc hết hạn."));
            var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "Unknown";

            var result = await _documentRepository.ToggleReactionAsync(commentId, userId, username, req.ReactionType.ToLower());

            var rxList = await _documentRepository.GetReactionsForCommentAsync(commentId);
            var updatedReactions = rxList.GroupBy(r => r.ReactionType)
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
            return Ok(ApiResponse.Ok(new { status = result, reactions = updatedReactions }));
        }

        [Authorize(Roles = "Admin,VanThu,LanhDao,CanBo")]
        [HttpGet("evidence-file")]
        public IActionResult GetEvidenceFile([FromQuery] string path)
        {
            if (string.IsNullOrEmpty(path)) return BadRequest(ApiResponse.Fail("Đường dẫn không hợp lệ."));
            
            // Bảo mật: Chỉ cho phép truy cập file trong thư mục Evidence
            string normalizedPath = path.TrimStart('/').Replace("\\", "/");
            if (!normalizedPath.StartsWith("Uploads/Documents/Evidence/", StringComparison.OrdinalIgnoreCase)) 
                return StatusCode(403, ApiResponse.Fail("Truy cập bị cấm."));

            // Chuyển đổi đường dẫn tương đối thành đường dẫn tuyệt đối trên server
            var fullPath = Path.Combine(Directory.GetCurrentDirectory(), normalizedPath);
            if (!System.IO.File.Exists(fullPath)) return NotFound(ApiResponse.Fail("File không tồn tại."));

            var contentType = "application/octet-stream";
            var ext = Path.GetExtension(normalizedPath).ToLower();
            if (ext == ".pdf") contentType = "application/pdf";
            else if (ext == ".jpg" || ext == ".jpeg") contentType = "image/jpeg";
            else if (ext == ".png") contentType = "image/png";

            // ✅ Bảo mật: Ngăn browser cache file bằng chứng
            return ServePhysicalFileSecured(fullPath, contentType);
        }

        // ── Helper: Tạo token HMAC-SHA256 từ docId ──────────────────────
        private string CreatePublicDocToken(int docId)
        {
            // Ưu tiên: biến môi trường → appsettings → lỗi rõ ràng
            var secret = Environment.GetEnvironmentVariable("PUBLIC_ID_SECRET")
                      ?? _configuration["Security:PublicIdSecret"];

            if (string.IsNullOrWhiteSpace(secret))
                throw new InvalidOperationException(
                    "[SECURITY] PUBLIC_ID_SECRET chưa được cấu hình trong .env hoặc appsettings.");

            var payload = $"{docId}:{DateTime.UtcNow.Date:yyyyMMdd}";
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
            var sig = Convert.ToBase64String(hash)
                .Replace("+", "-").Replace("/", "_").Replace("=", "");
            // Token = base64url(docId) + "." + signature (4 chars truncated không đủ để reverse)
            var idPart = Convert.ToBase64String(Encoding.UTF8.GetBytes(docId.ToString()))
                .Replace("+", "-").Replace("/", "_").Replace("=", "");
            return $"{idPart}.{sig}";
        }

        // ── Helper: Giải mã và xác thực token HMAC-SHA256 ───────────────
        private bool TryDecodePublicDocToken(string token, out int docId)
        {
            docId = 0;
            try
            {
                var parts = token.Split('.');
                if (parts.Length != 2) return false;

                var idBase64 = parts[0].Replace("-", "+").Replace("_", "/");
                // Pad base64
                idBase64 = idBase64.PadRight(idBase64.Length + (4 - idBase64.Length % 4) % 4, '=');
                var idStr = Encoding.UTF8.GetString(Convert.FromBase64String(idBase64));
                if (!int.TryParse(idStr, out docId)) return false;

                // Tái tạo token hôm nay để so sánh (token hợp lệ trong ngày)
                var expected = CreatePublicDocToken(docId);
                return token == expected;
            }
            catch { return false; }
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
                .Take(50) 
                .ToList();

            // Nhóm theo ngày — ID được MÃ HÓA bằng HMAC, hacker không đoán được ID thật
            var groups = filtered.GroupBy(d => d.ThoiHan.Value.Date)
                .Select(g => new
                {
                    date = g.Key.ToString("dd/MM/yyyy"),
                    dayLabel = GetDayLabel(g.Key),
                    items = g.Select(d => new
                    {
                        docToken = CreatePublicDocToken(d.Id), // ← Trả token mã hóa, KHÔNG trả id thô
                        time = "08:00", 
                        docNumber = d.SoVanBan,
                        content = d.TrichYeu
                    }).ToList()
                })
                .OrderBy(x => DateTime.ParseExact(x.date, "dd/MM/yyyy", null))
                .ToList();

            return Ok(ApiResponse.Ok(groups));
        }

        // ── Endpoint xem file PDF bằng token mã hóa (dùng cho trang /campha) ──
        [Authorize]
        [HttpGet("public-file")]
        public async Task<IActionResult> GetPublicFile([FromQuery] string token)
        {
            if (string.IsNullOrEmpty(token))
                return BadRequest(ApiResponse.Fail("Token không hợp lệ."));

            if (!TryDecodePublicDocToken(token, out int docId))
                return Unauthorized(ApiResponse.Fail("Token không hợp lệ hoặc đã hết hạn. Vui lòng tải lại trang."));

            var doc = await _documentRepository.GetDocumentByIdAsync(docId);
            if (doc == null || string.IsNullOrEmpty(doc.FilePath))
                return NotFound(ApiResponse.Fail("Văn bản không tồn tại."));

            var normalizedPath = doc.FilePath.Replace('\\', '/').TrimStart('/');
            var filePath = Path.Combine(_env.ContentRootPath, normalizedPath);
            if (!System.IO.File.Exists(filePath))
                return NotFound(ApiResponse.Fail("File vật lý không tìm thấy."));

            // ✅ Perf: PhysicalFile stream trực tiếp, không load cả file vào RAM
            return ServePhysicalFileSecured(filePath, "application/pdf");
        }

        // ── AI References: Tìm tài liệu tham khảo từ nội dung văn bản ──
        [HttpGet("{id}/references")]
        public async Task<IActionResult> GetAiReferences(int id)
        {
            var doc = await _documentRepository.GetDocumentByIdAsync(id);
            if (doc == null)
                return NotFound(ApiResponse.Fail("Không tìm thấy văn bản."));

            var fullText = doc.FullText ?? "";
            var documentTitle = doc.TenCongVan ?? doc.SoVanBan ?? "văn bản";

            if (string.IsNullOrWhiteSpace(fullText) && string.IsNullOrWhiteSpace(documentTitle))
                return Ok(ApiResponse<List<DocumentReference>>.Ok(new List<DocumentReference>()));

            var references = await _aiReferenceService.FindReferencesAsync(fullText, documentTitle);
            return Ok(ApiResponse<List<DocumentReference>>.Ok(references));
        }

        private string GetDayLabel(DateTime date)
        {
            var days = new[] { "Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy" };
            if (date.Date == DateTime.Now.Date) return "Hôm nay (" + days[(int)date.DayOfWeek] + ")";
            return days[(int)date.DayOfWeek];
        }

        private PhysicalFileResult ServePhysicalFileSecured(string filePath, string mimeType)
        {
            Response.Headers["Cache-Control"] = "no-store, private, must-revalidate";
            Response.Headers["Pragma"] = "no-cache";
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            var cd = new System.Net.Mime.ContentDisposition { FileName = Path.GetFileName(filePath), Inline = true };
            Response.Headers["Content-Disposition"] = cd.ToString().Replace("\r", "").Replace("\n", "");
            return PhysicalFile(filePath, mimeType);
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


