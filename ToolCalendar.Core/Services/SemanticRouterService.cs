using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace ToolCalendar.Core.Services
{
    public interface ISemanticRouterService
    {
        Task<string?> RouteQueryAsync(float[] queryVector);
    }

    public class SemanticRouterService : ISemanticRouterService
    {
        private readonly IOllamaEmbeddingService _embeddingService;
        private readonly ILogger<SemanticRouterService> _logger;
        
        // Cấu hình các route và câu mẫu
        private static readonly Dictionary<string, List<string>> _routeTemplates = new()
        {
            { "search_documents_by_condition", new List<string> { 
                "có bao nhiêu công văn", 
                "thống kê công văn", 
                "tình hình xử lý", 
                "công văn đến hạn",
                "hôm nay có bao nhiêu",
                "có văn bản nào quá hạn không"
            }}
        };

        private static Dictionary<string, List<float[]>>? _routeEmbeddingsCache = null;
        private static readonly System.Threading.SemaphoreSlim _cacheLock = new(1, 1);

        public SemanticRouterService(IOllamaEmbeddingService embeddingService, ILogger<SemanticRouterService> logger)
        {
            _embeddingService = embeddingService;
            _logger = logger;
        }

        private async Task EnsureRouteEmbeddingsAsync()
        {
            if (_routeEmbeddingsCache != null) return;

            await _cacheLock.WaitAsync();
            try
            {
                if (_routeEmbeddingsCache != null) return;

                _logger.LogInformation("[SemanticRouter] Đang khởi tạo bộ nhớ đệm Vector cho các Routes...");
                var cache = new Dictionary<string, List<float[]>>();

                foreach (var route in _routeTemplates)
                {
                    var vectors = new List<float[]>();
                    foreach (var template in route.Value)
                    {
                        var vec = await _embeddingService.GenerateEmbeddingAsync(template);
                        if (vec != null && vec.Length > 0)
                        {
                            vectors.Add(vec);
                        }
                    }
                    cache[route.Key] = vectors;
                }

                _routeEmbeddingsCache = cache;
                _logger.LogInformation("[SemanticRouter] Đã hoàn thành nạp Vector cho Routes.");
            }
            finally
            {
                _cacheLock.Release();
            }
        }

        public async Task<string?> RouteQueryAsync(float[] queryVector)
        {
            if (queryVector == null || queryVector.Length == 0) return null;

            await EnsureRouteEmbeddingsAsync();

            string? bestRoute = null;
            float bestScore = 0f;

            foreach (var route in _routeEmbeddingsCache!)
            {
                foreach (var templateVector in route.Value)
                {
                    float score = CosineSimilarity(queryVector, templateVector);
                    if (score > bestScore)
                    {
                        bestScore = score;
                        bestRoute = route.Key;
                    }
                }
            }

            _logger.LogInformation("[SemanticRouter] Điểm tương đồng lớn nhất: {Score} (Route: {Route})", bestScore, bestRoute);

            // Ngưỡng 0.8 để xác định ý định
            if (bestScore >= 0.80f)
            {
                return bestRoute;
            }

            return null; // Trả về null để Fallback về LLM
        }

        private static float CosineSimilarity(float[] vector1, float[] vector2)
        {
            if (vector1.Length != vector2.Length)
                return 0;

            float dotProduct = 0;
            float magnitude1 = 0;
            float magnitude2 = 0;

            for (int i = 0; i < vector1.Length; i++)
            {
                dotProduct += vector1[i] * vector2[i];
                magnitude1 += vector1[i] * vector1[i];
                magnitude2 += vector2[i] * vector2[i];
            }

            if (magnitude1 == 0 || magnitude2 == 0)
                return 0;

            return dotProduct / (float)(Math.Sqrt(magnitude1) * Math.Sqrt(magnitude2));
        }
    }
}
