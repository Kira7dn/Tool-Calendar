namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IStatsRepository
    {
        Task<object> GetDashboardStatsAsync();
        Task<object> GetDashboardDeadlineSeriesAsync(int days = 14);
        Task<object> GetMonthlyDepartmentReportAsync(int month, int year);
        Task<string> GetAiContextStatsAsync();
    }
}
