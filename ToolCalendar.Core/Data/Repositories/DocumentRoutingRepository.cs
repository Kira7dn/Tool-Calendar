using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Models;

namespace ToolCalendar.Data.Repositories
{
    public interface IDocumentRoutingRepository
    {
        Task<List<DocumentRoutingRecord>> GetTreeByDocumentIdAsync(int documentId);
        Task<int> CreateRoutingAsync(DocumentRoutingRecord routing);
        Task UpdateStatusAsync(int id, string status, string processingContent);
        Task UpdateStatusByDocumentAndReceiverAsync(int documentId, int receiverId, string status, string processingContent);
        Task DowngradeRoleAsync(int documentId, string oldRole, string newRole);
    }

    public class DocumentRoutingRepository : IDocumentRoutingRepository
    {
        private readonly string _connectionString;

        public DocumentRoutingRepository(IConfiguration configuration)
        {
            string configConnString = configuration.GetConnectionString("DefaultConnection");
            if (!string.IsNullOrEmpty(configConnString)) { _connectionString = configConnString; }
            else
            {
                string envPath = Environment.GetEnvironmentVariable("DB_PATH");
                if (!string.IsNullOrEmpty(envPath)) { _connectionString = $"Data Source={envPath};Pooling=False;Default Timeout=30"; }
                else
                {
                    string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ToolCalendar");
                    _connectionString = $"Data Source={Path.Combine(appData, "documents.db")};Pooling=False;Default Timeout=30";
                }
            }
        }

        public async Task<List<DocumentRoutingRecord>> GetTreeByDocumentIdAsync(int documentId)
        {
            var allRoutings = new List<DocumentRoutingRecord>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            
            string sql = @"
                SELECT 
                    r.Id, r.DocumentId, r.SenderId, r.ReceiverId, r.ParentRoutingId, 
                    r.Role, r.ForwardDate, r.Deadline, r.Comment, r.ProcessingContent, 
                    r.Status, r.CreatedAt,
                    s.FullName as SenderName,
                    u.FullName as ReceiverName
                FROM DocumentRoutings r
                LEFT JOIN Users s ON r.SenderId = s.Id
                LEFT JOIN Users u ON r.ReceiverId = u.Id
                WHERE r.DocumentId = @DocumentId
                ORDER BY r.Id ASC";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@DocumentId", documentId);
            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                var r = new DocumentRoutingRecord
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    DocumentId = Convert.ToInt32(reader["DocumentId"]),
                    SenderId = Convert.ToInt32(reader["SenderId"]),
                    ReceiverId = Convert.ToInt32(reader["ReceiverId"]),
                    ParentRoutingId = reader["ParentRoutingId"] != DBNull.Value ? Convert.ToInt32(reader["ParentRoutingId"]) : null,
                    Role = reader["Role"].ToString() ?? "Chủ trì",
                    ForwardDate = reader["ForwardDate"] != DBNull.Value ? DateTime.Parse(reader["ForwardDate"].ToString()!) : null,
                    Deadline = reader["Deadline"] != DBNull.Value ? DateTime.Parse(reader["Deadline"].ToString()!) : null,
                    Comment = reader["Comment"].ToString() ?? "",
                    ProcessingContent = reader["ProcessingContent"].ToString() ?? "",
                    Status = reader["Status"].ToString() ?? "Chưa xử lý",
                    CreatedAt = DateTime.Parse(reader["CreatedAt"].ToString()!),
                    SenderName = reader["SenderName"] != DBNull.Value ? reader["SenderName"].ToString()! : "",
                    ReceiverName = reader["ReceiverName"] != DBNull.Value ? reader["ReceiverName"].ToString()! : "",
                    Children = new List<DocumentRoutingRecord>()
                };
                allRoutings.Add(r);
            }

            // Build Tree
            var rootNodes = new List<DocumentRoutingRecord>();
            var lookup = allRoutings.ToLookup(x => x.ParentRoutingId);

            foreach (var routing in allRoutings)
            {
                routing.Children = lookup[routing.Id].ToList();
                if (routing.ParentRoutingId == null)
                {
                    rootNodes.Add(routing);
                }
            }

            return rootNodes;
        }

        public async Task<int> CreateRoutingAsync(DocumentRoutingRecord routing)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            
            string sql = @"
                INSERT INTO DocumentRoutings 
                (DocumentId, SenderId, ReceiverId, ParentRoutingId, Role, ForwardDate, Deadline, Comment, ProcessingContent, Status, CreatedAt)
                VALUES 
                (@DocumentId, @SenderId, @ReceiverId, @ParentRoutingId, @Role, @ForwardDate, @Deadline, @Comment, @ProcessingContent, @Status, @CreatedAt);
                SELECT last_insert_rowid();";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@DocumentId", routing.DocumentId);
            cmd.Parameters.AddWithValue("@SenderId", routing.SenderId);
            cmd.Parameters.AddWithValue("@ReceiverId", routing.ReceiverId);
            cmd.Parameters.AddWithValue("@ParentRoutingId", routing.ParentRoutingId.HasValue ? routing.ParentRoutingId.Value : DBNull.Value);
            cmd.Parameters.AddWithValue("@Role", routing.Role);
            cmd.Parameters.AddWithValue("@ForwardDate", routing.ForwardDate?.ToString("yyyy-MM-dd HH:mm:ss") ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@Deadline", routing.Deadline?.ToString("yyyy-MM-dd HH:mm:ss") ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@Comment", routing.Comment);
            cmd.Parameters.AddWithValue("@ProcessingContent", routing.ProcessingContent);
            cmd.Parameters.AddWithValue("@Status", routing.Status);
            cmd.Parameters.AddWithValue("@CreatedAt", routing.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"));

            var newId = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(newId);
        }

        public async Task UpdateStatusAsync(int id, string status, string processingContent)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            
            string sql = @"
                UPDATE DocumentRoutings
                SET Status = @Status, ProcessingContent = @ProcessingContent
                WHERE Id = @Id";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@Id", id);
            cmd.Parameters.AddWithValue("@Status", status);
            cmd.Parameters.AddWithValue("@ProcessingContent", processingContent);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task UpdateStatusByDocumentAndReceiverAsync(int documentId, int receiverId, string status, string processingContent)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            
            string sql = @"
                UPDATE DocumentRoutings
                SET Status = @Status, ProcessingContent = @ProcessingContent
                WHERE DocumentId = @DocumentId AND ReceiverId = @ReceiverId AND Status != 'Đã xử lý' AND Status != 'Đã xử lý'";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@DocumentId", documentId);
            cmd.Parameters.AddWithValue("@ReceiverId", receiverId);
            cmd.Parameters.AddWithValue("@Status", status);
            cmd.Parameters.AddWithValue("@ProcessingContent", processingContent);
            await cmd.ExecuteNonQueryAsync();
        }
        public async Task DowngradeRoleAsync(int documentId, string oldRole, string newRole)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            
            string sql = @"
                UPDATE DocumentRoutings
                SET Role = @NewRole
                WHERE DocumentId = @DocumentId AND Role = @OldRole";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@DocumentId", documentId);
            cmd.Parameters.AddWithValue("@OldRole", oldRole);
            cmd.Parameters.AddWithValue("@NewRole", newRole);
            await cmd.ExecuteNonQueryAsync();
        }
    }
}
