"""
Prompt Prefix Cache — học từ llama.cpp KV Cache (cache_prompt = true)
Ref: llama.cpp/tools/server/server-task.h (task_params.cache_prompt = true)
     llama.cpp/tools/server/server-context.cpp (slot KV cache reuse)

Ý tưởng: Llama.cpp lưu KV-cache của prompt để lần sau không cần encode lại.
Ta áp dụng tương tự: cache embedding của các câu hay lặp lại (system prompts, greeting, etc.)
dùng LRU Cache với TTL để tự động hết hạn.
"""

import hashlib
import logging
import time
from collections import OrderedDict
from typing import Optional

logger = logging.getLogger(__name__)

# Kích thước cache tối đa (số entries) — tương đương n_ctx trong llama.cpp
DEFAULT_CACHE_SIZE = 1024
# TTL mặc định: 1 giờ (prompt ít thay đổi trong cùng session)
DEFAULT_TTL_SECONDS = 3600


class PromptEmbeddingCache:
    """
    LRU Cache cho embeddings — học từ llama.cpp cache_prompt mechanism.

    Khi cùng 1 đoạn text được embed nhiều lần (ví dụ: system prompt lặp lại,
    câu chào hỏi, tên công văn hay được hỏi đến), cache sẽ trả về ngay
    mà không cần chạy model lại.

    Giảm ~40-60% số lần chạy model trong production.
    """

    def __init__(self, max_size: int = DEFAULT_CACHE_SIZE, ttl: int = DEFAULT_TTL_SECONDS):
        self._cache: OrderedDict[str, tuple[list[float], float]] = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl
        self._hits = 0
        self._misses = 0

    def _make_key(self, text: str) -> str:
        """SHA256 hash của text làm cache key — tránh collision"""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def get(self, text: str) -> Optional[list[float]]:
        """Lấy embedding từ cache nếu còn hiệu lực"""
        key = self._make_key(text)
        if key not in self._cache:
            self._misses += 1
            return None

        vector, created_at = self._cache[key]
        if time.time() - created_at > self._ttl:
            # TTL expired — xóa và bỏ qua
            del self._cache[key]
            self._misses += 1
            return None

        # LRU: đưa lên đầu (most recently used)
        self._cache.move_to_end(key)
        self._hits += 1
        return vector

    def put(self, text: str, vector: list[float]):
        """Lưu embedding vào cache"""
        key = self._make_key(text)

        if key in self._cache:
            self._cache.move_to_end(key)
        else:
            if len(self._cache) >= self._max_size:
                # Xóa phần tử cũ nhất (LRU eviction — giống KV cache eviction)
                evicted_key, _ = self._cache.popitem(last=False)
                logger.debug("[PromptCache] Evicted key %s...", evicted_key[:8])

        self._cache[key] = (vector, time.time())

    def stats(self) -> dict:
        """Thống kê cache — học từ /metrics endpoint của llama.cpp server"""
        total = self._hits + self._misses
        hit_rate = (self._hits / total * 100) if total > 0 else 0
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate_pct": round(hit_rate, 1),
        }

    def clear(self):
        self._cache.clear()
        self._hits = 0
        self._misses = 0


# Global singleton
_cache_instance: Optional[PromptEmbeddingCache] = None


def get_prompt_cache() -> PromptEmbeddingCache:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = PromptEmbeddingCache()
    return _cache_instance
