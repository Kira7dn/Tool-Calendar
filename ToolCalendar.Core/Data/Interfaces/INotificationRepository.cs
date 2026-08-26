using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading.Tasks;
using ToolCalendar.Models;

namespace ToolCalendar.Core.Data.Interfaces
{
    public interface INotificationRepository
    {
        Task InsertNotificationAsync(Core.Models.NotificationRecord n);
        Task<List<Core.Models.NotificationRecord>> GetNotificationsAsync(int userId, int limit = 50);
        Task MarkNotificationAsReadAsync(int id);
        Task MarkAllNotificationsAsReadAsync(int userId);
        Task<List<PushSubscription>> GetPushSubscriptionsAsync(int userId);
        Task InsertPushSubscriptionAsync(PushSubscription sub);
        Task DeletePushSubscriptionAsync(string endpoint);
    }
}
