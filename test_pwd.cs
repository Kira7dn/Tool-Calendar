using System;
using System.Text.Json;
public class UserUpdateRequest {
    public string? PasswordHash { get; set; }
}
public class Program {
    public static void Main() {
        string json = "{\"fullName\":\"Pham Ngoc Hop\",\"email\":\"\",\"phoneNumber\":\"\",\"role\":\"CanBo\",\"departmentId\":null,\"passwordHash\":\"123456aA@4\"}";
        var req = JsonSerializer.Deserialize<UserUpdateRequest>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Console.WriteLine("PasswordHash: " + req.PasswordHash);
    }
}
