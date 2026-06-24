using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public interface IQuestionnaireRepository
    {
        Task<List<Questionnaire>> GetAllAsync(string? statusFilter = null);
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
                SELECT q.*, m.Title as MeetingTitle, u.FullName as AssignedToName 
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
                list.Add(new Questionnaire
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    MeetingId = Convert.ToInt32(reader["MeetingId"]),
                    MeetingTitle = reader["MeetingTitle"]?.ToString(),
                    Title = reader["Title"]?.ToString() ?? "",
                    AssignedTo = Convert.ToInt32(reader["AssignedTo"]),
                    AssignedToName = reader["AssignedToName"]?.ToString(),
                    Deadline = DateTime.Parse(reader["Deadline"]?.ToString() ?? DateTime.UtcNow.ToString()),
                    Status = reader["Status"]?.ToString() ?? "Chưa trả lời",
                    CreatedAt = DateTime.Parse(reader["CreatedAt"]?.ToString() ?? DateTime.UtcNow.ToString())
                });
            }

            return list;
        }
    }
}
