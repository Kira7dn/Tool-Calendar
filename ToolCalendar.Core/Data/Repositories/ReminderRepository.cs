using System;
using System.Collections.Generic;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Core.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public class ReminderRepository : IReminderRepository
    {
        private readonly string _connectionString;

        public ReminderRepository(IConfiguration configuration)
        {
            var dbPath = configuration.GetValue<string>("Database:Path") ?? "documents.db";
            _connectionString = $"Data Source={dbPath}";
        }

        public int AddReminder(int userId, string content, string remindAt)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO Reminders (UserId, Content, RemindAt)
                VALUES (@UserId, @Content, @RemindAt);
                SELECT last_insert_rowid();";
            cmd.Parameters.AddWithValue("@UserId", userId);
            cmd.Parameters.AddWithValue("@Content", content);
            cmd.Parameters.AddWithValue("@RemindAt", remindAt);

            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public List<Reminder> GetPendingReminders()
        {
            var list = new List<Reminder>();
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();
            using var cmd = conn.CreateCommand();
            // Lấy các reminder chưa gửi và đã đến giờ nhắc
            cmd.CommandText = @"
                SELECT Id, UserId, Content, RemindAt, IsSent, CreatedAt
                FROM Reminders
                WHERE IsSent = 0 AND datetime(RemindAt) <= datetime('now', 'localtime')";
            
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new Reminder
                {
                    Id = reader.GetInt32(0),
                    UserId = reader.GetInt32(1),
                    Content = reader.GetString(2),
                    RemindAt = reader.GetString(3),
                    IsSent = reader.GetInt32(4),
                    CreatedAt = reader.GetString(5)
                });
            }
            return list;
        }

        public void MarkAsSent(int id)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE Reminders SET IsSent = 1 WHERE Id = @Id";
            cmd.Parameters.AddWithValue("@Id", id);
            cmd.ExecuteNonQuery();
        }

        public List<Reminder> GetUserReminders(int userId)
        {
            var list = new List<Reminder>();
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT Id, UserId, Content, RemindAt, IsSent, CreatedAt
                FROM Reminders
                WHERE UserId = @UserId
                ORDER BY RemindAt DESC LIMIT 50";
            cmd.Parameters.AddWithValue("@UserId", userId);
            
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new Reminder
                {
                    Id = reader.GetInt32(0),
                    UserId = reader.GetInt32(1),
                    Content = reader.GetString(2),
                    RemindAt = reader.GetString(3),
                    IsSent = reader.GetInt32(4),
                    CreatedAt = reader.GetString(5)
                });
            }
            return list;
        }
    }
}
