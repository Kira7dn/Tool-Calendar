using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ToolCalender.Data;
using ToolCalender.Models;

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

        // ── Idea 2: Số file được xử lý đồng thời (tránh quá tải CPU/RAM)
        private const int MaxConcurrentFiles = 3;
        private readonly SemaphoreSlim _concurrencyLimit = new(MaxConcurrentFiles, MaxConcurrentFiles);

        public OcrQueueService(IServiceProvider serviceProvider, ILogger<OcrQueueService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            // Giới hạn hàng đợi 200 văn bản để tránh tràn bộ nhớ nếu upload quá nhiều
            var options = new BoundedChannelOptions(200) { FullMode = BoundedChannelFullMode.Wait };
            _queue = Channel.CreateBounded<int>(options);
        }

        public async ValueTask EnqueueAsync(int documentId)
        {
            await _queue.Writer.WriteAsync(documentId);
            _logger.LogInformation($"[OcrQueue] Đã thêm DocumentId {documentId} vào hàng đợi.");
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[OcrQueue] Worker đang chạy...");

            // Tự động quét và đẩy các văn bản đang chờ xử lý vào hàng đợi khi khởi động
            try
            {
                var pendingDocs = DatabaseService.GetAll().Where(d => 
                    d.Status == "Đang xử lý" || 
                    d.Status == "Lỗi OCR" ||
                    (d.Status == "Chưa xử lý" && (string.IsNullOrEmpty(d.FullText) || d.FullText.Contains("[OCR Total Error]"))));
                
                foreach (var doc in pendingDocs)
                {
                    await EnqueueAsync(doc.Id);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[OcrQueue] Lỗi khi quét văn bản tồn đọng lúc khởi động.");
            }

            // ── Idea 2: Đọc từ queue và kích hoạt task song song (tối đa MaxConcurrentFiles)
            await foreach (var docId in _queue.Reader.ReadAllAsync(stoppingToken))
            {
                // Chờ nếu đã đủ MaxConcurrentFiles đang chạy
                await _concurrencyLimit.WaitAsync(stoppingToken);

                // Chạy mỗi file trong Task độc lập — không await ở đây!
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await ProcessDocumentAsync(docId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"[OcrQueue] Lỗi khi xử lý DocumentId {docId}");
                    }
                    finally
                    {
                        // Giải phóng slot cho file tiếp theo
                        _concurrencyLimit.Release();
                    }
                }, stoppingToken);
            }
        }

        private async Task ProcessDocumentAsync(int docId)
        {
            using var scope = _serviceProvider.CreateScope();
            var extractor = scope.ServiceProvider.GetRequiredService<IDocumentExtractorService>();
            
            // 1. Lấy thông tin văn bản từ DB
            var allDocs = DatabaseService.GetAll();
            var doc = allDocs.FirstOrDefault(d => d.Id == docId);

            if (doc == null || string.IsNullOrEmpty(doc.FilePath) || !File.Exists(doc.FilePath))
            {
                _logger.LogWarning($"[OcrQueue] Không tìm thấy file cho DocumentId {docId}");
                return;
            }

            _logger.LogInformation($"[OcrQueue] Đang xử lý OCR cho: {doc.SoVanBan} - {docId}");

            // 2. Cập nhật trạng thái đang xử lý
            doc.Status = "Đang xử lý";
            DatabaseService.Update(doc);

            try
            {
                // 3. Thực hiện OCR và bóc tách
                var updatedDoc = await extractor.ExtractFromFileAsync(doc.FilePath);
                
                // 4. Cập nhật kết quả vào bản ghi gốc
                updatedDoc.Id = doc.Id;
                updatedDoc.Status = "Chưa xử lý"; // Sau khi OCR xong thì chờ rà soát
                DatabaseService.Update(updatedDoc);

                _logger.LogInformation($"[OcrQueue] Hoàn tất xử lý DocumentId {docId} thành công.");
            }
            catch (Exception ex)
            {
                doc.Status = "Lỗi OCR";
                DatabaseService.Update(doc);
                _logger.LogError(ex, $"[OcrQueue] Thất bại khi OCR DocumentId {docId}");
            }
        }
    }
}
