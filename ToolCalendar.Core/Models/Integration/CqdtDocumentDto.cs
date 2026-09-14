namespace ToolCalendar.Core.Models.Integration;

public class CqdtLoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public int Limit { get; set; } = 25;
}

public class CqdtDocumentDto
{
    public string SoKyHieu { get; set; } = string.Empty;
    public string CoQuanBanHanh { get; set; } = string.Empty;
    public string TrichYeu { get; set; } = string.Empty;
    public string NgayVanBan { get; set; } = string.Empty;
    public string LoaiVanBan { get; set; } = string.Empty;
    public string CQDTTenTep { get; set; } = string.Empty;
    public string FileBase64 { get; set; } = string.Empty; // Base64 của file PDF
}
