using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

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
        public async Task<string> GetAiContextStatsAsync()
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            using var cmd = new SqliteCommand(@"
                SELECT
                    SUM(CASE WHEN ThoiHan IS NOT NULL AND ThoiHan < date('now', '+7 hours') AND Status != 'Hoàn thành' THEN 1 ELSE 0 END) AS QuaHan,
                    SUM(CASE WHEN ThoiHan IS NOT NULL AND ThoiHan = date('now', '+7 hours') AND Status != 'Hoàn thành' THEN 1 ELSE 0 END) AS HomNay,
                    SUM(CASE WHEN ThoiHan IS NOT NULL AND ThoiHan = date('now', '+7 hours', '+1 day') AND Status != 'Hoàn thành' THEN 1 ELSE 0 END) AS NgayMai,
                    SUM(CASE WHEN ThoiHan IS NOT NULL AND ThoiHan > date('now', '+7 hours', '+1 day') AND ThoiHan <= date('now', '+7 hours', '+7 days') AND Status != 'Hoàn thành' THEN 1 ELSE 0 END) AS TrongTuan,
                    SUM(CASE WHEN ThoiHan IS NOT NULL AND ThoiHan > date('now', '+7 hours', '+7 days') AND ThoiHan <= date('now', '+7 hours', '+30 days') AND Status != 'Hoàn thành' THEN 1 ELSE 0 END) AS TrongThang,
                    COUNT(*) AS TongTonDong
                FROM Documents
                WHERE Status != 'Hoàn thành'
            ", connection);

            var quaHan = 0;
            var homNay = 0;
            var ngayMai = 0;
            var trongTuan = 0;
            var trongThang = 0;
            var tongTonDong = 0;

            using (var r = await cmd.ExecuteReaderAsync())
            {
                if (await r.ReadAsync())
                {
                    quaHan = r["QuaHan"] == DBNull.Value ? 0 : Convert.ToInt32(r["QuaHan"]);
                    homNay = r["HomNay"] == DBNull.Value ? 0 : Convert.ToInt32(r["HomNay"]);
                    ngayMai = r["NgayMai"] == DBNull.Value ? 0 : Convert.ToInt32(r["NgayMai"]);
                    trongTuan = r["TrongTuan"] == DBNull.Value ? 0 : Convert.ToInt32(r["TrongTuan"]);
                    trongThang = r["TrongThang"] == DBNull.Value ? 0 : Convert.ToInt32(r["TrongThang"]);
                    tongTonDong = r["TongTonDong"] == DBNull.Value ? 0 : Convert.ToInt32(r["TongTonDong"]);
                }
            }

            // Danh sách chi tiết công văn đến hạn hôm nay
            using var cmdHomNay = new SqliteCommand(@"
                SELECT SoVanBan, TenCongVan, ThoiHan, Status, Priority
                FROM Documents
                WHERE ThoiHan = date('now', '+7 hours') AND Status != 'Hoàn thành'
                ORDER BY TenCongVan ASC
                LIMIT 20
            ", connection);
            var listHomNay = new System.Text.StringBuilder();
            using (var r = await cmdHomNay.ExecuteReaderAsync())
            {
                while (await r.ReadAsync())
                {
                    var so = r["SoVanBan"]?.ToString() ?? "(không số)";
                    var ten = r["TenCongVan"]?.ToString();
                    var tt = r["Status"]?.ToString();
                    var priority = r["Priority"]?.ToString();
                    listHomNay.AppendLine($"  • [{priority}] {so} — {ten} (Trạng thái: {tt})");
                }
            }

            // Danh sách chi tiết công văn quá hạn
            using var cmdQuaHan = new SqliteCommand(@"
                SELECT SoVanBan, TenCongVan, ThoiHan, Status, Priority
                FROM Documents
                WHERE ThoiHan < date('now', '+7 hours') AND Status != 'Hoàn thành'
                ORDER BY ThoiHan ASC
                LIMIT 20
            ", connection);
            var listQuaHan = new System.Text.StringBuilder();
            using (var r2 = await cmdQuaHan.ExecuteReaderAsync())
            {
                while (await r2.ReadAsync())
                {
                    var so = r2["SoVanBan"]?.ToString() ?? "(không số)";
                    var ten = r2["TenCongVan"]?.ToString();
                    var han = r2["ThoiHan"] == DBNull.Value ? "" : Convert.ToDateTime(r2["ThoiHan"]).ToString("dd/MM/yyyy");
                    var tt = r2["Status"]?.ToString();
                    listQuaHan.AppendLine($"  • {so} — {ten} (Hạn: {han}, Trạng thái: {tt})");
                }
            }

            // Danh sách công văn đến hạn trong 7 ngày tới (không tính hôm nay)
            using var cmdSapHan = new SqliteCommand(@"
                SELECT SoVanBan, TenCongVan, ThoiHan, Status, Priority
                FROM Documents
                WHERE ThoiHan > date('now', '+7 hours') AND ThoiHan <= date('now', '+7 hours', '+7 days') AND Status != 'Hoàn thành'
                ORDER BY ThoiHan ASC
                LIMIT 15
            ", connection);
            var listSapHan = new System.Text.StringBuilder();
            using (var r3 = await cmdSapHan.ExecuteReaderAsync())
            {
                while (await r3.ReadAsync())
                {
                    var so = r3["SoVanBan"]?.ToString() ?? "(không số)";
                    var ten = r3["TenCongVan"]?.ToString();
                    var han = r3["ThoiHan"] == DBNull.Value ? "" : Convert.ToDateTime(r3["ThoiHan"]).ToString("dd/MM/yyyy");
                    var tt = r3["Status"]?.ToString();
                    listSapHan.AppendLine($"  • {so} — {ten} (Hạn: {han}, Trạng thái: {tt})");
                }
            }

            return $"[DỮ LIỆU THỐNG KÊ THỜI GIAN THỰC CỦA HỆ THỐNG ĐỂ TRẢ LỜI NGƯỜI DÙNG]\n" +
                   $"- Tổng số công văn chưa xử lý / tồn đọng trong hệ thống: {tongTonDong}\n" +
                   $"- Số công văn đã quá hạn xử lý: {quaHan}\n" +
                   $"- Số công văn đến hạn HÔM NAY: {homNay}\n" +
                   $"- Số công văn đến hạn NGÀY MAI: {ngayMai}\n" +
                   $"- Số công văn đến hạn TRONG TUẦN NÀY (7 ngày tới): {trongTuan}\n" +
                   $"- Số công văn đến hạn TRONG THÁNG SAU (từ 8 đến 30 ngày tới): {trongThang}\n" +
                   $"- {vanBanGanNhat}\n\n" +
                   $"DANH SÁCH CÔNG VĂN ĐẾN HẠN HÔM NAY ({homNay} văn bản):\n" +
                   (listHomNay.Length > 0 ? listHomNay.ToString() : "  (Không có công văn nào đến hạn hôm nay)\n") +
                   $"\nDANH SÁCH CÔNG VĂN ĐÃ QUÁ HẠN ({quaHan} văn bản):\n" +
                   (listQuaHan.Length > 0 ? listQuaHan.ToString() : "  (Không có công văn nào quá hạn)\n") +
                   $"\nDANH SÁCH CÔNG VĂN SẮP ĐẾN HẠN TRONG 7 NGÀY TỚI:\n" +
                   (listSapHan.Length > 0 ? listSapHan.ToString() : "  (Không có công văn nào sắp đến hạn)\n") +
                   $"\nLƯU Ý: Bạn BẮT BUỘC dựa vào danh sách trên để liệt kê chính xác khi người dùng hỏi. Tuyệt đối không tự bịa thêm văn bản không có trong danh sách.";
        }
    }
}

