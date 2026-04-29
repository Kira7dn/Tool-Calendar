using System.Text.Json.Serialization;

namespace ToolCalendar.Models
{
    public class NotificationPayload
    {
        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("body")]
        public string Body { get; set; } = string.Empty;

        [JsonPropertyName("icon")]
        public string Icon { get; set; } = "/assets/logo.png";

        [JsonPropertyName("url")]
        public string? Url { get; set; }

        [JsonPropertyName("data")]
        public object? Data { get; set; }
    }
}
