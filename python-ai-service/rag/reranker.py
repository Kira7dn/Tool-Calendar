"""
CrossEncoder Reranker — học từ Khoj + Dify

Sau bước ContextCompressor (embedding cosine similarity), chunks được xếp hạng
lại bằng CrossEncoder — một mô hình nhỏ hiểu cả query + chunk cùng lúc,
cho kết quả chính xác hơn cosine similarity đơn thuần.

Pipeline 2 bước (Two-Stage Retrieval):
  Bước 1: ContextCompressor → top-20 chunks (embedding similarity, nhanh)
  Bước 2: CrossEncoder Reranker → top-5 chunks (cross-attention, chính xác)

Học từ:
  khoj/src/khoj/processor/embeddings.py — CrossEncoderModel, predict()
  dify/api/core/rag/rerank/rerank_model.py — score_threshold filter, sort
  dify/api/core/rag/rerank/weight_rerank.py — weighted score combination
  khoj: tenacity retry với exponential backoff

Model mặc định: cross-encoder/ms-marco-MiniLM-L-2-v2
  - ~40MB, chạy tốt trên CPU
  - Hỗ trợ tiếng Việt ở mức cơ bản
  - Latency: ~50ms cho 20 chunks
"""

import logging
from typing import Optional

from sentence_transformers import CrossEncoder
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

logger = logging.getLogger(__name__)

# Học từ Khoj CrossEncoderModel — model nhẹ nhất vẫn đủ tốt
DEFAULT_CROSS_ENCODER = "cross-encoder/ms-marco-MiniLM-L-2-v2"

# Học từ Dify score_threshold — chỉ giữ chunk có rerank score >= threshold
DEFAULT_SCORE_THRESHOLD = 0.1  # CrossEncoder score range: -∞ đến +∞, sigmoid → [0,1]
DEFAULT_TOP_N = 5


class CrossEncoderReranker:
    """
    Two-Stage Reranker — học từ Khoj CrossEncoderModel + Dify RerankModelRunner.

    Stage 1 (ContextCompressor): embedding cosine similarity → top-20 candidates
    Stage 2 (CrossEncoderReranker): cross-attention → top-5 final results

    CrossEncoder hiểu mối quan hệ giữa query và chunk sâu hơn nhiều so với
    cosine similarity vì nó process cả 2 cùng lúc qua transformer.
    """

    def __init__(
        self,
        model_name: str = DEFAULT_CROSS_ENCODER,
        score_threshold: float = DEFAULT_SCORE_THRESHOLD,
        top_n: int = DEFAULT_TOP_N,
    ):
        logger.info("[Reranker] Loading CrossEncoder: %s", model_name)
        # Học từ Khoj: không dùng GPU cho reranker (tiết kiệm memory, đủ nhanh)
        self.model = CrossEncoder(model_name)
        self.model_name = model_name
        self.score_threshold = score_threshold
        self.top_n = top_n
        logger.info("[Reranker] CrossEncoder loaded: %s", model_name)

    @retry(
        # Học từ Khoj: retry khi model bị lỗi tạm thời
        retry=retry_if_exception_type(RuntimeError),
        wait=wait_random_exponential(multiplier=1, max=10),
        stop=stop_after_attempt(3),
        before_sleep=before_sleep_log(logger, logging.WARNING),
    )
    def rerank(
        self,
        query: str,
        chunks: list[dict],
        top_n: Optional[int] = None,
        score_threshold: Optional[float] = None,
    ) -> list[dict]:
        """
        Rerank danh sách chunks theo query.

        Args:
            query: Câu hỏi của user
            chunks: List chunk từ ContextCompressor (có key 'content', 'score', ...)
            top_n: Override số chunk trả về
            score_threshold: Override ngưỡng score tối thiểu

        Returns:
            Danh sách chunk đã rerank, sort theo rerank_score DESC
        """
        if not chunks or not query:
            return chunks

        k = top_n or self.top_n
        threshold = score_threshold if score_threshold is not None else self.score_threshold

        # Chuẩn bị input cho CrossEncoder — (query, chunk_text) pairs
        # Học từ Khoj: cross_inp = [[query, text] for text in hits]
        pairs = [[query, chunk.get("content", "")] for chunk in chunks]

        # Predict — CrossEncoder trả về raw logit scores
        # Học từ Khoj: activation_fct=nn.Sigmoid() để normalize về [0,1]
        try:
            import torch.nn as nn
            scores = self.model.predict(pairs, activation_fct=nn.Sigmoid())
        except Exception:
            # Fallback không dùng sigmoid nếu torch không có
            scores = self.model.predict(pairs)

        # Gán rerank score vào từng chunk
        # Học từ Dify rerank_model.py — format kết quả với score trong metadata
        scored_chunks = []
        for chunk, rerank_score in zip(chunks, scores):
            score_val = float(rerank_score)
            if score_val >= threshold:
                chunk_with_rerank = {**chunk, "rerank_score": round(score_val, 4)}
                scored_chunks.append(chunk_with_rerank)

        # Sort DESC theo rerank_score — học từ Dify:
        # rerank_documents.sort(key=lambda x: x.metadata.get("score", 0.0), reverse=True)
        scored_chunks.sort(key=lambda x: x.get("rerank_score", 0.0), reverse=True)

        result = scored_chunks[:k]

        logger.info(
            "[Reranker] query='%s...' | %d → %d chunks (threshold=%.2f)",
            query[:40], len(chunks), len(result), threshold
        )

        return result

    def rerank_to_context_string(
        self,
        query: str,
        chunks: list[dict],
        top_n: Optional[int] = None,
    ) -> str:
        """Shortcut: rerank và trả về context string để đưa thẳng vào LLM prompt"""
        reranked = self.rerank(query, chunks, top_n)
        if not reranked:
            return ""
        parts = []
        for i, chunk in enumerate(reranked, 1):
            embed_score = chunk.get("score", 0)
            rerank_score = chunk.get("rerank_score", 0)
            parts.append(
                f"[Đoạn {i} | Semantic: {embed_score:.0%} | Rerank: {rerank_score:.2f}]\n{chunk['content']}"
            )
        return "\n\n---\n\n".join(parts)


# Global singleton — load 1 lần lúc startup
_reranker_instance: Optional[CrossEncoderReranker] = None


def get_reranker() -> CrossEncoderReranker:
    global _reranker_instance
    if _reranker_instance is None:
        _reranker_instance = CrossEncoderReranker()
    return _reranker_instance
