using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public interface IQuestionnaireRepository
    {
        Task<List<Questionnaire>> GetAllAsync(string? statusFilter = null);
        Task<int> CreateAsync(CreateQuestionnaireRequest req);
    }

    public class QuestionnaireRepository : IQuestionnaireRepository
    {
        private readonly string _connectionString;

        public QuestionnaireRepository(IConfiguration configuration)
        {
            var dbPath = Environment.GetEnvironmentVariable("DB_PATH") 
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ToolCalendar", "documents.db");
            _connectionString = $"Data Source={dbPath};Pooling=True;Default Timeout=30;Cache=Shared";
        }

        public async Task<List<Questionnaire>> GetAllAsync(string? statusFilter = null)
        {
            var list = new List<Questionnaire>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string whereClause = "";
            if (!string.IsNullOrEmpty(statusFilter) && statusFilter != "All")
            {
                whereClause = "WHERE q.Status = @status";
            }

            string sql = $@"
                SELECT q.Id, q.MeetingId, q.Title, q.AssignedTo, q.TemplateId, q.Type, q.AttachmentPaths, q.Content, q.AssignedUserIds, q.Deadline, q.Status, q.CreatedAt, 
                       m.Title as MeetingTitle, u.FullName as AssignedToName 
                FROM Questionnaires q 
                LEFT JOIN Meetings m ON q.MeetingId = m.Id 
                LEFT JOIN Users u ON q.AssignedTo = u.Id 
                {whereClause}
                ORDER BY q.CreatedAt DESC";

            using var cmd = new SqliteCommand(sql, connection);
            if (!string.IsNullOrEmpty(statusFilter) && statusFilter != "All")
            {
                cmd.Parameters.AddWithValue("@status", statusFilter);
            }

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var q = new Questionnaire
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    MeetingId = Convert.ToInt32(reader["MeetingId"]),
                    MeetingTitle = reader["MeetingTitle"]?.ToString(),
                    Title = reader["Title"]?.ToString() ?? "",
                    AssignedTo = Convert.ToInt32(reader["AssignedTo"]),
                    AssignedToName = reader["AssignedToName"]?.ToString(),
                    Deadline = DateTime.Parse(reader["Deadline"]?.ToString() ?? DateTime.UtcNow.ToString()),
                    Status = reader["Status"]?.ToString() ?? "Chưa trả lời",
                    CreatedAt = DateTime.Parse(reader["CreatedAt"]?.ToString() ?? DateTime.UtcNow.ToString()),
                    
                    // New fields
                    TemplateId = reader["TemplateId"] != DBNull.Value ? Convert.ToInt32(reader["TemplateId"]) : null,
                    Type = reader["Type"]?.ToString(),
                    Content = reader["Content"]?.ToString()
                };

                var attachmentPathsStr = reader["AttachmentPaths"]?.ToString();
                if (!string.IsNullOrEmpty(attachmentPathsStr))
                {
                    q.AttachmentPaths = System.Text.Json.JsonSerializer.Deserialize<List<string>>(attachmentPathsStr) ?? new List<string>();
                }

                var assignedUserIdsStr = reader["AssignedUserIds"]?.ToString();
                if (!string.IsNullOrEmpty(assignedUserIdsStr))
                {
                    q.AssignedUserIds = System.Text.Json.JsonSerializer.Deserialize<List<int>>(assignedUserIdsStr) ?? new List<int>();
                }

                list.Add(q);
            }

            return list;
        }

        public async Task<int> CreateAsync(CreateQuestionnaireRequest req)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = @"
                INSERT INTO Questionnaires (MeetingId, Title, TemplateId, Type, AttachmentPaths, Content, AssignedUserIds, Deadline, Status, CreatedAt, AssignedTo) 
                VALUES (@MeetingId, @Title, @TemplateId, @Type, @AttachmentPaths, @Content, @AssignedUserIds, @Deadline, 'Chưa trả lời', @CreatedAt, 0);
                SELECT last_insert_rowid();";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@MeetingId", req.MeetingId);
            cmd.Parameters.AddWithValue("@Title", req.Title);
            cmd.Parameters.AddWithValue("@TemplateId", req.TemplateId.HasValue ? (object)req.TemplateId.Value : DBNull.Value);
            cmd.Parameters.AddWithValue("@Type", req.Type ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@AttachmentPaths", System.Text.Json.JsonSerializer.Serialize(req.AttachmentPaths));
            cmd.Parameters.AddWithValue("@Content", req.Content ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@AssignedUserIds", System.Text.Json.JsonSerializer.Serialize(req.AssignedUserIds));
            cmd.Parameters.AddWithValue("@Deadline", req.Deadline.ToString("O"));
            cmd.Parameters.AddWithValue("@CreatedAt", DateTime.UtcNow.ToString("O"));

            var result = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }
    }
}
