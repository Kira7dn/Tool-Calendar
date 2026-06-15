import re

with open('ToolCalendar.Core/Data/DatabaseService.cs', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. CREATE TABLE Departments
content = re.sub(
    r'CREATE TABLE IF NOT EXISTS Departments \(\s*Id INTEGER PRIMARY KEY AUTOINCREMENT,\s*Name TEXT,\s*Description TEXT\s*\)\";',
    'CREATE TABLE IF NOT EXISTS Departments (\n                    Id INTEGER PRIMARY KEY AUTOINCREMENT,\n                    Name TEXT,\n                    Description TEXT,\n                    IsActive INTEGER DEFAULT 1\n                )\";',
    content
)

# 2. Migrations
migration_block = '''try { cmd.CommandText = "ALTER TABLE Documents ADD COLUMN AssignedDepartmentIds TEXT DEFAULT '[]'"; cmd.ExecuteNonQuery(); } catch { }

            try { cmd.CommandText = "ALTER TABLE Departments ADD COLUMN IsActive INTEGER DEFAULT 1"; cmd.ExecuteNonQuery(); } catch { }

            // Migration cho phòng ban mới
            try { 
                cmd.CommandText = "INSERT INTO Departments (Name, Description, IsActive) SELECT 'Phòng Kinh tế', 'Phòng ban Phòng Kinh tế', 1 WHERE NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Phòng Kinh tế')"; 
                cmd.ExecuteNonQuery(); 
                cmd.CommandText = "INSERT INTO Departments (Name, Description, IsActive) SELECT 'Phòng Xây dựng, Nông nghiệp và môi trường', 'Phòng ban Phòng Xây dựng, Nông nghiệp và môi trường', 1 WHERE NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Phòng Xây dựng, Nông nghiệp và môi trường')"; 
                cmd.ExecuteNonQuery(); 
                cmd.CommandText = "UPDATE Departments SET IsActive = 0 WHERE Name = 'Phòng Kinh tế hạ tầng và đô thị'"; 
                cmd.ExecuteNonQuery(); 
            } catch { }'''
content = re.sub(
    r'try \{ cmd\.CommandText = \"ALTER TABLE Documents ADD COLUMN AssignedDepartmentIds TEXT DEFAULT \'\[\]\'\"; cmd\.ExecuteNonQuery\(\); \} catch \{ \}',
    migration_block,
    content
)

# 3. GetDepartments
get_dept_new = '''public static List<Department> GetDepartments(bool includeInactive = false)
        {
            var list = new List<Department>();
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            string sql = includeInactive ? "SELECT Id, Name, Description, IsActive FROM Departments" : "SELECT Id, Name, Description, IsActive FROM Departments WHERE IsActive = 1";
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
        }'''
content = re.sub(
    r'public static List<Department> GetDepartments\(\)\s*\{[\s\S]*?return list;\s*\}',
    get_dept_new,
    content
)

# 4. InsertDepartment
insert_dept_new = '''public static int InsertDepartment(Department d)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("INSERT INTO Departments (Name, Description, IsActive) VALUES (@n, @d, @ia); SELECT last_insert_rowid();", connection);
            cmd.Parameters.AddWithValue("@n", d.Name);
            cmd.Parameters.AddWithValue("@d", d.Description);
            cmd.Parameters.AddWithValue("@ia", d.IsActive ? 1 : 0);
            return Convert.ToInt32(cmd.ExecuteScalar());
        }'''
content = re.sub(
    r'public static int InsertDepartment\(Department d\)\s*\{[\s\S]*?return Convert\.ToInt32\(cmd\.ExecuteScalar\(\)\);\s*\}',
    insert_dept_new,
    content
)

# 5. UpdateDepartment
update_dept_new = '''public static void UpdateDepartment(Department d)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("UPDATE Departments SET Name = @n, Description = @d, IsActive = @ia WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@n", d.Name);
            cmd.Parameters.AddWithValue("@d", d.Description);
            cmd.Parameters.AddWithValue("@ia", d.IsActive ? 1 : 0);
            cmd.Parameters.AddWithValue("@id", d.Id);
            cmd.ExecuteNonQuery();
        }'''
content = re.sub(
    r'public static void UpdateDepartment\(Department d\)\s*\{[\s\S]*?cmd\.ExecuteNonQuery\(\);\s*\}',
    update_dept_new,
    content
)

# 6. DeleteDepartment
delete_dept_new = '''public static void DeleteDepartment(int id)
        {
            using var connection = new SqliteConnection(_connectionString);
            connection.Open();
            using var cmd = new SqliteCommand("UPDATE Departments SET IsActive = 0 WHERE Id = @id", connection);
            cmd.Parameters.AddWithValue("@id", id);
            cmd.ExecuteNonQuery();
        }'''
content = re.sub(
    r'public static void DeleteDepartment\(int id\)\s*\{[\s\S]*?catch\s*\{\s*transaction\.Rollback\(\);\s*throw;\s*\}\s*\}',
    delete_dept_new,
    content
)

# 7. GetAutoRules
content = re.sub(
    r'using var cmd = new SqliteCommand\("SELECT Id, Keyword, LabelId, DepartmentId, DefaultDeadlineDays FROM AutoRules", connection\);',
    'using var cmd = new SqliteCommand("SELECT r.Id, r.Keyword, r.LabelId, r.DepartmentId, r.DefaultDeadlineDays, d.Name as DepartmentName FROM AutoRules r LEFT JOIN Departments d ON r.DepartmentId = d.Id", connection);',
    content
)
auto_rule_mapping_old = '''DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),'''
auto_rule_mapping_new = '''DepartmentId = reader["DepartmentId"] == DBNull.Value ? null : Convert.ToInt32(reader["DepartmentId"]),
                    DepartmentName = reader.HasColumn("DepartmentName") && reader["DepartmentName"] != DBNull.Value ? reader["DepartmentName"].ToString() : null,'''
content = content.replace(auto_rule_mapping_old, auto_rule_mapping_new)

# 8. GetMonthlyDepartmentReport
report_old = '''FROM Departments d
                LEFT JOIN Documents doc ON d.Id = doc.DepartmentId AND doc.NgayThem LIKE @prefix
                GROUP BY d.Id, d.Name'''
report_new = '''FROM Departments d
                LEFT JOIN Documents doc ON d.Id = doc.DepartmentId AND doc.NgayThem LIKE @prefix
                WHERE d.IsActive = 1
                GROUP BY d.Id, d.Name'''
content = content.replace(report_old, report_new)

with open('ToolCalendar.Core/Data/DatabaseService.cs', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated successfully')
