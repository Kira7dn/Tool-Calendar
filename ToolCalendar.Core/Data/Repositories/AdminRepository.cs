using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Models;
using System;
using System.Collections.Generic;
using System.IO;

namespace ToolCalendar.Core.Data.Repositories
{
    public class AdminRepository : IAdminRepository
    {
        private readonly string _connectionString;

        public AdminRepository(IConfiguration configuration)
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

        public List<Department> GetDepartments()
        {
            var list = new List<Department>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "SELECT Id, Name, Description, IsActive FROM Departments";
            using var cmd = new SqliteCommand(sql, connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new Department
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Name = reader["Name"].ToString() ?? "",
                    Description = reader["Description"]?.ToString() ?? "",
                    IsActive = reader.HasColumn("IsActive") && reader["IsActive"] != DBNull.Value ? Convert.ToInt32(reader["IsActive"]) == 1 : true
                });
            }
            return list;
        }

        public int InsertDepartment(Department d)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("INSERT INTO Departments (Name, Description, IsActive) VALUES (@n, @d, @ia); SELECT last_insert_rowid();", connection);
            cmd.Parameters.AddWithValue("@n", d.Name);
            cmd.Parameters.AddWithValue("@d", d.Description);
            cmd.Parameters.AddWithValue("@ia", d.IsActive ? 1 : 0);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public void UpdateDepartment(Department d)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("UPDATE Departments SET Name = @n, Description = @d, IsActive = @ia WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@n", d.Name);
            cmd.Parameters.AddWithValue("@d", d.Description);
            cmd.Parameters.AddWithValue("@ia", d.IsActive ? 1 : 0);
            cmd.Parameters.AddWithValue("@id", d.Id);
            cmd.ExecuteNonQuery();
        }

        public void DeleteDepartment(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("UPDATE Departments SET IsActive = 0 WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.ExecuteNonQuery();
        }

        public List<Label> GetLabels()
        {
            var list = new List<Label>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("SELECT Id, Name, Color FROM Labels", connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new Label
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Name = reader["Name"].ToString() ?? "",
                    Color = reader["Color"]?.ToString() ?? ""
                });
            }
            return list;
        }

        public int InsertLabel(Label l)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("INSERT INTO Labels (Name, Color) VALUES (@n, @c); SELECT last_insert_rowid();", connection);
            cmd.Parameters.AddWithValue("@n", l.Name);
            cmd.Parameters.AddWithValue("@c", l.Color);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public void DeleteLabel(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                using var cmd = connection.CreateCommand();
                cmd.Transaction = transaction;

                cmd.CommandText = "UPDATE Documents SET LabelId = NULL WHERE LabelId = @id";
                cmd.Parameters.AddWithValue("@id", id);
                cmd.ExecuteNonQuery();

                cmd.CommandText = "UPDATE AutoRules SET LabelId = NULL WHERE LabelId = @id";
                cmd.ExecuteNonQuery();

                cmd.CommandText = "DELETE FROM Labels WHERE Id = @id";
                cmd.ExecuteNonQuery();

                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public List<AutoRule> GetAutoRules()
        {
            var list = new List<AutoRule>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("SELECT r.Id, r.Keyword, r.LabelId, r.DepartmentId, r.DefaultDeadlineDays, d.Name as DepartmentName FROM AutoRules r LEFT JOIN Departments d ON r.DepartmentId = d.Id", connection);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new AutoRule
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Keyword = reader["Keyword"].ToString() ?? "",
                    LabelId = reader["LabelId"] == DBNull.Value ? null : Convert.ToInt32(reader["LabelId"]),
                    DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),
                    DepartmentName = reader["DepartmentName"]?.ToString(),
                    DefaultDeadlineDays = Convert.ToInt32(reader["DefaultDeadlineDays"])
                });
            }
            return list;
        }

        public int InsertAutoRule(AutoRule r)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = "INSERT INTO AutoRules (Keyword, LabelId, DepartmentId, DefaultDeadlineDays) VALUES (@k, @l, @dept, @d); SELECT last_insert_rowid();";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@k", r.Keyword);
            cmd.Parameters.AddWithValue("@l", (object?)r.LabelId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@dept", (object?)r.DepartmentId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@d", r.DefaultDeadlineDays);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public void DeleteAutoRule(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("DELETE FROM AutoRules WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.ExecuteNonQuery();
        }
    }
}
