using Microsoft.Data.Sqlite;
using ToolCalender.Models;

namespace ToolCalender.Data
{
    public static class DatabaseService
    {
        private static string _connectionString = "";

        public static void Initialize()
        {
            string appData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "ToolCalender"
            );
            Directory.CreateDirectory(appData);
            string dbPath = Path.Combine(appData, "documents.db");
            _connectionString = $"Data Source={dbPath}";

            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string createTable = @"
                CREATE TABLE IF NOT EXISTS Documents (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    SoVanBan TEXT,
                    TrichYeu TEXT,
                    NgayBanHanh TEXT,
                    CoQuanBanHanh TEXT,
                    CoQuanChuQuan TEXT,
                    ThoiHan TEXT,
                    DonViChiDao TEXT,
                    FilePath TEXT,
                    NgayThem TEXT,
                    DaTaoLich INTEGER DEFAULT 0
                )";

            using var cmd = new SqliteCommand(createTable, connection);
            cmd.ExecuteNonQuery();
        }

        public static List<DocumentRecord> GetAll()
        {
            var records = new List<DocumentRecord>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string sql = "SELECT * FROM Documents ORDER BY ThoiHan ASC NULLS LAST";
            using var cmd = new SqliteCommand(sql, connection);
            using var reader = cmd.ExecuteReader();

            while (reader.Read())
                records.Add(MapRecord(reader));

            return records;
        }

        public static int Insert(DocumentRecord record)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string sql = @"
                INSERT INTO Documents (SoVanBan, TrichYeu, NgayBanHanh, CoQuanBanHanh, CoQuanChuQuan, ThoiHan, DonViChiDao, FilePath, NgayThem, DaTaoLich)
                VALUES (@SoVanBan, @TrichYeu, @NgayBanHanh, @CoQuanBanHanh, @CoQuanChuQuan, @ThoiHan, @DonViChiDao, @FilePath, @NgayThem, @DaTaoLich);
                SELECT last_insert_rowid();";

            using var cmd = new SqliteCommand(sql, connection);
            AddParams(cmd, record);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }

        public static void Update(DocumentRecord record)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();

            string sql = @"
                UPDATE Documents SET
                    SoVanBan=@SoVanBan, TrichYeu=@TrichYeu, NgayBanHanh=@NgayBanHanh,
                    CoQuanBanHanh=@CoQuanBanHanh, CoQuanChuQuan=@CoQuanChuQuan,
                    ThoiHan=@ThoiHan, DonViChiDao=@DonViChiDao,
                    FilePath=@FilePath, DaTaoLich=@DaTaoLich
                WHERE Id=@Id";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@Id", record.Id);
            AddParams(cmd, record);
            cmd.ExecuteNonQuery();
        }

        public static void Delete(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("DELETE FROM Documents WHERE Id=@Id", connection);
            cmd.Parameters.AddWithValue("@Id", id);
            cmd.ExecuteNonQuery();
        }

        private static void AddParams(SqliteCommand cmd, DocumentRecord r)
        {
            cmd.Parameters.AddWithValue("@SoVanBan", (object?)r.SoVanBan ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@TrichYeu", (object?)r.TrichYeu ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@NgayBanHanh", r.NgayBanHanh.HasValue ? (object)r.NgayBanHanh.Value.ToString("yyyy-MM-dd") : DBNull.Value);
            cmd.Parameters.AddWithValue("@CoQuanBanHanh", (object?)r.CoQuanBanHanh ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@CoQuanChuQuan", (object?)r.CoQuanChuQuan ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ThoiHan", r.ThoiHan.HasValue ? (object)r.ThoiHan.Value.ToString("yyyy-MM-dd") : DBNull.Value);
            cmd.Parameters.AddWithValue("@DonViChiDao", (object?)r.DonViChiDao ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@FilePath", (object?)r.FilePath ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@NgayThem", r.NgayThem.ToString("yyyy-MM-dd HH:mm:ss"));
            cmd.Parameters.AddWithValue("@DaTaoLich", r.DaTaoLich ? 1 : 0);
        }

        private static DocumentRecord MapRecord(SqliteDataReader r)
        {
            return new DocumentRecord
            {
                Id = Convert.ToInt32(r["Id"]),
                SoVanBan = r["SoVanBan"]?.ToString() ?? "",
                TrichYeu = r["TrichYeu"]?.ToString() ?? "",
                NgayBanHanh = TryParseDate(r["NgayBanHanh"]?.ToString()),
                CoQuanBanHanh = r["CoQuanBanHanh"]?.ToString() ?? "",
                CoQuanChuQuan = r["CoQuanChuQuan"]?.ToString() ?? "",
                ThoiHan = TryParseDate(r["ThoiHan"]?.ToString()),
                DonViChiDao = r["DonViChiDao"]?.ToString() ?? "",
                FilePath = r["FilePath"]?.ToString() ?? "",
                NgayThem = TryParseDate(r["NgayThem"]?.ToString()) ?? DateTime.Now,
                DaTaoLich = Convert.ToInt32(r["DaTaoLich"]) == 1
            };
        }

        private static DateTime? TryParseDate(string? value)
        {
            if (string.IsNullOrEmpty(value)) return null;
            if (DateTime.TryParse(value, out DateTime dt)) return dt;
            return null;
        }
    }
}
