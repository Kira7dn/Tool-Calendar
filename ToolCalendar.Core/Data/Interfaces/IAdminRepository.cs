using System.Collections.Generic;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IAdminRepository
    {
        List<Department> GetDepartments();
        int InsertDepartment(Department dept);
        void UpdateDepartment(Department dept);
        void DeleteDepartment(int id);
        
        List<Label> GetLabels();
        int InsertLabel(Label label);
        void DeleteLabel(int id);
        
        List<AutoRule> GetAutoRules();
        int InsertAutoRule(AutoRule rule);
        void DeleteAutoRule(int id);
    }
}
