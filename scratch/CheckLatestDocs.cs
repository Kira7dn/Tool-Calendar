using System;
using System.IO;
using Microsoft.Data.Sqlite;

class Program
{
    static void Main()
    {
        string dbPath = @"c:\Users\User\Documents\Tool-Calendar\data_dump\documents.db";
        if (!File.Exists(dbPath))
        {
            Console.WriteLine("Database file not found at: " + dbPath);
            return;
        }

        string connectionString = $"Data Source={dbPath};";
        using (var connection = new SqliteConnection(connectionString))
        {
            connection.Open();
            string query = "SELECT Id, TenCongVan, NgayThem, FilePath, ContentHash FROM Documents ORDER BY Id DESC LIMIT 3;";
            using (var command = new SqliteCommand(query, connection))
            {
                using (var reader = command.ExecuteReader())
                {
                    Console.WriteLine("=== LATEST UPLOADED DOCUMENTS ===");
                    while (reader.Read())
                    {
                        Console.WriteLine($"ID: {reader["Id"]}");
                        Console.WriteLine($"Tên Công Văn: {reader["TenCongVan"]}");
                        Console.WriteLine($"Ngày Thêm: {reader["NgayThem"]}");
                        Console.WriteLine($"Đường dẫn file: {reader["FilePath"]}");
                        Console.WriteLine($"ContentHash: {reader["ContentHash"]}");
                        Console.WriteLine("---------------------------------");
                    }
                }
            }
        }
    }
}
