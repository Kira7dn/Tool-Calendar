using ToolCalender.Data;

namespace ToolCalender.Services
{
    /// <summary>
    /// Service chạy nền: kiểm tra văn bản sắp hết hạn và hiện thông báo balloon.
    /// </summary>
    public class NotificationService : IDisposable
    {
        private System.Threading.Timer? _timer;
        private NotifyIcon? _notifyIcon;
        private readonly HashSet<string> _notifiedToday = new();

        public void Initialize(NotifyIcon notifyIcon)
        {
            _notifyIcon = notifyIcon;

            // Kiểm tra ngay khi khởi động
            Task.Run(CheckDeadlines);

            // Lặp lại mỗi 4 giờ
            _timer = new System.Threading.Timer(
                _ => Task.Run(CheckDeadlines),
                null,
                TimeSpan.FromHours(4),
                TimeSpan.FromHours(4)
            );
        }

        private void CheckDeadlines()
        {
            try
            {
                var records = DatabaseService.GetAll();
                int[] alertDays = { 7, 3, 1, 0 };

                foreach (var record in records)
                {
                    if (record.ThoiHan == null) continue;
                    int daysLeft = record.SoNgayConLai;

                    // Tránh thông báo trùng trong cùng một ngày
                    string key = $"{record.Id}_{daysLeft}_{DateTime.Today:yyyyMMdd}";
                    if (_notifiedToday.Contains(key)) continue;

                    if (alertDays.Contains(daysLeft))
                    {
                        _notifiedToday.Add(key);

                        string title, message;
                        if (daysLeft < 0)
                            continue; // Đừng nhắc văn bản đã quá hạn nhiều ngày

                        if (daysLeft == 0)
                        {
                            title = "🚨 VĂN BẢN HẾT HẠN HÔM NAY!";
                            message = $"Số VB: {record.SoVanBan}\n" +
                                     $"Đơn vị: {record.DonViChiDao}\n" +
                                     $"Thời hạn: {record.ThoiHan.Value:dd/MM/yyyy}";
                        }
                        else
                        {
                            title = $"⚠ Nhắc nhở: Còn {daysLeft} ngày";
                            message = $"Số VB: {record.SoVanBan}\n" +
                                     $"Đơn vị: {record.DonViChiDao}\n" +
                                     $"Hết hạn: {record.ThoiHan.Value:dd/MM/yyyy}";
                        }

                        ShowBalloon(title, message,
                            daysLeft == 0 ? ToolTipIcon.Error : ToolTipIcon.Warning);
                    }
                }
            }
            catch { /* Bỏ qua lỗi trong background */ }
        }

        private void ShowBalloon(string title, string message, ToolTipIcon icon)
        {
            if (_notifyIcon == null) return;

            // NotifyIcon is not a Control, marshal via the main form
            var mainForm = Application.OpenForms.Count > 0 ? Application.OpenForms[0] : null;
            Action show = () =>
            {
                System.Media.SystemSounds.Asterisk.Play();
                _notifyIcon.BalloonTipTitle = title;
                _notifyIcon.BalloonTipText = message;
                _notifyIcon.BalloonTipIcon = icon;
                _notifyIcon.ShowBalloonTip(8000);
            };

            if (mainForm != null && mainForm.IsHandleCreated)
                mainForm.BeginInvoke(show);
            else
                show();
        }

        public void Dispose() => _timer?.Dispose();
    }
}
