using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using System.Linq;
using ToolCalendar.Core.Data.Interfaces;
using ToolCalendar.Hubs;
using ToolCalendar.Core.Services;

namespace ToolCalendar.Services
{
    public interface IOcrQueueService
    {
        ValueTask EnqueueAsync(int documentId);
        int PendingCount { get; }
    }

    /// <summary>
    /// Document Processing Service — RabbitMQ consumer điều phối toàn bộ pipeline xử lý tài liệu.
    /// Tên cũ là OcrQueueService, đã đổi tên vì OCR đã chuyển sang Python AI Service.
    /// Chức năng hiện tại: lắng nghe queue ocr_document_queue, gọi Python để Extract + RAG index.
    /// </summary>
    public class DocumentProcessingService : BackgroundService, IOcrQueueService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DocumentProcessingService> _logger;
        private readonly IConfiguration _configuration;

        private const string QueueName = "ocr_document_queue";
        private const int MaxConcurrentFiles = 8; // Xử lý song song 8 file

        private IConnection? _connection;
        private IModel? _channel;
        private bool _isConnecting = false;

        private int _pendingCount = 0;
        public int PendingCount => _pendingCount;

        public DocumentProcessingService(
            IServiceProvider serviceProvider, 
            ILogger<DocumentProcessingService> logger,
            IConfiguration configuration)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _configuration = configuration;

            InitializeRabbitMQ();
        }

        private void InitializeRabbitMQ()
        {
            if (_isConnecting) return;
            _isConnecting = true;

            var factory = new ConnectionFactory
            {
                HostName = _configuration["RabbitMQ:HostName"] ?? "localhost",
                UserName = _configuration["RabbitMQ:UserName"] ?? "guest",
                Password = _configuration["RabbitMQ:Password"] ?? "guest",
                Port = int.TryParse(_configuration["RabbitMQ:Port"], out var port) ? port : 5672,
                AutomaticRecoveryEnabled = true,
                NetworkRecoveryInterval = TimeSpan.FromSeconds(10),
                DispatchConsumersAsync = true
            };

            try
            {
                _logger.LogInformation("[RabbitMQ] Đang kết nối tới {Host}...", factory.HostName);
                _connection = factory.CreateConnection();
                _channel = _connection.CreateModel();

                // Khai báo hàng đợi bền vững (Durable = true) để không mất tin nhắn khi restart server
                _channel.QueueDeclare(
                    queue: QueueName,
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null);

                // Giới hạn prefetch để RabbitMQ phân phối công bằng giữa các worker
                _channel.BasicQos(prefetchSize: 0, prefetchCount: (ushort)MaxConcurrentFiles, global: false);

                _logger.LogInformation("[RabbitMQ] Kết nối thành công và khai báo queue '{QueueName}'.", QueueName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[RabbitMQ] Không thể kết nối tới RabbitMQ Broker. Sẽ tự động khôi phục khi gửi tin nhắn hoặc chạy nền.");
            }
            finally
            {
                _isConnecting = false;
            }
        }

        private void EnsureChannel()
        {
            if (_channel == null || _channel.IsClosed)
            {
                InitializeRabbitMQ();
            }
        }

        public async ValueTask EnqueueAsync(int documentId)
        {
            try
            {
                EnsureChannel();

                if (_channel == null)
                {
                    throw new InvalidOperationException("Không có kết nối tới RabbitMQ Broker.");
                }

                var body = Encoding.UTF8.GetBytes(documentId.ToString());

                var properties = _channel.CreateBasicProperties();
                properties.Persistent = true; // Lưu trữ tin nhắn xuống ổ đĩa đề phòng sự cố

                lock (_channel)
                {
                    _channel.BasicPublish(
                        exchange: string.Empty,
                        routingKey: QueueName,
                        basicProperties: properties,
                        body: body);
                }

                Interlocked.Increment(ref _pendingCount);
                _logger.LogInformation("[RabbitMQ] Đã gửi DocumentId {DocumentId} vào queue thành công.", documentId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[RabbitMQ] Thất bại khi đẩy DocumentId {DocumentId} vào queue. Chuyển sang xử lý dự phòng tại chỗ.", documentId);
                // Fallback: Xử lý chạy nền không đồng bộ lập tức để không mất request của khách hàng
                _ = Task.Run(() => ProcessDocumentAsync(documentId, CancellationToken.None));
            }
            await ValueTask.CompletedTask;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[RabbitMQ Worker] Khởi chạy consumer lắng nghe hàng đợi.");

            // Loop liên tục đề phòng kết nối RabbitMQ bị ngắt lúc khởi động
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    EnsureChannel();

                    if (_channel != null)
                    {
                        var consumer = new AsyncEventingBasicConsumer(_channel);
                        consumer.Received += async (model, ea) =>
                        {
                            var body = ea.Body.ToArray();
                            var message = Encoding.UTF8.GetString(body);

                            if (int.TryParse(message, out int docId))
                            {
                                try
                                {
                                    await ProcessDocumentAsync(docId, stoppingToken);
                                    _channel.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError(ex, "[RabbitMQ Worker] Thất bại nghiêm trọng khi xử lý DocumentId {DocumentId}. Từ chối tin nhắn.", docId);
                                    // Từ chối và không requeue để tránh vòng lặp vô hạn (chuyển sang Lỗi OCR trong DB)
                                    _channel.BasicNack(deliveryTag: ea.DeliveryTag, multiple: false, requeue: false);
                                }
                                finally
                                {
                                    Interlocked.Decrement(ref _pendingCount);
                                }
                            }
                            else
                            {
                                _logger.LogWarning("[RabbitMQ Worker] Định dạng tin nhắn không hợp lệ: '{Message}'", message);
                                _channel.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
                            }
                        };

                        _channel.BasicConsume(
                            queue: QueueName,
                            autoAck: false,
                            consumer: consumer);

                        _logger.LogInformation("[RabbitMQ Worker] Đăng ký lắng nghe BasicConsume thành công.");
                        break; // Đã đăng ký thành công consumer, thoát loop retry
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("[RabbitMQ Worker] Chưa thể kết nối RabbitMQ Broker, thử lại sau 5 giây... Chi tiết: {Msg}", ex.Message);
                }

                await Task.Delay(5000, stoppingToken);
            }

            // Giữ background service sống
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }

        private async Task ProcessDocumentAsync(int docId, CancellationToken cancellationToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var extractor = scope.ServiceProvider.GetRequiredService<IDocumentExtractorService>();
            var docRepo = scope.ServiceProvider.GetRequiredService<IDocumentRepository>();
            var aiService = scope.ServiceProvider.GetRequiredService<IPythonAiService>();
            var settingRepo = scope.ServiceProvider.GetRequiredService<ISettingRepository>();

            var doc = await docRepo.GetDocumentByIdAsync(docId);
            if (doc == null)
            {
                _logger.LogWarning("[RabbitMQ Worker] Không thấy DocumentId {Id} trong database.", docId);
                return;
            }

            string absolutePath = ResolveAbsolutePath(doc.FilePath);
            if (string.IsNullOrEmpty(absolutePath) || !File.Exists(absolutePath))
            {
                _logger.LogWarning("[RabbitMQ Worker] File không tồn tại: '{Path}'", doc.FilePath);
                return;
            }

            _logger.LogInformation("[RabbitMQ Worker] Đang gọi Python AI Service để Extract DocumentId {Id} — '{File}'", docId, Path.GetFileName(absolutePath));

            doc.Status = "Đang xử lý";
            await docRepo.UpdateAsync(doc);
            await NotifyProgressAsync(scope, docId, "Đang xử lý");

            try
            {
                // Lấy cấu hình từ khóa thời hạn
                var dlKeywordsStr = settingRepo.GetAppSetting("Document_DeadlineKeywords", "hạn, đến ngày, trước ngày, trình, xong, xong trước, hoàn thành");
                var dlExcludeStr = settingRepo.GetAppSetting("Document_DeadlineExcludeKeywords", "vào khoảng, phát hiện, sinh năm, xảy ra, tại bãi, vào ngày, ngày xảy, được phát hiện, lúc khoảng");
                
                var deadlineKeywords = dlKeywordsStr.Split(',').Select(x => x.Trim()).Where(x => !string.IsNullOrEmpty(x)).ToList();
                var excludeKeywords = dlExcludeStr.Split(',').Select(x => x.Trim()).Where(x => !string.IsNullOrEmpty(x)).ToList();

                // 1. LUỒNG NHANH (0.1s): Trích xuất chữ từ PDF gốc để lấy Metadata tức thì
                var fastText = await aiService.ExtractFastTextAsync(absolutePath);
                if (!string.IsNullOrWhiteSpace(fastText))
                {
                    _logger.LogInformation("[RabbitMQ Worker] Tìm thấy chữ trong PDF gốc (Native). Đang bóc tách Metadata tức thì cho DocumentId {Id}", docId);
                    var metadata = await aiService.ExtractMetadataAsync(fastText, deadlineKeywords, excludeKeywords);
                    if (metadata != null)
                    {
                        if (!string.IsNullOrWhiteSpace(metadata.SoVanBan)) doc.SoVanBan = metadata.SoVanBan;
                        if (!string.IsNullOrWhiteSpace(metadata.TenCongVan)) doc.TenCongVan = metadata.TenCongVan;
                        if (!string.IsNullOrWhiteSpace(metadata.TrichYeu)) doc.TrichYeu = metadata.TrichYeu;
                        if (!string.IsNullOrWhiteSpace(metadata.NgayBanHanh) && DateTime.TryParse(metadata.NgayBanHanh, out var parsedNgay)) doc.NgayBanHanh = parsedNgay;
                        if (!string.IsNullOrWhiteSpace(metadata.ThoiHan) && DateTime.TryParse(metadata.ThoiHan, out var parsedThoiHan)) doc.ThoiHan = parsedThoiHan;
                        if (!string.IsNullOrWhiteSpace(metadata.CoQuanBanHanh)) doc.CoQuanBanHanh = metadata.CoQuanBanHanh;
                        if (!string.IsNullOrWhiteSpace(metadata.CoQuanChuQuan)) doc.CoQuanChuQuan = metadata.CoQuanChuQuan;
                        if (!string.IsNullOrWhiteSpace(metadata.Priority)) doc.Priority = metadata.Priority;
                    }
                    
                    // LƯU DB VÀ NOTIFY UI NGAY LẬP TỨC!
                    doc.Status = "Chưa xử lý";
                    await docRepo.UpdateAsync(doc);
                    await NotifyProgressAsync(scope, docId, "Chưa xử lý"); // UI MỞ KHÓA NGAY LẬP TỨC TẠI ĐÂY
                }

                // 2. LUỒNG NẶNG (2-3 phút): Gọi Docling để lấy toàn bộ Cấu trúc (Bảng biểu, Heading) cho RAG
                var updatedDoc = await extractor.ExtractFromFileAsync(absolutePath);
                
                // Cập nhật text từ Docling vào DB
                doc.FullText = updatedDoc.FullText;
                
                // Nếu luồng nhanh thất bại (vì là ảnh scan), gọi lại Metadata Extraction sau khi OCR xong
                if (string.IsNullOrWhiteSpace(fastText) && !string.IsNullOrWhiteSpace(doc.FullText))
                {
                    _logger.LogInformation("[RabbitMQ Worker] File scan. Bóc tách Metadata bằng text sau OCR cho DocumentId {Id}", docId);
                    var metadata = await aiService.ExtractMetadataAsync(doc.FullText, deadlineKeywords, excludeKeywords);
                    if (metadata != null)
                    {
                        if (!string.IsNullOrWhiteSpace(metadata.SoVanBan)) doc.SoVanBan = metadata.SoVanBan;
                        if (!string.IsNullOrWhiteSpace(metadata.TenCongVan)) doc.TenCongVan = metadata.TenCongVan;
                        if (!string.IsNullOrWhiteSpace(metadata.TrichYeu)) doc.TrichYeu = metadata.TrichYeu;
                        if (!string.IsNullOrWhiteSpace(metadata.NgayBanHanh) && DateTime.TryParse(metadata.NgayBanHanh, out var parsedNgay)) doc.NgayBanHanh = parsedNgay;
                        if (!string.IsNullOrWhiteSpace(metadata.ThoiHan) && DateTime.TryParse(metadata.ThoiHan, out var parsedThoiHan)) doc.ThoiHan = parsedThoiHan;
                        if (!string.IsNullOrWhiteSpace(metadata.CoQuanBanHanh)) doc.CoQuanBanHanh = metadata.CoQuanBanHanh;
                        if (!string.IsNullOrWhiteSpace(metadata.CoQuanChuQuan)) doc.CoQuanChuQuan = metadata.CoQuanChuQuan;
                        if (!string.IsNullOrWhiteSpace(metadata.Priority)) doc.Priority = metadata.Priority;
                    }
                    doc.Status = "Chưa xử lý";
                    await docRepo.UpdateAsync(doc);
                }
                else
                {
                    // Vẫn phải lưu lại FullText của Docling vào DB (Status đã là 'Chưa xử lý' từ luồng nhanh)
                    await docRepo.UpdateAsync(doc);
                }

                // --- BẮT ĐẦU: RAG - Chunking và Tính toán Vector ---
                try
                {
                    var chunkRepo = scope.ServiceProvider.GetRequiredService<IDocumentChunkRepository>();

                    // Xóa các chunk cũ nếu có
                    await chunkRepo.DeleteChunksByDocumentIdAsync(docId);

                    if (!string.IsNullOrWhiteSpace(doc.FullText))
                    {
                        _logger.LogInformation("[RAG] Đang gọi Python AI Service để Chunk & Embed cho DocumentId {Id}...", docId);

                        // [RAPTOR] Bước 0: Sinh Document Summary và index nó như một "macro chunk"
                        // Giúp trả lời được câu hỏi rộng như "tài liệu này nói về gì?"
                        string docSummaryText = "";
                        try
                        {
                            var summaryResult = await aiService.DocSummaryAsync(
                                doc.FullText, 
                                doc.TenCongVan ?? string.Empty
                            );
                            if (summaryResult != null && !string.IsNullOrWhiteSpace(summaryResult.Summary))
                            {
                                docSummaryText = summaryResult.Summary;
                                // Lưu summary như một special "root chunk" (ParentChunkId = null)
                                // Embed nó với vector thực (không phải dummy vector)
                                var summaryVec = summaryResult.SummaryVector.ToArray();
                                await chunkRepo.AddChunkAsync(docId, -1, $"[Tóm tắt] {summaryResult.Summary}", summaryVec);
                                _logger.LogInformation("[RAG] Đã index Document Summary cho DocumentId {Id}", docId);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "[RAG] Lỗi khi sinh Document Summary cho DocumentId {Id}, bỏ qua.", docId);
                        }

                        var parentChunkResult = await aiService.ChunkDocumentAsync(new ChunkRequest
                        {
                            Text = doc.FullText,
                            DocTitle = doc.TenCongVan ?? string.Empty,
                            DocDate = doc.NgayBanHanh?.ToString("dd/MM/yyyy") ?? string.Empty,
                            DocSource = doc.CoQuanBanHanh ?? string.Empty,
                            DocId = docId,
                            ChunkSize = 1500,
                            ChunkOverlap = 150
                        });

                        var parentChunks = parentChunkResult.Chunks.Select(c => c.Content).ToList();

                        if (parentChunks.Any())
                        {
                            int totalChildren = 0;
                            for (int pIndex = 0; pIndex < parentChunks.Count; pIndex++)
                            {
                                var pText = parentChunks[pIndex];
                                // Lưu Parent Chunk với vector rỗng (dummy 384 dims để không lỗi schema)
                                // Parent chunk không dùng để search vector (cosine sẽ = 0)
                                int parentDbId = await chunkRepo.AddChunkAsync(docId, pIndex, pText, new float[384]);

                                // [Contextual Retrieval - Tối ưu 95% thời gian]
                                // Thay vì gọi LLM liên tục cho mỗi đoạn, ta chèn thẳng Summary vào đầu đoạn
                                string contextualParentText = $"[Ngữ cảnh: Tài liệu {doc.TenCongVan ?? ""}. Tóm tắt: {docSummaryText}]\n\n{pText}";

                                // 2. Tạo Child Chunks từ Contextual Parent Chunk
                                var childChunkResult = await aiService.ChunkDocumentAsync(new ChunkRequest
                                {
                                    Text = contextualParentText,
                                    DocTitle = doc.TenCongVan ?? string.Empty,
                                    DocDate = doc.NgayBanHanh?.ToString("dd/MM/yyyy") ?? string.Empty,
                                    DocSource = doc.CoQuanBanHanh ?? string.Empty,
                                    DocId = docId,
                                    ChunkSize = 400,
                                    ChunkOverlap = 50
                                });

                                var childTexts = childChunkResult.Chunks.Select(c => c.Content).ToList();

                                // [SPRINT 3] QA-Pair Indexing: Sinh QA Pairs từ Parent Chunk
                                // TỐI ƯU: Giới hạn chỉ sinh QA cho 2 đoạn đầu tiên để tránh bị quá tải AI
                                if (pIndex < 2)
                                {
                                    try
                                    {
                                        var qaResult = await aiService.GenerateQAAsync(new GenerateQARequest
                                        {
                                            Text = pText,
                                            Model = "qwen2.5:3b"
                                        });
                                        if (qaResult.QaPairs != null && qaResult.QaPairs.Any())
                                        {
                                            childTexts.AddRange(qaResult.QaPairs);
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        _logger.LogWarning(ex, "[RAG] Lỗi khi sinh QA pairs cho ParentChunk, bỏ qua để tiếp tục.");
                                    }
                                }

                                if (childTexts.Any())
                                {
                                    // Embed Child Chunks & QA Pairs
                                    var embedResult = await aiService.BatchEmbedAsync(new BatchEmbedRequest
                                    {
                                        Texts = childTexts,
                                        Normalize = true
                                    });

                                    // 3. Lưu Child Chunks vào database
                                    for (int cIndex = 0; cIndex < childTexts.Count; cIndex++)
                                    {
                                        var cText = childTexts[cIndex];
                                        var vector = embedResult.Vectors[cIndex];
                                        if (vector != null && vector.Count > 0)
                                        {
                                            await chunkRepo.AddChunkAsync(docId, (pIndex * 1000) + cIndex, cText, vector.ToArray(), parentDbId);
                                            totalChildren++;
                                        }
                                    }
                                }
                            }
                            _logger.LogInformation("[RAG] Đã lưu {ParentCount} Parent và {ChildCount} Child Vectors cho DocumentId {Id}.", parentChunks.Count, totalChildren, docId);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[RAG] Lỗi khi tạo/lưu Vector cho DocumentId {Id}", docId);
                }
                // --- KẾT THÚC: RAG ---

                await NotifyProgressAsync(scope, docId, doc.Status);
                _logger.LogInformation("[RabbitMQ Worker] ✅ AI Service xử lý thành công DocumentId {Id}", docId);
            }
            catch (Exception ex)
            {
                doc.Status = "Lỗi OCR";
                await docRepo.UpdateAsync(doc);
                await NotifyProgressAsync(scope, docId, "Lỗi OCR");
                _logger.LogError(ex, "[RabbitMQ Worker] ❌ AI Service thất bại DocumentId {Id}", docId);
                throw; // Throw để Nack tin nhắn
            }
        }

        private static async Task NotifyProgressAsync(IServiceScope scope, int docId, string status)
        {
            try
            {
                var hubContext = scope.ServiceProvider.GetService<IHubContext<NotificationHub>>();
                if (hubContext != null)
                {
                    await hubContext.Clients.All.SendAsync("ocr_progress", new { docId, status });
                }
            }
            catch { }
        }

        private static string ResolveAbsolutePath(string? relativePath)
        {
            if (string.IsNullOrEmpty(relativePath)) return string.Empty;
            if (Path.IsPathRooted(relativePath)) return relativePath;
            return Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, relativePath));
        }

        public override void Dispose()
        {
            try
            {
                _channel?.Close();
                _channel?.Dispose();
                _connection?.Close();
                _connection?.Dispose();
            }
            catch { }
            base.Dispose();
        }
    }
}
