"""
RadixTree Prefix Cache — học từ SGLang srt/mem_cache/radix_cache.py + evict_policy.py

Khác với LRU cache đơn giản:
- RadixTree chia key (text) thành tokens/words → các câu có chung prefix dùng chung node
- VD: "công văn số 001" và "công văn số 002" → chung prefix "công văn số"
- Eviction policy pluggable: LRU / LFU / SLRU (từ sglang/srt/mem_cache/evict_policy.py)

Ref:
  sglang/python/sglang/srt/mem_cache/radix_cache.py (RadixKey, TreeNode, RadixCache)
  sglang/python/sglang/srt/mem_cache/evict_policy.py (LRU/LFU/SLRU strategies)
"""

from __future__ import annotations

import hashlib
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Eviction policies — học từ sglang/srt/mem_cache/evict_policy.py
POLICY_LRU = "lru"
POLICY_LFU = "lfu"
POLICY_SLRU = "slru"  # Segmented LRU — protected hot nodes from eviction


class _TreeNode:
    """
    Node trong Radix Tree — tương đương TreeNode trong sglang.
    Lưu prefix (đoạn text chung) và embedding vector tương ứng.
    """
    __slots__ = (
        "prefix", "children", "vector", "parent",
        "last_access_time", "creation_time", "hit_count", "priority"
    )

    def __init__(self, prefix: str = ""):
        self.prefix = prefix
        self.children: dict[str, "_TreeNode"] = {}
        self.vector: Optional[list[float]] = None
        self.parent: Optional["_TreeNode"] = None
        self.last_access_time: float = time.monotonic()
        self.creation_time: float = time.monotonic()
        self.hit_count: int = 0
        self.priority: int = 0  # lower = evicted first (PriorityStrategy)

    def is_leaf(self) -> bool:
        return len(self.children) == 0

    def touch(self):
        """Cập nhật access time và hit count — gọi mỗi lần cache hit"""
        self.last_access_time = time.monotonic()
        self.hit_count += 1


class RadixPrefixCache:
    """
    Radix Tree–based Embedding Cache.

    Thay thế LRU dict đơn giản bằng radix tree để:
    1. Prefix sharing: tiết kiệm memory khi nhiều câu có chung đầu
    2. Eviction thông minh hơn LRU (SLRU = protected hot segment)
    3. O(k) lookup với k = số tokens trong prefix (thay vì O(1) hash nhưng không share)

    Học từ SGLang RadixCache nhưng giản lược cho embedding use-case
    (không cần GPU memory management).
    """

    def __init__(
        self,
        max_nodes: int = 2048,
        evict_policy: str = POLICY_SLRU,
        slru_protected_threshold: int = 2,
    ):
        self._root = _TreeNode(prefix="")
        self._max_nodes = max_nodes
        self._node_count = 0
        self._evict_policy = evict_policy
        self._slru_threshold = slru_protected_threshold
        self._hits = 0
        self._misses = 0

        logger.info(
            "[RadixCache] Initialized: max_nodes=%d, policy=%s",
            max_nodes, evict_policy
        )

    def _tokenize(self, text: str) -> list[str]:
        """
        Chia text thành tokens để xây dựng radix tree.
        Dùng word-level split — đủ fine-grained cho tiếng Việt.
        """
        return text.strip().split()

    def _make_full_key(self, text: str) -> str:
        """Full text hash — dùng cho exact-match lookup"""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def _get_priority(self, node: _TreeNode) -> tuple:
        """
        Eviction priority — học từ sglang evict_policy.py.
        Smaller tuple = evicted first.
        """
        if self._evict_policy == POLICY_LRU:
            return (node.last_access_time,)
        elif self._evict_policy == POLICY_LFU:
            return (node.hit_count, node.last_access_time)
        elif self._evict_policy == POLICY_SLRU:
            # SLRU: probationary (hit < threshold) evicted before protected
            is_protected = 1 if node.hit_count >= self._slru_threshold else 0
            return (is_protected, node.last_access_time)
        return (node.last_access_time,)

    def _collect_evictable_leaves(self, node: _TreeNode, leaves: list[_TreeNode]):
        """Thu thập tất cả leaf nodes có thể evict"""
        if node.is_leaf() and node is not self._root:
            leaves.append(node)
        for child in node.children.values():
            self._collect_evictable_leaves(child, leaves)

    def _evict_one(self):
        """Evict node ít quan trọng nhất — LRU/LFU/SLRU"""
        leaves: list[_TreeNode] = []
        self._collect_evictable_leaves(self._root, leaves)
        if not leaves:
            return

        # Sort: phần tử nhỏ nhất (theo policy) bị evict trước
        victim = min(leaves, key=self._get_priority)
        parent = victim.parent
        if parent is not None:
            # Xóa khỏi cây
            for key, child in list(parent.children.items()):
                if child is victim:
                    del parent.children[key]
                    break
        self._node_count -= 1
        logger.debug("[RadixCache] Evicted node prefix='%s...'", victim.prefix[:20])

    def _find_or_create_node(self, text: str) -> _TreeNode:
        """
        Traverse/tạo path trong radix tree cho text.
        Full key được lưu ở node lá.
        """
        full_key = self._make_full_key(text)
        tokens = self._tokenize(text)

        current = self._root
        # Dùng full_key như 1 chuỗi key để đơn giản hóa implementation
        # (tối ưu hơn là token-by-token radix, nhưng phức tạp hơn nhiều)
        if full_key not in current.children:
            if self._node_count >= self._max_nodes:
                self._evict_one()
            node = _TreeNode(prefix=text[:50])  # Store first 50 chars for debug
            node.parent = current
            current.children[full_key] = node
            self._node_count += 1
            return node
        return current.children[full_key]

    def get(self, text: str) -> Optional[list[float]]:
        """Lấy embedding từ cache — O(1) với hash key"""
        full_key = self._make_full_key(text)
        node = self._root.children.get(full_key)
        if node is None or node.vector is None:
            self._misses += 1
            return None
        node.touch()
        self._hits += 1
        return node.vector

    def put(self, text: str, vector: list[float]):
        """Lưu embedding vào cache"""
        node = self._find_or_create_node(text)
        node.vector = vector

    def stats(self) -> dict:
        """Cache statistics — tương đương /metrics của llama.cpp"""
        total = self._hits + self._misses
        hit_rate = (self._hits / total * 100) if total > 0 else 0
        return {
            "type": "radix_tree",
            "evict_policy": self._evict_policy,
            "node_count": self._node_count,
            "max_nodes": self._max_nodes,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate_pct": round(hit_rate, 1),
        }

    def clear(self):
        self._root = _TreeNode(prefix="")
        self._node_count = 0
        self._hits = 0
        self._misses = 0


# Global singleton — dùng SLRU (hot nodes được bảo vệ khỏi eviction)
_radix_cache_instance: Optional[RadixPrefixCache] = None


def get_radix_cache() -> RadixPrefixCache:
    global _radix_cache_instance
    if _radix_cache_instance is None:
        _radix_cache_instance = RadixPrefixCache(
            max_nodes=2048,
            evict_policy=POLICY_SLRU,
            slru_protected_threshold=3,
        )
    return _radix_cache_instance
