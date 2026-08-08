using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;
using System;
using System.Collections.Generic;
using System.IO;

namespace ToolCalendar.Core.Data.Repositories
{
    public class StatsRepository : IStatsRepository
    {
        private readonly string _connectionString;

        public StatsRepository(IConfiguration configuration)
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

        public object GetDashboardStats()
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            int total = 0, overdue = 0, today = 0, urgent = 0;
            var topUrgent = new List<object>();

            using (var cmdCounters = new SqliteCommand(@"
                SELECT
                    COUNT(*) AS Total,
                    SUM(CASE WHEN ThoiHan IS NOT NULL
                              AND ThoiHan < date('now')
                              AND Status != 'Đã xử lý' THEN 1 ELSE 0 END) AS Overdue,
                    SUM(CASE WHEN ThoiHan >= date('now')
                              AND ThoiHan < date('now', '+1 day')
                              AND Status != 'Đã xử lý' THEN 1 ELSE 0 END) AS Today,
                    SUM(CASE WHEN ThoiHan >= date('now')
                              AND ThoiHan <= date('now', '+7 days')
                              AND Status != 'Đã xử lý' THEN 1 ELSE 0 END) AS Urgent
                FROM Documents
            ", connection))
            {
                using var r = cmdCounters.ExecuteReader();
                if (r.Read())
                {
                    total   = r["Total"]   == DBNull.Value ? 0 : Convert.ToInt32(r["Total"]);
                    overdue = r["Overdue"] == DBNull.Value ? 0 : Convert.ToInt32(r["Overdue"]);
                    today   = r["Today"]   == DBNull.Value ? 0 : Convert.ToInt32(r["Today"]);
                    urgent  = r["Urgent"]  == DBNull.Value ? 0 : Convert.ToInt32(r["Urgent"]);
                }
            }

            var statusDict = new Dictionary<string, int>();
            using (var cmdStatus = new SqliteCommand(
                "SELECT COALESCE(Status,'Chưa xử lý'), COUNT(*) FROM Documents GROUP BY Status", connection))
            {
                using var r = cmdStatus.ExecuteReader();
                while (r.Read()) statusDict[r[0]?.ToString() ?? "Chưa xử lý"] = Convert.ToInt32(r[1]);
            }

            var prioDict = new Dictionary<string, int>();
            using (var cmdPrio = new SqliteCommand(
                "SELECT COALESCE(Priority,'Thường'), COUNT(*) FROM Documents GROUP BY Priority", connection))
            {
                using var r = cmdPrio.ExecuteReader();
                while (r.Read()) prioDict[r[0]?.ToString() ?? "Thường"] = Convert.ToInt32(r[1]);
            }

            var deptDict = new Dictionary<string, int>();
            using (var cmdDept = new SqliteCommand(@"
                SELECT IFNULL(d.Name,'Chưa phân loại'), COUNT(doc.Id)
                FROM Documents doc
                LEFT JOIN Departments d ON doc.DepartmentId = d.Id
                GROUP BY d.Name
            ", connection))
            {
                using var r = cmdDept.ExecuteReader();
                while (r.Read())
                    deptDict[r[0]?.ToString() ?? "Chưa phân loại"] = Convert.ToInt32(r[1]);
            }

            using (var cmdTop = new SqliteCommand(@"
                SELECT Id, SoVanBan, TenCongVan, TrichYeu, ThoiHan FROM Documents
                WHERE Status != 'Đã xử lý'
                ORDER BY CASE WHEN ThoiHan IS NULL THEN 1 ELSE 0 END, ThoiHan ASC
                LIMIT 3
            ", connection))
            {
                using var r = cmdTop.ExecuteReader();
                while (r.Read())
                    topUrgent.Add(new {
                        Id         = Convert.ToInt32(r["Id"]),
                        SoVanBan   = r["SoVanBan"]?.ToString()   ?? "",
                        TenCongVan = r["TenCongVan"]?.ToString() ?? "",
                        TrichYeu   = r["TrichYeu"]?.ToString()   ?? "",
                        ThoiHan    = r["ThoiHan"]?.ToString()
                    });
            }

            return new {
                Total        = total,
                ByStatus     = statusDict,
                ByPriority   = prioDict,
                Overdue      = overdue,
                Urgent       = urgent,
                Today        = today,
                ByDepartment = deptDict,
                TopUrgent    = topUrgent
            };
        }

        public object GetDashboardDeadlineSeries(int days = 14)
        {
            if (days < 1) days = 14;
            if (days > 60) days = 60;

            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            var today   = DateTime.Today;
            var endDate = today.AddDays(days);
            var todayStr  = today.ToString("yyyy-MM-dd");
            var endStr    = endDate.ToString("yyyy-MM-dd");

            var buckets = new Dictionary<string, int>();
            using (var cmd = new SqliteCommand(@"
                SELECT
                    CASE WHEN ThoiHan < @today THEN '__overdue__' ELSE ThoiHan END AS Bucket,
                    COUNT(*) AS Cnt
                FROM Documents
                WHERE Status != 'Đã xử lý'
                  AND ThoiHan IS NOT NULL
                  AND ThoiHan < @endDate
                GROUP BY Bucket
            ", connection))
            {
                cmd.Parameters.AddWithValue("@today",   todayStr);
                cmd.Parameters.AddWithValue("@endDate", endStr);
                using var r = cmd.ExecuteReader();
                while (r.Read())
                {
                    var key = r["Bucket"]?.ToString() ?? "";
                    buckets[key] = Convert.ToInt32(r["Cnt"]);
                }
            }

            var items = new List<object>();

            int overdueCount = buckets.TryGetValue("__overdue__", out int ov) ? ov : 0;
            items.Add(new {
                Date         = "overdue",
                Label        = "Quá hạn",
                Count        = overdueCount,
                OverdueCount = overdueCount,
                TodayCount   = 0,
                UpcomingCount= 0
            });

            for (int i = 0; i < days; i++)
            {
                var date  = today.AddDays(i);
                var key   = date.ToString("yyyy-MM-dd");
                int count = buckets.TryGetValue(key, out int c) ? c : 0;
                items.Add(new {
                    Date         = key,
                    Label        = i == 0 ? "Hôm nay" : $"+{i}",
                    Count        = count,
                    OverdueCount = 0,
                    TodayCount   = i == 0 ? count : 0,
                    UpcomingCount= i > 0  ? count : 0
                });
            }

            return items;
        }

        public object GetMonthlyDepartmentReport(int month, int year)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string monthStr = month.ToString("D2");
            string yearStr = year.ToString();
            string prefix = $"{yearStr}-{monthStr}";

            string sql = @"
                SELECT 
                    d.Id,
                    d.Name,
                    COUNT(doc.Id) AS Total,
                    SUM(CASE WHEN doc.Status = 'Đã xử lý' AND (doc.ThoiHan IS NULL OR doc.CompletionDate IS NULL OR date(doc.CompletionDate) <= date(doc.ThoiHan)) THEN 1 ELSE 0 END) AS OnTime,
                    SUM(CASE WHEN doc.Status = 'Đã xử lý' AND doc.ThoiHan IS NOT NULL AND doc.CompletionDate IS NOT NULL AND date(doc.CompletionDate) > date(doc.ThoiHan) THEN 1 ELSE 0 END) AS Overdue,
                    SUM(CASE WHEN doc.Status != 'Đã xử lý' AND (doc.ThoiHan IS NULL OR doc.ThoiHan >= date('now')) THEN 1 ELSE 0 END) AS ProcessingOnTime,
                    SUM(CASE WHEN doc.Status != 'Đã xử lý' AND doc.ThoiHan IS NOT NULL AND doc.ThoiHan < date('now') THEN 1 ELSE 0 END) AS ProcessingOverdue
                FROM Departments d
                LEFT JOIN Documents doc ON d.Id = doc.DepartmentId AND doc.NgayThem LIKE @prefix
                WHERE d.IsActive = 1
                GROUP BY d.Id, d.Name
                ORDER BY d.Id
            ";

            var list = new List<object>();
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@prefix", prefix + "%");
            using var reader = cmd.ExecuteReader();
            
            while (reader.Read())
            {
                list.Add(new
                {
                    id = Convert.ToInt32(reader["Id"]),
                    name = reader["Name"]?.ToString() ?? "",
                    total = reader["Total"] == DBNull.Value ? 0 : Convert.ToInt32(reader["Total"]),
                    onTime = reader["OnTime"] == DBNull.Value ? 0 : Convert.ToInt32(reader["OnTime"]),
                    overdue = reader["Overdue"] == DBNull.Value ? 0 : Convert.ToInt32(reader["Overdue"]),
                    processingOnTime = reader["ProcessingOnTime"] == DBNull.Value ? 0 : Convert.ToInt32(reader["ProcessingOnTime"]),
                    processingOverdue = reader["ProcessingOverdue"] == DBNull.Value ? 0 : Convert.ToInt32(reader["ProcessingOverdue"])
                });
            }

            return list;
        }
    }
}
