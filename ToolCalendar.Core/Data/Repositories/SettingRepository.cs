using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;
using System;
using System.IO;

namespace ToolCalendar.Core.Data.Repositories
{
    public class SettingRepository : ISettingRepository
    {
        private readonly string _connectionString;

        public SettingRepository(IConfiguration configuration)
        {
            string? configConnString = configuration.GetConnectionString("DefaultConnection");
            if (!string.IsNullOrEmpty(configConnString)) { _connectionString = configConnString; }
            else
            {
                string? envPath = Environment.GetEnvironmentVariable("DB_PATH");
                if (!string.IsNullOrEmpty(envPath)) { _connectionString = $"Data Source={envPath};Pooling=False;Default Timeout=30"; }
                else
                {
                    string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ToolCalendar");
                    _connectionString = $"Data Source={Path.Combine(appData, "documents.db")};Pooling=False;Default Timeout=30";
                }
            }
        }

        public string GetAppSetting(string key, string defaultVal = "")
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("SELECT [Value] FROM AppSettings WHERE [Key]=@k", connection);
            cmd.Parameters.AddWithValue("@k", key);
            var result = cmd.ExecuteScalar();
            return result?.ToString() ?? defaultVal;
        }

        public void SaveAppSetting(string key, string val)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand(@"
                INSERT INTO AppSettings ([Key], [Value]) 
                VALUES (@k, @v) 
                ON CONFLICT([Key]) DO UPDATE SET [Value]=@v", connection);
            cmd.Parameters.AddWithValue("@k", key);
            cmd.Parameters.AddWithValue("@v", val);
            cmd.ExecuteNonQuery();
        }
    }
}
