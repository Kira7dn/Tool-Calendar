using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IStatsRepository
    {
        object GetDashboardStats();
        object GetDashboardDeadlineSeries(int days = 14);
        object GetMonthlyDepartmentReport(int month, int year);
        Task<string> GetAiContextStatsAsync();
    }
}
