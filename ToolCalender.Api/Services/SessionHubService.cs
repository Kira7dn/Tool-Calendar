using System.Collections.Concurrent;
using System.Threading.Channels;

namespace ToolCalender.Api.Services
{
    /// <summary>
    /// Singleton service quản lý các kết nối SSE (Server-Sent Events).
    /// Khi user đăng nhập từ thiết bị mới, service này sẽ đẩy sự kiện "kicked"
    /// tới tất cả kết nối cũ của user đó ngay lập tức (real-time).
    /// </summary>
    public class SessionHubService
    {
        // userId -> danh sách các channel SSE đang kết nối
        private readonly ConcurrentDictionary<int, List<SseChannel>> _connections = new();
        private readonly ILogger<SessionHubService> _logger;

        public SessionHubService(ILogger<SessionHubService> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// Đăng ký một kết nối SSE mới cho user.
        /// </summary>
        public SseChannel Register(int userId, string currentSessionId)
        {
            var channel = new SseChannel(userId, currentSessionId);
            _connections.AddOrUpdate(
                userId,
                _ => new List<SseChannel> { channel },
                (_, list) => { lock (list) { list.Add(channel); } return list; }
            );
            _logger.LogInformation($"[SSE] User {userId} kết nối (sessionId: {currentSessionId.Substring(0, 8)}...)");
            return channel;
        }

        /// <summary>
        /// Gửi sự kiện "kicked" tới tất cả kết nối CŨ của user (không cùng sessionId mới).
        /// Gọi hàm này ngay sau khi user đăng nhập thành công ở thiết bị mới.
        /// </summary>
        public async Task KickOldSessions(int userId, string newSessionId)
        {
            if (!_connections.TryGetValue(userId, out var channels)) return;

            List<SseChannel> toKick;
            lock (channels)
            {
                toKick = channels.Where(c => c.SessionId != newSessionId).ToList();
            }

            foreach (var channel in toKick)
            {
                _logger.LogInformation($"[SSE] Đang kick user {userId} sessionId: {channel.SessionId.Substring(0, 8)}...");
                await channel.SendAsync("kicked", "Tài khoản đã đăng nhập từ thiết bị khác.");
                channel.Complete();
            }
        }

        /// <summary>
        /// Xóa một channel SSE khi nó đóng lại.
        /// </summary>
        public void Unregister(SseChannel channel)
        {
            if (_connections.TryGetValue(channel.UserId, out var channels))
            {
                lock (channels)
                {
                    channels.Remove(channel);
                }
            }
            _logger.LogInformation($"[SSE] User {channel.UserId} ngắt kết nối.");
        }
    }

    /// <summary>
    /// Đại diện cho một kết nối SSE đang mở.
    /// </summary>
    public class SseChannel
    {
        public int UserId { get; }
        public string SessionId { get; }

        private readonly TaskCompletionSource _tcs = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly Channel<string> _messageChannel = Channel.CreateUnbounded<string>();

        public SseChannel(int userId, string sessionId)
        {
            UserId = userId;
            SessionId = sessionId;
        }

        public async Task SendAsync(string eventName, string data)
        {
            var message = $"event: {eventName}\ndata: {data}\n\n";
            await _messageChannel.Writer.WriteAsync(message);
        }

        public void Complete()
        {
            _messageChannel.Writer.Complete();
        }

        public IAsyncEnumerable<string> ReadAllAsync(CancellationToken ct)
            => _messageChannel.Reader.ReadAllAsync(ct);
    }
}
