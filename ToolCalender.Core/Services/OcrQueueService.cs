using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ToolCalender.Data;

namespace ToolCalender.Services
{
    public interface IOcrQueueService
    {
        ValueTask EnqueueAsync(int documentId);
    }

    public class OcrQueueService : BackgroundService, IOcrQueueService
    {
        private readonly Channel<int> _queue;
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<OcrQueueService> _logger;

        private const int MaxConcurrentFiles = 3;
        private readonly SemaphoreSlim _concurrencyLimit = new(MaxConcurrentFiles, MaxConcurrentFiles);

        public OcrQueueService(IServiceProvider serviceProvider, ILogger<OcrQueueService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;

            var options = new BoundedChannelOptions(200)
            {
                FullMode = BoundedChannelFullMode.Wait
            };

            _queue = Channel.CreateBounded<int>(options);
        }

        public async ValueTask EnqueueAsync(int documentId)
        {
            await _queue.Writer.WriteAsync(documentId);
            _logger.LogInformation("[OcrQueue] Da them DocumentId {DocumentId} vao hang doi.", documentId);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[OcrQueue] Worker dang chay.");

            try
            {
                var interruptedDocs = DatabaseService.GetAll()
                    .Where(d => d.Status == "Đang xử lý")
                    .ToList();

                if (interruptedDocs.Count > 0)
                {
                    _logger.LogInformation(
                        "[OcrQueue] Resume {Count} job OCR dang do luc startup.",
                        interruptedDocs.Count);

                    foreach (var doc in interruptedDocs)
                    {
                        await EnqueueAsync(doc.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[OcrQueue] Loi khi resume job OCR dang do luc startup.");
            }

            await foreach (var docId in _queue.Reader.ReadAllAsync(stoppingToken))
            {
                await _concurrencyLimit.WaitAsync(stoppingToken);

                _ = Task.Run(async () =>
                {
                    try
                    {
                        await ProcessDocumentAsync(docId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[OcrQueue] Loi khi xu ly DocumentId {DocumentId}", docId);
                    }
                    finally
                    {
                        _concurrencyLimit.Release();
                    }
                }, stoppingToken);
            }
        }

        private async Task ProcessDocumentAsync(int docId)
        {
            using var scope = _serviceProvider.CreateScope();
            var extractor = scope.ServiceProvider.GetRequiredService<IDocumentExtractorService>();

            var doc = DatabaseService.GetAll().FirstOrDefault(d => d.Id == docId);
            if (doc == null || string.IsNullOrEmpty(doc.FilePath) || !File.Exists(doc.FilePath))
            {
                _logger.LogWarning("[OcrQueue] Khong tim thay file cho DocumentId {DocumentId}", docId);
                return;
            }

            _logger.LogInformation("[OcrQueue] Dang xu ly OCR cho DocumentId {DocumentId}", docId);

            doc.Status = "Đang xử lý";
            DatabaseService.Update(doc);

            try
            {
                var updatedDoc = await extractor.ExtractFromFileAsync(doc.FilePath);
                updatedDoc.Id = doc.Id;
                updatedDoc.Status = updatedDoc.Status == "Lỗi OCR" ? "Lỗi OCR" : "Chưa xử lý";
                DatabaseService.Update(updatedDoc);

                if (updatedDoc.Status == "Lỗi OCR")
                {
                    _logger.LogWarning("[OcrQueue] OCR gap loi native/engine cho DocumentId {DocumentId}. Da luu trang thai Loi OCR.", docId);
                    return;
                }

                _logger.LogInformation("[OcrQueue] Hoan tat xu ly DocumentId {DocumentId} thanh cong.", docId);
            }
            catch (Exception ex)
            {
                doc.Status = "Lỗi OCR";
                DatabaseService.Update(doc);
                _logger.LogError(ex, "[OcrQueue] That bai khi OCR DocumentId {DocumentId}", docId);
            }
        }
    }
}
