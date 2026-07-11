using Microsoft.Extensions.DependencyInjection;
using ToolCalendar.Core.Data.Interfaces;
using WebPush;

namespace ToolCalendar.Services
{
    public interface IVapidService
    {
        string GetVapidPublicKey();
        Task SendNotificationAsync(string endpoint, string p256dh, string auth, string payload);
    }

    public class VapidService : IVapidService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private string? _publicKey;
        private string? _privateKey;

        public VapidService(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
            InitializeKeys();
        }

        private void InitializeKeys()
        {
            using var scope = _scopeFactory.CreateScope();
            var settingRepo = scope.ServiceProvider.GetRequiredService<ISettingRepository>();

            _publicKey = settingRepo.GetAppSetting("Vapid_PublicKey");
            _privateKey = settingRepo.GetAppSetting("Vapid_PrivateKey");

            if (string.IsNullOrEmpty(_publicKey) || string.IsNullOrEmpty(_privateKey))
            {
                // Generate new keys if missing
                var keys = VapidHelper.GenerateVapidKeys();
                _publicKey = keys.PublicKey;
                _privateKey = keys.PrivateKey;

                settingRepo.SaveAppSetting("Vapid_PublicKey", _publicKey);
                settingRepo.SaveAppSetting("Vapid_PrivateKey", _privateKey);
            }
        }

        public string GetVapidPublicKey() => _publicKey ?? "";

        public async Task SendNotificationAsync(string endpoint, string p256dh, string auth, string payload)
        {
            if (string.IsNullOrEmpty(_publicKey) || string.IsNullOrEmpty(_privateKey)) return;

            var subscription = new WebPush.PushSubscription(endpoint, p256dh, auth);
            var subject = Environment.GetEnvironmentVariable("VAPID_SUBJECT") ?? "mailto:admin@toolcalendar.local";
            var vapidDetails = new VapidDetails(subject, _publicKey, _privateKey);
            var webPushClient = new WebPushClient();

            try
            {
                await webPushClient.SendNotificationAsync(subscription, payload, vapidDetails);
            }
            catch (WebPushException ex)
            {
                // If the subscription is no longer valid, we should probably delete it
                if (ex.StatusCode == System.Net.HttpStatusCode.Gone || ex.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    using var scope = _scopeFactory.CreateScope();
                    var notificationRepo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();
                    notificationRepo.DeletePushSubscription(endpoint);
                }
            }
            catch (Exception)
            {
                // Log error if needed
            }
        }
    }
}
