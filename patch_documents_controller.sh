sed -i '' -e '/\[HttpPost("{id}\/assign")/i\
        [HttpPut("{id}/reject-assignment")]\
        public async Task<IActionResult> RejectAssignment(int id, [FromBody] RejectRoutingDto dto)\
        {\
            var doc = await _documentRepository.GetDocumentByIdAsync(id);\
            if (doc == null) return NotFound(ApiResponse.Fail("Văn bản không tồn tại."));\
\
            var currentUserIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;\
            if (!int.TryParse(currentUserIdStr, out int currentUserId)) return Unauthorized(ApiResponse.Fail("Token không hợp lệ."));\
\
            if (doc.AssignedTo != currentUserId)\
                return StatusCode(403, ApiResponse.Fail("Bạn không phải người được giao xử lý chính văn bản này."));\
\
            if (doc.Status == "Hoàn thành")\
                return BadRequest(ApiResponse.Fail("Không thể hủy tiếp nhận khi văn bản đã hoàn thành."));\
\
            var reason = string.IsNullOrWhiteSpace(dto.Reason) ? "Không có lý do" : dto.Reason.Trim();\
            doc.AssignedTo = null;\
            doc.Status = "Từ chối";\
            await _documentRepository.UpdateAsync(doc);\
\
            var receiver = _userRepo.GetUserById(currentUserId);\
            var docName = doc.TenCongVan ?? "văn bản";\
\
            if (doc.UploadedByUserId.HasValue)\
            {\
                await _notificationManager.SendToUserAsync(\
                    doc.UploadedByUserId.Value,\
                    "Từ chối tiếp nhận",\
                    $"{receiver?.FullName ?? "Người dùng"} đã từ chối tiếp nhận xử lý chính '{docName}'. Lý do: {reason}",\
                    new { docId = id, type = "routing_rejected" }\
                );\
            }\
\
            _ = _hubContext.Clients.All.SendAsync("DocumentUpdated", new { id = id, status = doc.Status });\
            return Ok(ApiResponse.Ok("Đã hủy tiếp nhận thành công."));\
        }\
' ToolCalendar.Api/Controllers/Documents/DocumentsController.cs
