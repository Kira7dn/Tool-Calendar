using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Repositories
{
    public class DocumentRepository : IDocumentRepository
    {
        private readonly string _connectionString;

        public DocumentRepository(IConfiguration configuration)
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
        // --- COMMENT MANAGEMENT ---
        public async Task<List<Comment>> GetCommentsAsync(int docId)
        {
            var list = new List<Comment>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            string sql = "SELECT * FROM Comments WHERE DocumentId=@id ORDER BY CreatedAt ASC";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@id", docId);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new Comment
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    DocumentId = Convert.ToInt32(reader["DocumentId"]),
                    UserId = Convert.ToInt32(reader["UserId"]),
                    Username = reader["Username"].ToString() ?? "",
                    Content = reader["Content"].ToString() ?? "",
                    AttachmentPaths = reader["AttachmentPaths"]?.ToString() ?? "[]",
                    CreatedAt = DateTime.Parse(reader["CreatedAt"].ToString() ?? DateTime.UtcNow.AddHours(7).ToString())
                });
            }
            return list;
        }

        public async Task InsertCommentAsync(Comment c)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            string sql = "INSERT INTO Comments (DocumentId, UserId, Username, Content, AttachmentPaths, CreatedAt) VALUES (@docId, @uId, @uName, @c, @ap, @now)";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));
            cmd.Parameters.AddWithValue("@docId", c.DocumentId);
            cmd.Parameters.AddWithValue("@uId", c.UserId);
            cmd.Parameters.AddWithValue("@uName", c.Username);
            cmd.Parameters.AddWithValue("@c", c.Content);
            cmd.Parameters.AddWithValue("@ap", c.AttachmentPaths ?? "[]");
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task DeleteCommentAsync(int commentId, int requestingUserId, bool isAdmin)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var transaction = connection.BeginTransaction();
            try
            {
                using var cmd = connection.CreateCommand();
                cmd.Transaction = transaction;

                // 1. KiÃ¡Â»Æ’m tra quyÃ¡Â»Ân xÃƒÂ³a vÃƒÂ  xÃƒÂ³a cÃƒÂ¡c Reaction liÃƒÂªn quan trÃ†Â°Ã¡Â»â€ºc
                cmd.CommandText = isAdmin
                    ? "DELETE FROM CommentReactions WHERE CommentId = @id"
                    : "DELETE FROM CommentReactions WHERE CommentId = @id AND CommentId IN (SELECT Id FROM Comments WHERE UserId = @uid)";
                cmd.Parameters.AddWithValue("@id", commentId);
                if (!isAdmin) cmd.Parameters.AddWithValue("@uid", requestingUserId);
                await cmd.ExecuteNonQueryAsync();

                // 2. XÃƒÂ³a bÃƒÂ¬nh luÃ¡ÂºÂ­n
                cmd.CommandText = isAdmin
                    ? "DELETE FROM Comments WHERE Id = @id"
                    : "DELETE FROM Comments WHERE Id = @id AND UserId = @uid";
                await cmd.ExecuteNonQueryAsync();

                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public async Task<List<CommentReaction>> GetReactionsForCommentAsync(int commentId)
        {
            var list = new List<CommentReaction>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var cmd = new SqliteCommand("SELECT * FROM CommentReactions WHERE CommentId=@id", connection);
            cmd.Parameters.AddWithValue("@id", commentId);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new CommentReaction
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    CommentId = Convert.ToInt32(reader["CommentId"]),
                    UserId = Convert.ToInt32(reader["UserId"]),
                    Username = reader["Username"].ToString() ?? "",
                    ReactionType = reader["ReactionType"].ToString() ?? "",
                    CreatedAt = DateTime.Parse(reader["CreatedAt"].ToString() ?? DateTime.UtcNow.AddHours(7).ToString())
                });
            }
            return list;
        }

        /// <summary>Toggle a reaction: if same type exists remove it, else upsert to new type.</summary>
        public async Task<string> ToggleReactionAsync(int commentId, int userId, string username, string reactionType)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            // Check existing
            using var checkCmd = new SqliteCommand("SELECT ReactionType FROM CommentReactions WHERE CommentId=@cid AND UserId=@uid", connection);
            checkCmd.Parameters.AddWithValue("@cid", commentId);
            checkCmd.Parameters.AddWithValue("@uid", userId);
            var existing = checkCmd.ExecuteScalar()?.ToString();

            if (existing == reactionType)
            {
                // Remove reaction (toggle off)
                using var delCmd = new SqliteCommand("DELETE FROM CommentReactions WHERE CommentId=@cid AND UserId=@uid", connection);
                delCmd.Parameters.AddWithValue("@cid", commentId);
                delCmd.Parameters.AddWithValue("@uid", userId);
                await delCmd.ExecuteNonQueryAsync();
                return "removed";
            }
            else
            {
                // Upsert to new reaction type
                using var upsertCmd = new SqliteCommand(@"
                    INSERT INTO CommentReactions (CommentId, UserId, Username, ReactionType, CreatedAt)
                    VALUES (@cid, @uid, @uname, @type, @now)
                    ON CONFLICT(CommentId, UserId) DO UPDATE SET ReactionType=@type, CreatedAt=@now", connection);
                upsertCmd.Parameters.AddWithValue("@now", DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd HH:mm:ss"));
                upsertCmd.Parameters.AddWithValue("@cid", commentId);
                upsertCmd.Parameters.AddWithValue("@uid", userId);
                upsertCmd.Parameters.AddWithValue("@uname", username);
                upsertCmd.Parameters.AddWithValue("@type", reactionType);
                await upsertCmd.ExecuteNonQueryAsync();
                return reactionType;
            }
        }
        public async Task<byte[]> ExportDocumentsToCsvAsync()
        {
            var sb = new System.Text.StringBuilder();
            sb.Append('\uFEFF');
            sb.AppendLine("ID,Sá»‘ VÄƒn Báº£n,TÃªn CÃ´ng VÄƒn,TrÃ­ch Yáº¿u,NgÃ y Ban HÃ nh,CÆ¡ Quan Ban HÃ nh,Thá»i Háº¡n,Tráº¡ng ThÃ¡i,Äá»™ Kháº©n,NgÃ y ThÃªm");

            var docs = await GetAllAsync();
            foreach (var d in docs)
            {
                var line = $"{d.Id}," +
                           $"\"{EscapeCsv(d.SoVanBan)}\"," +
                           $"\"{EscapeCsv(d.TenCongVan)}\"," +
                           $"\"{EscapeCsv(d.TrichYeu)}\"," +
                           $"\"{d.NgayBanHanh?.ToString("dd/MM/yyyy")}\"," +
                           $"\"{EscapeCsv(d.CoQuanBanHanh)}\"," +
                           $"\"{d.ThoiHan?.ToString("dd/MM/yyyy")}\"," +
                           $"\"{EscapeCsv(d.Status)}\"," +
                           $"\"{EscapeCsv(d.Priority)}\"," +
                           $"\"{d.NgayThem.ToString("dd/MM/yyyy")}\"";
                sb.AppendLine(line);
            }
            return System.Text.Encoding.UTF8.GetBytes(sb.ToString());
        }

        private string EscapeCsv(string? s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            if (s.Contains(",") || s.Contains("\"") || s.Contains("\n") || s.Contains("\r"))
                return "\"" + s.Replace("\"", "\"\"") + "\"";
            return s;
        }

        public async Task<List<DocumentRecord>> GetAllAsync()
        {
            var records = new List<DocumentRecord>();
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = "SELECT * FROM Documents ORDER BY ThoiHan ASC NULLS LAST";
            using var cmd = new SqliteCommand(sql, connection);
            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
                records.Add(MapRecord(reader));

            return records;
        }

        public async Task<DocumentRecord?> GetDocumentByIdAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = "SELECT * FROM Documents WHERE Id = @id";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@id", id);
            using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
                return MapRecord(reader);

            return null;
        }

        /// <summary>
        /// Server-side pagination: returns one page of documents + total count for pagination UI.
        /// <para>search is matched against SoVanBan, TrichYeu, CoQuanChuQuan (case-insensitive LIKE).</para>
        /// </summary>
        public async Task<(List<DocumentRecord> Items, int TotalCount)> GetPagedAsync(int page, int pageSize, string search = "", string status = "", string sort = "deadline_asc")
        {
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 10;

            var filters = new List<string>();
            bool hasSearch = !string.IsNullOrWhiteSpace(search);
            bool hasStatus = !string.IsNullOrWhiteSpace(status);

            if (hasSearch)
            {
                filters.Add(@"(
                    LOWER(SoVanBan)      LIKE @search OR
                    LOWER(TrichYeu)      LIKE @search OR
                    LOWER(CoQuanChuQuan) LIKE @search
                )");
            }

            if (hasStatus)
            {
                var s = status.Replace("📦 ", "").Replace("⭐ ", "").Replace("🔥 ", "").Replace("✅ ", "").Replace("⚠️ ", "").Replace("⛔ ", "").ToLower();
                if (s == "overdue")
                {
                    // Công thức chuẩn từ Dashboard Overdue
                    filters.Add("ThoiHan < date('now') AND Status != 'Đã hoàn thành' AND ThoiHan IS NOT NULL");
                }
                else if (s == "urgent")
                {
                    // Công thức chuẩn từ Dashboard Sắp hết hạn (7 ngày tới)
                    filters.Add("ThoiHan >= date('now') AND ThoiHan <= date('now', '+7 days') AND Status != 'Đã hoàn thành'");
                }
                else if (s == "today")
                {
                    // Công thức chuẩn từ Dashboard Đến hạn hôm nay
                    filters.Add("date(ThoiHan) = date('now') AND Status != 'Đã hoàn thành'");
                }
                else
                {
                    filters.Add("(LOWER(Status) = @status OR LOWER(Status) = @statusClean)");
                }
            }

            string searchFilter = filters.Count > 0 ? "WHERE " + string.Join(" AND ", filters) : "";

            string orderBy = sort switch
            {
                "newest" => "NgayThem DESC",
                "oldest" => "NgayThem ASC",
                "deadline_desc" => "ThoiHan DESC NULLS LAST",
                _ => "ThoiHan ASC NULLS LAST"
            };

            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            // 1. Total count
            string countSql = $"SELECT COUNT(*) FROM Documents {searchFilter}";
            using var countCmd = new SqliteCommand(countSql, connection);
            if (hasSearch) countCmd.Parameters.AddWithValue("@search", $"%{search.ToLower()}%");
            if (hasStatus && status.ToLower() != "overdue")
            {
                countCmd.Parameters.AddWithValue("@status", status.ToLower());
                countCmd.Parameters.AddWithValue("@statusClean", status.Replace("📦 ", "").Replace("⭐ ", "").Replace("🔥 ", "").Replace("✅ ", "").Replace("⚠️ ", "").Replace("⛔ ", "").ToLower());
            }

            int totalCount = Convert.ToInt32(countCmd.ExecuteScalar());

            // 2. Paged data
            int offset = (page - 1) * pageSize;
            string dataSql = $@"
                SELECT * FROM Documents
                {searchFilter}
                ORDER BY {orderBy}
                LIMIT @pageSize OFFSET @offset";

            using var dataCmd = new SqliteCommand(dataSql, connection);
            if (hasSearch) dataCmd.Parameters.AddWithValue("@search", $"%{search.ToLower()}%");
            if (hasStatus && status.ToLower() != "overdue")
            {
                dataCmd.Parameters.AddWithValue("@status", status.ToLower());
                dataCmd.Parameters.AddWithValue("@statusClean", status.Replace("📦 ", "").Replace("⭐ ", "").Replace("🔥 ", "").Replace("✅ ", "").Replace("⚠️ ", "").Replace("⛔ ", "").ToLower());
            }

            dataCmd.Parameters.AddWithValue("@pageSize", pageSize);
            dataCmd.Parameters.AddWithValue("@offset", offset);

            using var reader = await dataCmd.ExecuteReaderAsync();
            var items = new List<DocumentRecord>();
            while (await reader.ReadAsync())
                items.Add(MapRecord(reader));

            return (items, totalCount);
        }

        public async Task<List<string>> GetUniqueStatusesAsync()
        {
            var list = new List<string>();
            try
            {
                using var connection = new SqliteConnection(_connectionString);
                await connection.OpenAsync();
                string sql = "SELECT DISTINCT Status FROM Documents WHERE Status IS NOT NULL AND Status != ''";
                using var cmd = new SqliteCommand(sql, connection);
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(reader.GetString(0));
                }
            }
            catch { }
            return list;
        }

        public async Task<int> InsertAsync(DocumentRecord record)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var transaction = connection.BeginTransaction();
            try
            {
                string sql = @"
                    INSERT INTO Documents (SoVanBan, TenCongVan, TrichYeu, FullText, OcrPagesJson, NgayBanHanh, CoQuanBanHanh, CoQuanChuQuan, ThoiHan, DonViChiDao, FilePath, Status, Priority, DepartmentId, AssignedTo, AssignedUserIds, AssignedDepartmentIds, EvidencePaths, EvidenceNotes, CompletionDate, LabelId, NgayThem, DaTaoLich)
                    VALUES (@SoVanBan, @TenCongVan, @TrichYeu, @FullText, @OcrPagesJson, @NgayBanHanh, @CoQuanBanHanh, @CoQuanChuQuan, @ThoiHan, @DonViChiDao, @FilePath, @Status, @Priority, @DepartmentId, @AssignedTo, @AssignedUserIds, @AssignedDepartmentIds, @EvidencePaths, @EvidenceNotes, @CompletionDate, @LabelId, @NgayThem, @DaTaoLich);
                    SELECT last_insert_rowid();";

                using var cmd = new SqliteCommand(sql, connection, transaction);
                AddParams(cmd, record);
                int id = Convert.ToInt32(cmd.ExecuteScalar());
                transaction.Commit();
                return id;
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public async Task UpdateAsync(DocumentRecord record)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            string sql = @"
                UPDATE Documents SET
                    SoVanBan=@SoVanBan, TenCongVan=@TenCongVan, TrichYeu=@TrichYeu, FullText=@FullText, OcrPagesJson=@OcrPagesJson,
                    NgayBanHanh=@NgayBanHanh, CoQuanBanHanh=@CoQuanBanHanh, CoQuanChuQuan=@CoQuanChuQuan,
                    ThoiHan=@ThoiHan, DonViChiDao=@DonViChiDao, FilePath=@FilePath, 
                    Status=@Status, Priority=@Priority, DepartmentId=@DepartmentId, 
                    AssignedTo=@AssignedTo, AssignedUserIds=@AssignedUserIds, AssignedDepartmentIds=@AssignedDepartmentIds,
                    EvidencePaths=@EvidencePaths, EvidenceNotes=@EvidenceNotes, 
                    CompletionDate=@CompletionDate, LabelId=@LabelId, DaTaoLich=@DaTaoLich
                WHERE Id=@Id";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@Id", record.Id);
            AddParams(cmd, record);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task AssignDocumentAsync(int docId, string departmentIds, string userIds)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            int? firstDeptId = null;
            try
            {
                var depts = System.Text.Json.JsonSerializer.Deserialize<List<int>>(departmentIds);
                if (depts != null && depts.Count > 0) firstDeptId = depts[0];
            }
            catch { }

            int? firstUserId = null;
            try
            {
                var users = System.Text.Json.JsonSerializer.Deserialize<List<int>>(userIds);
                if (users != null && users.Count > 0) firstUserId = users[0];
            }
            catch { }

            string sql = "UPDATE Documents SET AssignedDepartmentIds=@deptIds, AssignedUserIds=@uIds, DepartmentId=@dId, AssignedTo=@uId, Status='Chưa xử lý' WHERE Id=@docId";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@deptIds", (object?)departmentIds ?? "[]");
            cmd.Parameters.AddWithValue("@uIds", (object?)userIds ?? "[]");
            cmd.Parameters.AddWithValue("@dId", (object?)firstDeptId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@uId", (object?)firstUserId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@docId", docId);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task SubmitEvidenceAsync(int docId, string evidenceJson, string notes)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            string sql = @"
                UPDATE Documents SET 
                    EvidencePaths=@paths, 
                    EvidenceNotes=@notes, 
                    Status='Đã hoàn thành', 
                    CompletionDate=datetime('now', 'localtime') 
                WHERE Id=@docId";
            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@paths", evidenceJson);
            cmd.Parameters.AddWithValue("@notes", notes);
            cmd.Parameters.AddWithValue("@docId", docId);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task DeleteAsync(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            using var transaction = connection.BeginTransaction();

            try
            {
                using var cmd = connection.CreateCommand();
                cmd.Transaction = transaction;

                // 1. Xóa cảm xúc của các bình luận thuộc văn bản này
                cmd.CommandText = "DELETE FROM CommentReactions WHERE CommentId IN (SELECT Id FROM Comments WHERE DocumentId=@Id)";
                cmd.Parameters.AddWithValue("@Id", id);
                await cmd.ExecuteNonQueryAsync();

                // 2. Xóa các bình luận của văn bản này
                cmd.CommandText = "DELETE FROM Comments WHERE DocumentId=@Id";
                await cmd.ExecuteNonQueryAsync();

                // 3. Xóa chính văn bản đó
                cmd.CommandText = "DELETE FROM Documents WHERE Id=@Id";
                await cmd.ExecuteNonQueryAsync();

                transaction.Commit(); // Mọi thứ ổn, chốt dữ liệu
            }
            catch (Exception)
            {
                transaction.Rollback(); // Có lỗi, khôi phục lại như cũ
                throw;
            }
        }

        public async Task BulkUpdateStatusAsync(List<int> ids, string status)
        {
            if (ids == null || ids.Count == 0) return;
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();

            // Note: Since we are using SQLite and small batches, we can use IN clause with string join
            // For production with massive IDs, we might use a temporary table or multiple commands
            string idList = string.Join(",", ids);
            string sql = $"UPDATE Documents SET Status=@s WHERE Id IN ({idList})";

            using var cmd = new SqliteCommand(sql, connection);
            cmd.Parameters.AddWithValue("@s", status);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task BulkDeleteAsync(List<int> ids)
        {
            if (ids == null || ids.Count == 0) return;
            using var connection = new SqliteConnection(_connectionString);
            await connection.OpenAsync();
            string idList = string.Join(",", ids);
            string sql = $@"
                DELETE FROM CommentReactions WHERE CommentId IN (SELECT Id FROM Comments WHERE DocumentId IN ({idList}));
                DELETE FROM Comments WHERE DocumentId IN ({idList});
                DELETE FROM Documents WHERE Id IN ({idList});
            ";
            using var cmd = new SqliteCommand(sql, connection);
            await cmd.ExecuteNonQueryAsync();
        }

        private DocumentRecord MapRecord(SqliteDataReader r)
        {
            return new DocumentRecord
            {
                Id = Convert.ToInt32(r["Id"]),
                SoVanBan = r["SoVanBan"]?.ToString() ?? "",
                TenCongVan = r["TenCongVan"]?.ToString() ?? "",
                TrichYeu = r["TrichYeu"]?.ToString() ?? "",
                FullText = r["FullText"]?.ToString() ?? "",
                OcrPagesJson = r["OcrPagesJson"]?.ToString() ?? "[]",
                NgayBanHanh = TryParseDate(r["NgayBanHanh"]?.ToString()),
                CoQuanBanHanh = r["CoQuanBanHanh"]?.ToString() ?? "",
                CoQuanChuQuan = r["CoQuanChuQuan"]?.ToString() ?? "",
                ThoiHan = TryParseDate(r["ThoiHan"]?.ToString()),
                DonViChiDao = r["DonViChiDao"]?.ToString() ?? "",
                FilePath = r["FilePath"]?.ToString() ?? "",
                Status = CleanMangledString(r["Status"]?.ToString() ?? "Chưa xử lý"),
                Priority = CleanMangledString(r["Priority"]?.ToString() ?? "Thường"),
                DepartmentId = r["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(r["DepartmentId"]),
                AssignedTo = r["AssignedTo"] == DBNull.Value ? null : Convert.ToInt32(r["AssignedTo"]),
                AssignedUserIds = r["AssignedUserIds"]?.ToString() ?? "[]",
                AssignedDepartmentIds = r["AssignedDepartmentIds"]?.ToString() ?? "[]",
                EvidencePaths = r["EvidencePaths"]?.ToString() ?? "[]",
                EvidenceNotes = r["EvidenceNotes"]?.ToString() ?? "",
                CompletionDate = TryParseDate(r["CompletionDate"]?.ToString()),
                LabelId = r["LabelId"] == DBNull.Value ? null : Convert.ToInt32(r["LabelId"]),
                NgayThem = DateTime.Parse(r["NgayThem"]?.ToString() ?? DateTime.UtcNow.AddHours(7).ToString()),
                DaTaoLich = r["DaTaoLich"] != DBNull.Value && Convert.ToInt32(r["DaTaoLich"]) > 0
            };
        }

        private void AddParams(SqliteCommand cmd, DocumentRecord r)
        {
            cmd.Parameters.AddWithValue("@SoVanBan", (object?)r.SoVanBan ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@TenCongVan", (object?)r.TenCongVan ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@TrichYeu", (object?)r.TrichYeu ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@FullText", (object?)r.FullText ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@OcrPagesJson", string.IsNullOrWhiteSpace(r.OcrPagesJson) ? "[]" : r.OcrPagesJson);
            cmd.Parameters.AddWithValue("@NgayBanHanh", r.NgayBanHanh.HasValue ? (object)r.NgayBanHanh.Value.ToString("yyyy-MM-dd") : DBNull.Value);
            cmd.Parameters.AddWithValue("@CoQuanBanHanh", (object?)r.CoQuanBanHanh ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@CoQuanChuQuan", (object?)r.CoQuanChuQuan ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ThoiHan", r.ThoiHan.HasValue ? (object)r.ThoiHan.Value.ToString("yyyy-MM-dd") : DBNull.Value);
            cmd.Parameters.AddWithValue("@DonViChiDao", (object?)r.DonViChiDao ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@FilePath", (object?)r.FilePath ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Status", (object?)r.Status ?? "Chưa xử lý");
            cmd.Parameters.AddWithValue("@Priority", (object?)r.Priority ?? "Thường");
            cmd.Parameters.AddWithValue("@DepartmentId", (object?)r.DepartmentId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@AssignedTo", (object?)r.AssignedTo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@AssignedUserIds", (object?)r.AssignedUserIds ?? "[]");
            cmd.Parameters.AddWithValue("@AssignedDepartmentIds", (object?)r.AssignedDepartmentIds ?? "[]");
            cmd.Parameters.AddWithValue("@EvidencePaths", (object?)r.EvidencePaths ?? "[]");
            cmd.Parameters.AddWithValue("@EvidenceNotes", (object?)r.EvidenceNotes ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@CompletionDate", r.CompletionDate.HasValue ? (object)r.CompletionDate.Value.ToString("yyyy-MM-dd") : DBNull.Value);
            cmd.Parameters.AddWithValue("@LabelId", (object?)r.LabelId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@NgayThem", r.NgayThem.ToString("yyyy-MM-dd HH:mm:ss"));
            cmd.Parameters.AddWithValue("@DaTaoLich", r.DaTaoLich ? 1 : 0);
        }

        private DateTime? TryParseDate(string? value)
        {
            if (string.IsNullOrEmpty(value)) return null;
            if (DateTime.TryParse(value, out DateTime dt)) return dt;
            return null;
        }

        private string CleanMangledString(string value)
        {
            if (string.IsNullOrEmpty(value)) return value;
            
            // Map common mangled patterns back to correct Vietnamese
            if (value.Contains("hoÃ") || value.Contains("ho\u00c3")) return "Đã hoàn thành";
            if (value.Contains("ChÆ") || value.Contains("Ch\u00c6")) return "Chưa xử lý";
            if (value.Contains("ThÆ") || value.Contains("Th\u00c6")) return "Thường";
            if (value.Contains("Kháº") || value.Contains("Kh\u1ea7")) return "Khẩn";
            if (value.Contains("Há»") || value.Contains("H\u1ecf")) return "Hỏa tốc";
            
            return value;
        }

    }
}



