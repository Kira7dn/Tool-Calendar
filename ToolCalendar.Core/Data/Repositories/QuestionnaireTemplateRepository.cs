using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public interface IQuestionnaireTemplateRepository
    {
        Task<List<QuestionnaireTemplate>> GetAllAsync();
        Task<int> CreateAsync(QuestionnaireTemplate template);
        Task UpdateAsync(QuestionnaireTemplate template);
        Task DeleteAsync(int id);
    }

    public class QuestionnaireTemplateRepository : IQuestionnaireTemplateRepository
    {
        private readonly string _connectionString;

        public QuestionnaireTemplateRepository(IConfiguration configuration)
        {
            var dbPath = Environment.GetEnvironmentVariable("DB_PATH") 
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ToolCalendar", "documents.db");
            _connectionString = $"Data Source={dbPath};Pooling=True;Default Timeout=30;Cache=Shared";
        }

        public async Task<List<QuestionnaireTemplate>> GetAllAsync()
        {
            var list = new List<QuestionnaireTemplate>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = "SELECT Id, Name, CreatedAt, UpdatedAt FROM QuestionnaireTemplates ORDER BY CreatedAt DESC";

            using var cmd = new SqliteCommand(sql, connection);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new QuestionnaireTemplate
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Name = reader["Name"].ToString() ?? "",
                    CreatedAt = DateTime.Parse(reader["CreatedAt"]?.ToString() ?? DateTime.UtcNow.ToString()),
                    UpdatedAt = reader["UpdatedAt"] == DBNull.Value ? null : DateTime.Parse(reader["UpdatedAt"].ToString()!)
                });
            }

            return list;
        }

        public async Task<int> CreateAsync(QuestionnaireTemplate template)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = "INSERT INTO QuestionnaireTemplates (Name) VALUES (@name); SELECT last_insert_rowid();";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@name", template.Name);

            var id = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(id);
        }

        public async Task UpdateAsync(QuestionnaireTemplate template)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = "UPDATE QuestionnaireTemplates SET Name = @name, UpdatedAt = datetime('now') WHERE Id = @id";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@name", template.Name);
            cmd.Parameters.AddWithValue("@id", template.Id);

            await cmd.ExecuteNonQueryAsync();
        }

        public async Task DeleteAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = "DELETE FROM QuestionnaireTemplates WHERE Id = @id";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@id", id);

            await cmd.ExecuteNonQueryAsync();
        }
    }
}
