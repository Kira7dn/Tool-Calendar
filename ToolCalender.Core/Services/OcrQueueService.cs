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

        public OcrQueueService(IServiceProvider serviceProvider, ILogger<OcrQueueService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            // Giới hạn hàng đợi 100 văn bản để tránh tràn bộ nhớ nếu upload quá nhiều
            var options = new BoundedChannelOptions(100) { FullMode = BoundedChannelFullMode.Wait };
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

            await foreach (var docId in _queue.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    await ProcessDocumentAsync(docId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"[OcrQueue] Lỗi khi xử lý DocumentId {docId}");
                }
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
