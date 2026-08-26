using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ToolCalendar.Hubs;

using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Services
{
    public class ReminderWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ReminderWorker> _logger;
        private readonly IHubContext<NotificationHub> _hubContext;

        public ReminderWorker(IServiceProvider serviceProvider, ILogger<ReminderWorker> logger, IHubContext<NotificationHub> hubContext)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _hubContext = hubContext;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[ReminderWorker] Dịch vụ quét nhắc nhở AI đã khởi động.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var reminderRepo = scope.ServiceProvider.GetRequiredService<IReminderRepository>();
                        
                        var pendingReminders = await reminderRepo.GetPendingRemindersAsync();
                        
                        if (pendingReminders.Any())
                        {
                            _logger.LogInformation($"[ReminderWorker] Có {pendingReminders.Count} nhắc nhở cần gửi.");
                            
                            foreach (var reminder in pendingReminders)
                            {
                                // Gửi qua SignalR tới UserId
                                await _hubContext.Clients.User(reminder.UserId.ToString())
                                    .SendAsync("ReceiveReminder", new {
                                        id = reminder.Id,
                                        content = reminder.Content,
                                        remindAt = reminder.RemindAt
                                    });

                                // Đánh dấu đã gửi
                                await reminderRepo.MarkAsSentAsync(reminder.Id);
                                _logger.LogInformation($"[ReminderWorker] Đã gửi nhắc nhở {reminder.Id} cho User {reminder.UserId}.");
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[ReminderWorker] Lỗi khi quét nhắc nhở.");
                }

                // Chờ 30 giây trước khi quét tiếp
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }
    }
}
