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
import os
from typing import Optional

import numpy as np

from .chunker import DocumentChunk, SmartTextChunker
from .hybrid_retriever import HybridRetriever
from .reranker import CrossEncoderReranker

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
    Full RAG Pipeline — 3 bước:
      1. Embed similarity (gpt-researcher ContextCompressor)
      2. Hybrid rerank: BM25 + Semantic (Dify WeightRerankRunner)
      3. CrossEncoder rerank (Khoj CrossEncoderModel)

    Chính xác hơn nhiều so với chỉ dùng cosine similarity đơn thuần.
    """

    def __init__(
        self,
        embedder,  # AsyncBatchEmbedder instance
        chunker: Optional[SmartTextChunker] = None,
        similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
        max_results: int = DEFAULT_MAX_RESULTS,
        # Pipeline options — có thể bật/tắt từng bước
        use_hybrid: bool = True,     # Dify BM25+Semantic
        use_reranker: bool = False,  # R-P05: TẮT Reranker vì nó dùng model tiếng Anh và tải lén Internet
        reranker: Optional[CrossEncoderReranker] = None,
        hybrid_retriever: Optional[HybridRetriever] = None,
    ):
        self._embedder = embedder
        self._chunker = chunker or SmartTextChunker()
        self.similarity_threshold = similarity_threshold
        self.max_results = max_results
        self.use_hybrid = use_hybrid
        self.use_reranker = use_reranker
        # Lazy-load để tránh load CrossEncoder khi không cần
        self._reranker = reranker
        self._hybrid = hybrid_retriever or (HybridRetriever() if use_hybrid else None)

    async def compress(
        self,
        query: str,
        documents: list[dict],
        max_results: Optional[int] = None,
    ) -> list[dict]:
        """
        Full RAG Pipeline 3 bước:
          1. Embedding cosine similarity → top-(k*4) candidates
          2. Hybrid BM25 + Semantic rerank (Dify)
          3. CrossEncoder rerank → top-k final (Khoj)
        """
        k = max_results or self.max_results

        if not query or not documents:
            return []

        # ── BƯỚC 0: Compression Fast-Path (GPT-Researcher) ──────────────────
        # Mặc định 1500 ký tự (R-P02). Nếu ngắn hơn 1500 ký tự (khoảng 1 trang), bỏ qua RAG để tăng tốc.
        # Các file văn bản > 1500 ký tự SẼ bắt buộc phải chạy qua RAG.
        COMPRESSION_THRESHOLD = int(os.getenv("COMPRESSION_FASTPATH_CHARS", "1500"))
        total_chars = sum(len(doc.get("text", "")) for doc in documents)

        if COMPRESSION_THRESHOLD > 0 and total_chars < COMPRESSION_THRESHOLD:
            logger.info("[Compressor] Fast-Path: Total chars %d < %d. Bypassing compression pipeline.", total_chars, COMPRESSION_THRESHOLD)
            result_chunks = []
            for doc in documents:
                text = doc.get("text", "")
                if text.strip():
                    result_chunks.append({
                        "content": f"Title: {doc.get('title', 'Unknown')}\n\n{text}",
                        "score": 1.0,
                        "is_raw": True,  # đánh dấu để tránh hiển thị "Liên quan: 100%" sai sự thật
                        "chunk_index": 0,
                        "doc_id": doc.get("id"),
                        "doc_title": doc.get("title", ""),
                        "word_count": len(text.split()),
                    })
            return result_chunks[:k]


        # ── BƯỚC 1: Tạo chunks ──────────────────────────────────────────────
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
            logger.warning("[Compressor] No chunks from %d documents", len(documents))
            return []

        # ── BƯỚC 2: Embedding similarity (gpt-researcher) ───────────────────
        # Lấy top-(k*4) để có đủ candidates cho reranking
        candidate_limit = k * 4
        chunk_texts = [c.with_header() for c in all_chunks]
        all_texts = [query] + chunk_texts

        try:
            all_vectors_raw = await self._embedder.embed_batch(all_texts, normalize=True)
        except Exception as e:
            logger.error("[Compressor] Embedding error: %s", str(e))
            return []

        query_vec = np.array(all_vectors_raw[0])
        chunk_vecs = [np.array(v) for v in all_vectors_raw[1:]]

        scored: list[tuple[float, DocumentChunk]] = []
        for chunk, vec in zip(all_chunks, chunk_vecs):
            score = cosine_similarity(query_vec, vec)
            if score >= self.similarity_threshold:
                scored.append((score, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        candidates = scored[:candidate_limit]

        logger.info(
            "[Compressor] Step1 embed: %d/%d passed threshold=%.2f",
            len(candidates), len(all_chunks), self.similarity_threshold
        )

        if not candidates:
            return []

        # Convert về list[dict] chuẩn
        result_chunks = [
            {
                "content": chunk.with_header(),
                "score": round(score, 4),
                "chunk_index": chunk.chunk_index,
                "doc_id": chunk.doc_id,
                "doc_title": chunk.doc_title,
                "word_count": chunk.word_count,
            }
            for score, chunk in candidates
        ]

        # ── BƯỚC 3: Hybrid BM25 + Semantic (Dify) ───────────────────────────
        if self.use_hybrid and self._hybrid is not None:
            result_chunks = self._hybrid.rerank(query, result_chunks, top_n=candidate_limit)
            logger.info("[Compressor] Step2 hybrid: %d chunks reranked", len(result_chunks))

        # ── BƯỚC 4: CrossEncoder Rerank (Khoj) ──────────────────────────────
        if self.use_reranker:
            # Lazy-load reranker
            if self._reranker is None:
                try:
                    from .reranker import get_reranker
                    self._reranker = get_reranker()
                except Exception as e:
                    logger.warning("[Compressor] Reranker unavailable: %s", str(e))

            if self._reranker is not None:
                try:
                    result_chunks = self._reranker.rerank(query, result_chunks, top_n=k)
                    logger.info("[Compressor] Step3 rerank: %d final chunks", len(result_chunks))
                except Exception as e:
                    logger.warning("[Compressor] Reranker failed, using hybrid results: %s", str(e))
                    result_chunks = result_chunks[:k]
            else:
                result_chunks = result_chunks[:k]
        else:
            result_chunks = result_chunks[:k]

        return result_chunks

    async def compress_to_context_string(
        self,
        query: str,
        documents: list[dict],
        max_results: Optional[int] = None,
    ) -> str:
        """Shortcut: trả về context string dùng thẳng vào LLM prompt"""
        chunks = await self.compress(query, documents, max_results)
        if not chunks:
            return ""
        parts = []
        for i, chunk in enumerate(chunks, 1):
            rerank_score = chunk.get("rerank_score")
            hybrid_score = chunk.get("hybrid_score")
            score_display = f"Rerank: {rerank_score:.2f}" if rerank_score else f"Score: {chunk['score']:.0%}"
            parts.append(f"[Đoạn {i} | {score_display}]\n{chunk['content']}")
        return "\n\n---\n\n".join(parts)
