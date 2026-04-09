using System.Text;
using System.Text.RegularExpressions;
using ToolCalender.Models;

namespace ToolCalender.Services
{
    public static class CalendarService
    {
        /// <summary>
        /// Tạo file ICS và mở để import vào Windows Calendar.
        /// Tạo 4 sự kiện: ngày hết hạn + nhắc 7/3/1 ngày trước.
        /// </summary>
        public static void CreateCalendarEvents(DocumentRecord record)
        {
            if (record.ThoiHan == null)
                throw new InvalidOperationException("Văn bản không có thời hạn. Vui lòng nhập thời hạn trước.");

            string soVb = record.SoVanBan ?? "Văn bản";
            string desc = BuildDescription(record);

            var events = new StringBuilder();
            events.Append(BuildEvent(
                $"⚠ HẾT HẠN: {soVb}",
                desc, record.ThoiHan.Value));

            if (record.ThoiHan.Value > DateTime.Today.AddDays(7))
                events.Append(BuildEvent($"[Nhắc 7 ngày] {soVb}", desc, record.ThoiHan.Value.AddDays(-7)));

            if (record.ThoiHan.Value > DateTime.Today.AddDays(3))
                events.Append(BuildEvent($"[Nhắc 3 ngày] {soVb}", desc, record.ThoiHan.Value.AddDays(-3)));

            if (record.ThoiHan.Value > DateTime.Today.AddDays(1))
                events.Append(BuildEvent($"[Nhắc 1 ngày] {soVb}", desc, record.ThoiHan.Value.AddDays(-1)));

            string icsContent =
                "BEGIN:VCALENDAR\r\n" +
                "VERSION:2.0\r\n" +
                "PRODID:-//ToolCalender//VanBan//VN\r\n" +
                "CALSCALE:GREGORIAN\r\n" +
                "METHOD:PUBLISH\r\n" +
                events.ToString() +
                "END:VCALENDAR\r\n";

            // Lưu vào thư mục tạm và mở bằng ứng dụng mặc định (Windows Calendar)
            string safeName = Regex.Replace(soVb, @"[\\/:*?""<>|]", "_");
            string tempFile = Path.Combine(Path.GetTempPath(), $"VanBan_{safeName}.ics");
            File.WriteAllText(tempFile, icsContent, System.Text.Encoding.UTF8);

            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = tempFile,
                UseShellExecute = true
            });
        }

        private static string BuildEvent(string summary, string description, DateTime date)
        {
            string uid = Guid.NewGuid().ToString("N").ToUpper();
            string dtStamp = DateTime.UtcNow.ToString("yyyyMMddTHHmmssZ");
            string dtStart = date.ToString("yyyyMMdd");
            string dtEnd = date.AddDays(1).ToString("yyyyMMdd");

            return "BEGIN:VEVENT\r\n" +
                   $"UID:{uid}@toolcalender\r\n" +
                   $"DTSTAMP:{dtStamp}\r\n" +
                   $"DTSTART;VALUE=DATE:{dtStart}\r\n" +
                   $"DTEND;VALUE=DATE:{dtEnd}\r\n" +
                   $"SUMMARY:{Escape(summary)}\r\n" +
                   $"DESCRIPTION:{Escape(description)}\r\n" +
                   "BEGIN:VALARM\r\n" +
                   "TRIGGER:-PT0S\r\n" +
                   "ACTION:DISPLAY\r\n" +
                   $"DESCRIPTION:{Escape(summary)}\r\n" +
                   "END:VALARM\r\n" +
                   "END:VEVENT\r\n";
        }

        private static string BuildDescription(DocumentRecord r)
        {
            var parts = new List<string>
            {
                $"Số văn bản: {r.SoVanBan}",
                $"Trích yếu: {r.TrichYeu}",
                $"Ngày ban hành: {r.NgayBanHanh:dd/MM/yyyy}",
                $"Cơ quan ban hành: {r.CoQuanBanHanh}",
                $"Cơ quan tham mưu: {r.CoQuanChuQuan}",
                $"Thời hạn: {r.ThoiHan:dd/MM/yyyy}",
                $"Đơn vị chỉ đạo: {r.DonViChiDao}"
            };
            return string.Join("\\n", parts.Where(p => !p.EndsWith(": ")));
        }

        private static string Escape(string value) =>
            value.Replace("\\", "\\\\").Replace(";", "\\;")
                 .Replace(",", "\\,").Replace("\n", "\\n");
    }
}
