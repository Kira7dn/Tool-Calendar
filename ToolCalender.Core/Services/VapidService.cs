using ToolCalender.Data;
using WebPush;

namespace ToolCalender.Services
{
    public interface IVapidService
    {
        string GetVapidPublicKey();
        Task SendNotificationAsync(string endpoint, string p256dh, string auth, string payload);
    }

    public class VapidService : IVapidService
    {
        private string? _publicKey;
        private string? _privateKey;

        public VapidService()
        {
            InitializeKeys();
        }

        private void InitializeKeys()
        {
            _publicKey = DatabaseService.GetAppSetting("Vapid_PublicKey");
            _privateKey = DatabaseService.GetAppSetting("Vapid_PrivateKey");

            if (string.IsNullOrEmpty(_publicKey) || string.IsNullOrEmpty(_privateKey))
            {
                // Generate new keys if missing
                var keys = VapidHelper.GenerateVapidKeys();
                _publicKey = keys.PublicKey;
                _privateKey = keys.PrivateKey;

                DatabaseService.SaveAppSetting("Vapid_PublicKey", _publicKey);
                DatabaseService.SaveAppSetting("Vapid_PrivateKey", _privateKey);
            }
        }

        public string GetVapidPublicKey() => _publicKey ?? "";

        public async Task SendNotificationAsync(string endpoint, string p256dh, string auth, string payload)
        {
            if (string.IsNullOrEmpty(_publicKey) || string.IsNullOrEmpty(_privateKey)) return;

            var subscription = new WebPush.PushSubscription(endpoint, p256dh, auth);
            var vapidDetails = new VapidDetails("mailto:admin@toolcalendar.local", _publicKey, _privateKey);
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
                    DatabaseService.DeletePushSubscription(endpoint);
                }
            }
            catch (Exception)
            {
                // Log error if needed
            }
        }
    }
}
