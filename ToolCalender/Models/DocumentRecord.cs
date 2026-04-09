namespace ToolCalender.Models
{
    public class DocumentRecord
    {
        public int Id { get; set; }
        public string SoVanBan { get; set; } = "";
        public string TrichYeu { get; set; } = "";
        public DateTime? NgayBanHanh { get; set; }
        public string CoQuanBanHanh { get; set; } = "";
        public string CoQuanChuQuan { get; set; } = "";  // Cơ quan chủ quản tham mưu
        public DateTime? ThoiHan { get; set; }
        public string DonViChiDao { get; set; } = "";    // Đơn vị/phòng bị chỉ đạo
        public string FilePath { get; set; } = "";
        public DateTime NgayThem { get; set; } = DateTime.Now;
        public bool DaTaoLich { get; set; } = false;

        public int SoNgayConLai
        {
            get
            {
                if (ThoiHan == null) return int.MaxValue;
                return (int)(ThoiHan.Value.Date - DateTime.Today).TotalDays;
            }
        }

        public string TrangThai
        {
            get
            {
                if (ThoiHan == null) return "Chưa xác định";
                int days = SoNgayConLai;
                if (days < 0) return $"Quá hạn {Math.Abs(days)} ngày";
                if (days == 0) return "Hết hạn hôm nay!";
                if (days == 1) return "Còn 1 ngày";
                if (days <= 3) return $"Còn {days} ngày";
                if (days <= 7) return $"Còn {days} ngày";
                return $"Còn {days} ngày";
            }
        }
    }
}
