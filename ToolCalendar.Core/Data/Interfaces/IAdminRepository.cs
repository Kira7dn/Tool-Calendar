using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading.Tasks;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IAdminRepository
    {
        Task<List<Department>> GetDepartmentsAsync();
        Task<int> InsertDepartmentAsync(Department dept);
        Task UpdateDepartmentAsync(Department dept);
        Task DeleteDepartmentAsync(int id);
        Task<List<DocumentLabel>> GetLabelsAsync();
        Task<int> InsertLabelAsync(DocumentLabel label);
        Task DeleteLabelAsync(int id);
        Task<List<AutoRule>> GetAutoRulesAsync();
        Task<int> InsertAutoRuleAsync(AutoRule rule);
        Task DeleteAutoRuleAsync(int id);
    }
}
