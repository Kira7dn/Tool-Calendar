using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IDocumentRepository
    {
        Task<(List<DocumentRecord> Items, int TotalCount)> GetPagedAsync(int page, int pageSize, string search = "", string status = "", string sort = "deadline_asc", DateTime? fromDate = null, DateTime? toDate = null);
        Task<List<string>> GetUniqueStatusesAsync();
        Task<DocumentRecord?> GetDocumentByIdAsync(int id);
        Task<int> InsertAsync(DocumentRecord record);
        Task UpdateAsync(DocumentRecord record);
        Task AssignDocumentAsync(int docId, string departmentIds, string userIds);
        Task SubmitEvidenceAsync(int docId, string evidenceJson, string notes);
        Task DeleteAsync(int id);
        Task BulkUpdateStatusAsync(List<int> ids, string status);
        Task BulkDeleteAsync(List<int> ids);
        Task<List<DocumentRecord>> GetAllAsync();
        Task<byte[]> ExportDocumentsToCsvAsync();

        // Comment Management
        Task<List<Comment>> GetCommentsAsync(int docId, int page = 1, int pageSize = 500);
        Task InsertCommentAsync(Comment c);
        Task DeleteCommentAsync(int commentId, int requestingUserId, bool isAdmin);
        Task<List<CommentReaction>> GetReactionsForCommentAsync(int commentId);
        Task<string> ToggleReactionAsync(int commentId, int userId, string username, string reactionType);
    }
}

