using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IDocumentRepository
    {
        Task<(List<DocumentRecord> Items, int TotalCount)> GetPagedAsync(int page, int pageSize, string search = "", string status = "", string sort = "deadline_asc", DateTime? fromDate = null, DateTime? toDate = null, DateTime? addFromDate = null, DateTime? addToDate = null, int? currentUserId = null, string? currentUserRole = null, int? currentDepartmentId = null, string activeTab = "");
        Task<List<string>> GetUniqueStatusesAsync();
        Task<DocumentRecord?> GetDocumentByIdAsync(int id, int? currentUserId = null, string? currentUserRole = null, int? currentDepartmentId = null);
        Task<int> InsertAsync(DocumentRecord record);
        Task UpdateAsync(DocumentRecord record);
        Task AssignDocumentAsync(int docId, string departmentIds, string userIds);
        /// <summary>
        /// Cập nhật cán bộ xử lý và đơn vị chủ trì khi có routing mới (luân chuyển công văn).
        /// </summary>
        Task UpdateHandlerAsync(int docId, int receiverId, int? departmentId);
        Task SubmitEvidenceAsync(int docId, string evidenceJson, string notes);
        Task DeleteAsync(int id);
        Task BulkUpdateStatusAsync(List<int> ids, string status);
        Task BulkDeleteAsync(List<int> ids);
        Task<List<DocumentRecord>> GetAllAsync(int? currentUserId = null, string? currentUserRole = null, int? currentDepartmentId = null);
        Task<byte[]> ExportDocumentsToCsvAsync();

        // Comment Management
        Task<List<Comment>> GetCommentsAsync(int docId, int page = 1, int pageSize = 500);
        Task InsertCommentAsync(Comment c);
        Task DeleteCommentAsync(int commentId, int requestingUserId, bool isAdmin);
        Task<List<CommentReaction>> GetReactionsForCommentAsync(int commentId);
        /// <summary>Lấy reactions cho nhiều comment cùng lúc (tránh N+1 queries)</summary>
        Task<List<CommentReaction>> GetReactionsForCommentsAsync(IEnumerable<int> commentIds);
        Task<string> ToggleReactionAsync(int commentId, int userId, string username, string reactionType);

        // Performance: lọc tại DB thay vì load tất cả rồi lọc bằng C#
        /// <summary>Lấy task của user: lọc bằng SQL thay vì GetAllAsync + LINQ</summary>
        Task<List<DocumentRecord>> GetTasksByUserIdAsync(int userId);
        /// <summary>Lấy Id + FilePath của nhiều document: dùng cho BulkDelete</summary>
        Task<Dictionary<int, string>> GetFilePathsByIdsAsync(IEnumerable<int> ids);

        /// <summary>
        /// Tra cứu document theo SHA-256 hash nội dung file.
        /// Dùng để phát hiện và ngăn chặn upload file trùng lặp.
        /// Trả về null nếu không tìm thấy (file chưa từng được upload).
        /// </summary>
        Task<DocumentRecord?> GetByContentHashAsync(string sha256Hash);

        /// <summary>
        /// Xóa các văn bản nháp (Đang OCR, Chờ lưu, Lỗi OCR) đã tồn tại quá lâu trong hệ thống.
        /// Trả về số lượng bản ghi đã bị xóa.
        /// </summary>
        Task<int> CleanupOldDraftsAsync(TimeSpan olderThan);
    }
}

