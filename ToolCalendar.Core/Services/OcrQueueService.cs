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

    public class OcrQueueService : BackgroundService, IOcrQueueService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<OcrQueueService> _logger;
        private readonly IConfiguration _configuration;

        private const string QueueName = "ocr_document_queue";
        private const int MaxConcurrentFiles = 8; // Xử lý song song 8 file

        private IConnection? _connection;
        private IModel? _channel;
        private bool _isConnecting = false;

        private int _pendingCount = 0;
        public int PendingCount => _pendingCount;

        public OcrQueueService(
            IServiceProvider serviceProvider, 
            ILogger<OcrQueueService> logger,
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

            _logger.LogInformation("[RabbitMQ Worker] Đang chạy OCR DocumentId {Id} — '{File}'", docId, Path.GetFileName(absolutePath));

            doc.Status = "Đang xử lý";
            await docRepo.UpdateAsync(doc);
            await NotifyProgressAsync(scope, docId, "Đang xử lý");

            try
            {
                var updatedDoc = await extractor.ExtractFromFileAsync(absolutePath);
                updatedDoc.Id = doc.Id;
                updatedDoc.FilePath = doc.FilePath;
                updatedDoc.NgayThem = doc.NgayThem;
                updatedDoc.LabelId = doc.LabelId;
                updatedDoc.DaTaoLich = doc.DaTaoLich;
                updatedDoc.Status = updatedDoc.Status == "Lỗi OCR" ? "Lỗi OCR" : "Chưa xử lý";

                await docRepo.UpdateAsync(updatedDoc);

                // --- BẮT ĐẦU: RAG - Chunking và Tính toán Vector ---
                try
                {
                    var chunkRepo = scope.ServiceProvider.GetRequiredService<IDocumentChunkRepository>();
                    var embedService = scope.ServiceProvider.GetRequiredService<IOllamaEmbeddingService>();

                    // Xóa các chunk cũ nếu có (ví dụ khi reprocess OCR)
                    await chunkRepo.DeleteChunksByDocumentIdAsync(docId);

                    if (!string.IsNullOrWhiteSpace(updatedDoc.FullText))
                    {
                        _logger.LogInformation("[RAG] Đang tạo Vector cho DocumentId {Id}...", docId);
                        
                        var text = updatedDoc.FullText;
                        
                        // DOCLING + KHOJ: Semantic Chunking với Vietnamese Legal Separators
                        var chunks = new List<string>();
                        // Thứ tự ưu tiên cắt: Điều/Khoản/Chương (cấu trúc pháp lý) > đoạn văn > câu
                        // Nguồn cảm hứng: Khoj RecursiveCharacterTextSplitter với separators list
                        var paragraphs = System.Text.RegularExpressions.Regex.Split(
                            text,
                            @"(?<=\n\n|(?<=\n)\s*(?:Điều\s+\d+|Khoản\s+\d+|Mục\s+\d+|Chương\s+\d+|[IVX]+\s*\.)\s|\.[ \n]|;\s*\n|:\s*\n|\r\n\r\n)"
                        );

                        var currentChunk = new System.Text.StringBuilder();
                        int currentWordCount = 0;
                        int maxWordsPerChunk = 300; // Chunk lý tưởng cho Qwen2.5

                        foreach (var para in paragraphs)
                        {
                            if (string.IsNullOrWhiteSpace(para)) continue;

                            // KHOJ: Loại bỏ "từ" rác quá dài (> 200 chars)
                            var sanitizedPara = string.Join(" ", para.Split(new[] { ' ', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                                .Select(w => w.Length <= 200 ? w : ""));

                            int wordCount = sanitizedPara.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries).Length;

                            if (currentWordCount > 0 && currentWordCount + wordCount > maxWordsPerChunk)
                            {
                                chunks.Add(currentChunk.ToString().Trim());
                                currentChunk.Clear();
                                currentWordCount = 0;
                            }

                            currentChunk.Append(sanitizedPara).Append(" ");
                            currentWordCount += wordCount;
                        }

                        if (currentChunk.Length > 0)
                        {
                            chunks.Add(currentChunk.ToString().Trim());
                        }

                        // DIFY Idea #1: Chunk Overlap — lặp lại 100 từ cuối của chunk trước
                        // Tránh mất thông tin nằm ở ranh giới 2 chunk liền nhau
                        var overlappedChunks = new List<string>();
                        for (int ci = 0; ci < chunks.Count; ci++)
                        {
                            var chunkText = chunks[ci];
                            if (ci > 0)
                            {
                                var prevWords = chunks[ci - 1].Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                                var overlapWords = prevWords.Skip(Math.Max(0, prevWords.Length - 100)).ToArray();
                                chunkText = string.Join(" ", overlapWords) + " " + chunkText;
                            }
                            overlappedChunks.Add(chunkText);
                        }

                        // Tạo phần header metadata cho từng chunk
                        string tenCv = !string.IsNullOrWhiteSpace(updatedDoc.TenCongVan) ? updatedDoc.TenCongVan : "Không có";
                        string soCv = !string.IsNullOrWhiteSpace(updatedDoc.SoVanBan) ? updatedDoc.SoVanBan : "Không có";
                        string header = $"[Tên Công văn: {tenCv}] [Số hiệu: {soCv}]\n\n";

                        int chunkIndex = 0;
                        foreach (var chunk in overlappedChunks)
                        {
                            var enrichedChunk = header + chunk;

                            // Tính Vector
                            var vector = await embedService.GenerateEmbeddingAsync(enrichedChunk);
                            if (vector != null && vector.Length > 0)
                            {
                                await chunkRepo.AddChunkAsync(docId, chunkIndex++, enrichedChunk, vector);
                            }
                        }
                        _logger.LogInformation("[RAG] Đã lưu {Count} đoạn Vector (có overlap) cho DocumentId {Id}.", chunkIndex, docId);

                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[RAG] Lỗi khi tạo/lưu Vector cho DocumentId {Id}", docId);
                }
                // --- KẾT THÚC: RAG ---

                await NotifyProgressAsync(scope, docId, updatedDoc.Status);

                _logger.LogInformation("[RabbitMQ Worker] ✅ OCR thành công DocumentId {Id} → {Status}", docId, updatedDoc.Status);
            }
            catch (Exception ex)
            {
                doc.Status = "Lỗi OCR";
                await docRepo.UpdateAsync(doc);
                await NotifyProgressAsync(scope, docId, "Lỗi OCR");
                _logger.LogError(ex, "[RabbitMQ Worker] ❌ OCR thất bại DocumentId {Id}", docId);
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
