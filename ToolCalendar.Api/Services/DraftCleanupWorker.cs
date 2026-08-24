using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ToolCalendar.Core.Data.Interfaces;

namespace ToolCalendar.Api.Services
{
    public class DraftCleanupWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DraftCleanupWorker> _logger;
        private readonly TimeSpan _cleanupInterval = TimeSpan.FromHours(12); // Check every 12 hours
        private readonly TimeSpan _draftMaxAge = TimeSpan.FromHours(24); // Delete drafts older than 24 hours

        public DraftCleanupWorker(IServiceProvider serviceProvider, ILogger<DraftCleanupWorker> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[DraftCleanupWorker] Dịch vụ dọn dẹp văn bản nháp đã khởi động.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var documentRepo = scope.ServiceProvider.GetRequiredService<IDocumentRepository>();
                        
                        _logger.LogInformation($"[DraftCleanupWorker] Bắt đầu quét các văn bản nháp cũ hơn {_draftMaxAge.TotalHours} giờ...");
                        
                        int deletedCount = await documentRepo.CleanupOldDraftsAsync(_draftMaxAge);
                        
                        if (deletedCount > 0)
                        {
                            _logger.LogInformation($"[DraftCleanupWorker] Đã dọn dẹp thành công {deletedCount} văn bản nháp (rác).");
                        }
                        else
                        {
                            _logger.LogInformation("[DraftCleanupWorker] Không có văn bản nháp cũ nào cần dọn dẹp.");
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[DraftCleanupWorker] Lỗi khi dọn dẹp văn bản nháp.");
                }

                // Chờ đến lần quét tiếp theo
                await Task.Delay(_cleanupInterval, stoppingToken);
            }
        }
    }
}
