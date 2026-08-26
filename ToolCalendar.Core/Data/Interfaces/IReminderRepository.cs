using System.Collections.Generic;
using System.Threading.Tasks;
using ToolCalendar.Core.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface IReminderRepository
    {
        Task<int> AddReminderAsync(int userId, string content, string remindAt);
        Task<List<Reminder>> GetPendingRemindersAsync();
        Task MarkAsSentAsync(int id);
        Task<List<Reminder>> GetUserRemindersAsync(int userId);
    }
}
