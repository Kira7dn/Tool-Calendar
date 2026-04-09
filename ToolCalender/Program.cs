using ToolCalender.Data;

namespace ToolCalender
{
    internal static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.SetHighDpiMode(HighDpiMode.SystemAware);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // Khởi tạo database SQLite (tạo file nếu chưa có)
            DatabaseService.Initialize();

            Application.Run(new Form1());
        }
    }
}