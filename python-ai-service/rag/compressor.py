"""
Context Compressor — học từ gpt-researcher/context/compression.py
và anything-llm EmbeddingsFilter pattern.

Pipeline RAG hoàn chỉnh:
1. Nhận danh sách documents (có full text)
2. Chia thành chunks (SmartTextChunker)
3. Embed tất cả chunks
4. Tính cosine similarity giữa query vector và chunk vectors
5. Filter: chỉ giữ chunk có similarity >= threshold (0.65)
6. Trả về top-K chunks liên quan nhất

Học từ:
- gpt-researcher ContextCompressor.async_get_context() → EmbeddingsFilter
- gpt-researcher similarity_threshold (env var SIMILARITY_THRESHOLD)
- anything-llm EmbeddingWorkerManager (parallel embed)
- llama.cpp L2 normalize (embd_normalize=2)
"""

import asyncio
import logging
from typing import Optional

import numpy as np

from .chunker import DocumentChunk, SmartTextChunker

logger = logging.getLogger(__name__)

# Học từ gpt-researcher SIMILARITY_THRESHOLD env var
DEFAULT_SIMILARITY_THRESHOLD = 0.65
DEFAULT_MAX_RESULTS = 8


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Cosine similarity — chính xác nhất khi cả 2 vector đã L2-normalized.
    Khi đã normalize → cosine = dot product.
    Học từ llama.cpp: khi embd_normalize=2, chỉ cần dot product là đủ.
    """
    dot = np.dot(vec_a, vec_b)
    # Clamp [-1, 1] để tránh floating point error
    return float(np.clip(dot, -1.0, 1.0))


class ContextCompressor:
    """
    Lấy top-K chunks liên quan nhất từ danh sách documents dựa trên query.

    Thay thế cho việc gửi toàn bộ full_text vào LLM (tốn token, tốn thời gian),
    ta chỉ gửi những đoạn thực sự liên quan đến câu hỏi.

    Ref: gpt-researcher ContextCompressor + EmbeddingsFilter
    """

    def __init__(
        self,
        embedder,  # AsyncBatchEmbedder instance
        chunker: Optional[SmartTextChunker] = None,
        similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
        max_results: int = DEFAULT_MAX_RESULTS,
    ):
        self._embedder = embedder
        self._chunker = chunker or SmartTextChunker()
        self.similarity_threshold = similarity_threshold
        self.max_results = max_results

    async def compress(
        self,
        query: str,
        documents: list[dict],
        max_results: Optional[int] = None,
    ) -> list[dict]:
        """
        Tìm top-K chunks liên quan nhất đến query.

        Args:
            query: Câu hỏi của người dùng
            documents: List dict với keys: text, title, date, source, id
            max_results: Override số kết quả tối đa

        Returns:
            Danh sách dicts gồm content_with_header + score, sort by score DESC
        """
        k = max_results or self.max_results

        if not query or not documents:
            return []

        # 1. Tạo chunks từ tất cả documents
        all_chunks: list[DocumentChunk] = []
        for doc in documents:
            text = doc.get("text", "")
            if not text or len(text.strip()) < 50:
                continue
            chunks = self._chunker.chunk_document(
                text=text,
                doc_title=doc.get("title", ""),
                doc_date=doc.get("date", ""),
                doc_source=doc.get("source", ""),
                doc_id=doc.get("id"),
            )
            all_chunks.extend(chunks)

        if not all_chunks:
            logger.warning("[Compressor] No chunks generated from %d documents", len(documents))
            return []

        # 2. Embed query + tất cả chunks song song (llama.cpp batch style)
        chunk_texts = [c.with_header() for c in all_chunks]
        all_texts = [query] + chunk_texts

        try:
            all_vectors_raw = await self._embedder.embed_batch(all_texts, normalize=True)
        except Exception as e:
            logger.error("[Compressor] Embedding error: %s", str(e))
            return []

        query_vec = np.array(all_vectors_raw[0])
        chunk_vecs = [np.array(v) for v in all_vectors_raw[1:]]

        # 3. Tính cosine similarity + filter (gpt-researcher EmbeddingsFilter)
        scored: list[tuple[float, DocumentChunk]] = []
        for chunk, vec in zip(all_chunks, chunk_vecs):
            score = cosine_similarity(query_vec, vec)
            if score >= self.similarity_threshold:
                scored.append((score, chunk))

        # 4. Sort by score DESC, lấy top-K
        scored.sort(key=lambda x: x[0], reverse=True)
        top_k = scored[:k]

        logger.info(
            "[Compressor] query='%s...' → %d/%d chunks passed threshold=%.2f, returning top-%d",
            query[:50], len(scored), len(all_chunks), self.similarity_threshold, len(top_k)
        )

        # 5. Trả về kết quả với score để C# có thể debug
        return [
            {
                "content": chunk.with_header(),
                "score": round(score, 4),
                "chunk_index": chunk.chunk_index,
                "doc_id": chunk.doc_id,
                "doc_title": chunk.doc_title,
                "word_count": chunk.word_count,
            }
            for score, chunk in top_k
        ]

    async def compress_to_context_string(
        self,
        query: str,
        documents: list[dict],
        max_results: Optional[int] = None,
    ) -> str:
        """
        Shortcut: trả về context string gộp tất cả chunks liên quan.
        Dùng thẳng vào system prompt của LLM.
        """
        chunks = await self.compress(query, documents, max_results)
        if not chunks:
            return ""
        parts = []
        for i, chunk in enumerate(chunks, 1):
            parts.append(f"[Đoạn {i} - Độ liên quan: {chunk['score']:.0%}]\n{chunk['content']}")
        return "\n\n---\n\n".join(parts)
