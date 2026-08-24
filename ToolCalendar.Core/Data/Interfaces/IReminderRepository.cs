using System.Collections.Generic;
using ToolCalendar.Core.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IReminderRepository
    {
        int AddReminder(int userId, string content, string remindAt);
        List<Reminder> GetPendingReminders();
        void MarkAsSent(int id);
        List<Reminder> GetUserReminders(int userId);
    }
}
