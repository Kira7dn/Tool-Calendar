"""
Hybrid Retriever — BM25 + Semantic Search
Học từ Dify: dify/api/core/rag/rerank/weight_rerank.py

Vấn đề với pure semantic search:
  - Tìm "công văn số 001/2024/UBND" → semantic search có thể bỏ sót vì
    "001/2024/UBND" là identifier, không có ngữ nghĩa semantic rõ ràng
  - BM25 tốt với exact match (số hiệu, tên người, ngày tháng)
  - Semantic tốt với câu hỏi ngữ nghĩa ("công văn về phòng cháy chữa cháy")

Hybrid = kết hợp cả 2:
  final_score = α * bm25_score + (1-α) * semantic_score
  α = 0.3 mặc định (semantic dominant, BM25 hỗ trợ)

Học từ:
  dify/api/core/rag/rerank/weight_rerank.py — WeightRerankRunner
  dify: keyword_score + semantic_score weighted combination
"""

import logging
import math
from typing import Optional

from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

# BM25 parameters — thuật toán Okapi BM25
BM25_K1 = 1.5   # Term frequency saturation
BM25_B = 0.75   # Length normalization

# Hybrid weight — học từ Dify weight_rerank.py
# 0.0 = pure semantic, 1.0 = pure keyword, 0.3 = hơi nghiêng semantic
DEFAULT_KEYWORD_WEIGHT = 0.3
DEFAULT_SEMANTIC_WEIGHT = 0.7


class BM25Scorer:
    """
    BM25 (Okapi BM25) keyword scorer.
    Không cần index — score real-time với corpus nhỏ (~100 chunks).
    """

    def __init__(self, k1: float = BM25_K1, b: float = BM25_B):
        self.k1 = k1
        self.b = b

    def _tokenize(self, text: str) -> list[str]:
        """Word-level tokenize, lowercase — đủ tốt cho tiếng Việt"""
        return text.lower().split()

    def _compute_idf(self, query_terms: list[str], corpus: list[list[str]]) -> dict[str, float]:
        """IDF: Inverse Document Frequency — term phổ biến ít quan trọng hơn"""
        N = len(corpus)
        idf: dict[str, float] = {}
        for term in set(query_terms):
            # Số docs chứa term này
            df = sum(1 for doc_tokens in corpus if term in doc_tokens)
            # BM25 IDF formula
            idf[term] = math.log((N - df + 0.5) / (df + 0.5) + 1)
        return idf

    def score(self, query: str, chunks: list[dict]) -> list[float]:
        """
        Tính BM25 score cho từng chunk.
        Returns: list[float] cùng độ dài với chunks, đã normalize [0, 1]
        """
        if not chunks or not query:
            return [0.0] * len(chunks)

        query_terms = self._tokenize(query)
        corpus = [self._tokenize(chunk.get("content", "")) for chunk in chunks]

        # Tính avg doc length
        avg_dl = sum(len(doc) for doc in corpus) / len(corpus) if corpus else 1

        # IDF cho query terms
        idf = self._compute_idf(query_terms, corpus)

        scores = []
        for doc_tokens in corpus:
            doc_len = len(doc_tokens)
            score = 0.0
            tf_map: dict[str, int] = {}
            for token in doc_tokens:
                tf_map[token] = tf_map.get(token, 0) + 1

            for term in query_terms:
                tf = tf_map.get(term, 0)
                if tf == 0:
                    continue
                # BM25 TF score
                tf_score = (tf * (self.k1 + 1)) / (
                    tf + self.k1 * (1 - self.b + self.b * doc_len / avg_dl)
                )
                score += idf.get(term, 0) * tf_score

            scores.append(score)

        # Normalize về [0, 1]
        max_score = max(scores) if scores else 1.0
        if max_score > 0:
            scores = [s / max_score for s in scores]

        return scores


class HybridRetriever:
    """
    Hybrid Retrieval: BM25 + Semantic Score.

    Học từ Dify WeightRerankRunner:
      final_score = keyword_weight * bm25 + semantic_weight * semantic

    Dùng khi danh sách chunks đã có semantic score (từ ContextCompressor),
    HybridRetriever bổ sung BM25 score và merge lại.
    """

    def __init__(
        self,
        keyword_weight: float = DEFAULT_KEYWORD_WEIGHT,
        semantic_weight: float = DEFAULT_SEMANTIC_WEIGHT,
    ):
        if abs(keyword_weight + semantic_weight - 1.0) > 0.01:
            raise ValueError("keyword_weight + semantic_weight phải = 1.0")
        self.keyword_weight = keyword_weight
        self.semantic_weight = semantic_weight
        self.bm25 = BM25Scorer()
        logger.info(
            "[HybridRetriever] keyword=%.1f semantic=%.1f",
            keyword_weight, semantic_weight
        )

    def rerank(
        self,
        query: str,
        chunks: list[dict],
        top_n: Optional[int] = None,
    ) -> list[dict]:
        """
        Merge BM25 + Semantic scores → sort lại.

        Args:
            query: Câu hỏi
            chunks: Chunks đã có key 'score' (semantic score từ ContextCompressor)
            top_n: Số chunk trả về
        """
        if not chunks:
            return chunks

        # Tính BM25 scores
        bm25_scores = self.bm25.score(query, chunks)

        # Merge: α * BM25 + (1-α) * Semantic
        result = []
        for chunk, bm25_score in zip(chunks, bm25_scores):
            semantic_score = chunk.get("score", 0.0)
            hybrid_score = (
                self.keyword_weight * bm25_score
                + self.semantic_weight * semantic_score
            )
            result.append({
                **chunk,
                "bm25_score": round(bm25_score, 4),
                "semantic_score": round(semantic_score, 4),
                "hybrid_score": round(hybrid_score, 4),
                "score": round(hybrid_score, 4),  # Override score để reranker dùng
            })

        # Sort theo hybrid_score DESC
        result.sort(key=lambda x: x["hybrid_score"], reverse=True)

        if top_n:
            result = result[:top_n]

        logger.info(
            "[HybridRetriever] query='%s...' → %d chunks (kw=%.1f, sem=%.1f)",
            query[:40], len(result), self.keyword_weight, self.semantic_weight
        )

        return result
