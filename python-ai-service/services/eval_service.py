"""
RAG Evaluation Service
Đánh giá chất lượng câu trả lời RAG theo 3 chiều mà không cần ground truth.

Inspired by RAGAS (ragas.io) nhưng không dùng external API — hoàn toàn offline.

3 metrics:
- Faithfulness: Câu trả lời có bám vào context không?
- Answer Relevance: Câu trả lời có liên quan đến câu hỏi không?
- Context Relevance: Context retrieve có liên quan đến câu hỏi không?

Cách tính: cosine similarity giữa các embedding — không cần LLM judge riêng.
"""

import logging
import numpy as np
from typing import Optional

from schemas.eval import EvalRequest, EvalMetrics

logger = logging.getLogger(__name__)

# Ngưỡng đánh giá
PASS_THRESHOLD = 0.65
WARN_THRESHOLD = 0.45


def _cosine_sim(a: list[float], b: list[float]) -> float:
    """Cosine similarity giữa hai vector đã L2-normalize."""
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    dot = float(np.dot(va, vb))
    norm = float(np.linalg.norm(va) * np.linalg.norm(vb))
    if norm < 1e-8:
        return 0.0
    return max(0.0, min(1.0, dot / norm))


class EvalService:
    """
    RAG Quality Evaluator — đánh giá offline không cần Internet.

    Tất cả tính toán dùng embedding cosine similarity:
    - Nhanh (< 50ms)
    - Không cần LLM judge riêng
    - Hoàn toàn offline (phù hợp dữ liệu công văn nhà nước)
    """

    def __init__(self, batch_embedder):
        self.embedder = batch_embedder

    async def evaluate(self, request: EvalRequest) -> EvalMetrics:
        """
        Đánh giá chất lượng RAG response.

        Args:
            request: câu hỏi + câu trả lời + danh sách context chunks

        Returns:
            EvalMetrics với 3 score + verdict
        """
        # Embed câu hỏi, câu trả lời và tất cả context
        texts_to_embed = [request.question, request.answer] + request.contexts
        try:
            vectors = await self.embedder.embed_batch(texts_to_embed, normalize=True)
        except Exception as e:
            logger.error("[EvalService] Embedding failed: %s", str(e))
            return EvalMetrics(
                faithfulness=0.0, answer_relevance=0.0, context_relevance=0.0,
                overall_score=0.0, verdict="FAIL",
                details=f"Embedding error: {str(e)}"
            )

        q_vec = vectors[0]
        a_vec = vectors[1]
        ctx_vecs = vectors[2:]

        # ── Metric 1: Context Relevance ───────────────────────────────────
        # Câu hỏi có liên quan đến các context được retrieve không?
        # → Max similarity giữa câu hỏi và từng context
        if ctx_vecs:
            ctx_scores = [_cosine_sim(q_vec, c) for c in ctx_vecs]
            context_relevance = float(np.mean(ctx_scores))
        else:
            context_relevance = 0.0

        # ── Metric 2: Answer Relevance ────────────────────────────────────
        # Câu trả lời có liên quan đến câu hỏi không?
        # → Similarity giữa câu hỏi và câu trả lời
        answer_relevance = _cosine_sim(q_vec, a_vec)

        # ── Metric 3: Faithfulness ────────────────────────────────────────
        # Câu trả lời có bám vào context không?
        # → Max similarity giữa câu trả lời và từng context
        # Nếu cao: câu trả lời xuất phát từ context (không hallucinate)
        # Nếu thấp: LLM có thể đang tự bịa
        if ctx_vecs:
            faith_scores = [_cosine_sim(a_vec, c) for c in ctx_vecs]
            faithfulness = float(max(faith_scores))  # max thay vì mean — chỉ cần 1 context hỗ trợ
        else:
            faithfulness = 0.0

        # ── Overall Score (trọng số: faithfulness quan trọng nhất) ────────
        overall = (faithfulness * 0.5) + (answer_relevance * 0.3) + (context_relevance * 0.2)

        # ── Verdict ───────────────────────────────────────────────────────
        if overall >= PASS_THRESHOLD and faithfulness >= WARN_THRESHOLD:
            verdict = "PASS"
        elif overall >= WARN_THRESHOLD:
            verdict = "WARN"
        else:
            verdict = "FAIL"

        # Chi tiết để debug
        details = (
            f"Faithfulness={faithfulness:.3f} (câu trả lời bám context), "
            f"AnswerRelevance={answer_relevance:.3f} (liên quan câu hỏi), "
            f"ContextRelevance={context_relevance:.3f} (context đúng chủ đề)"
        )

        logger.info(
            "[EvalService] %s | overall=%.3f faith=%.3f rel=%.3f ctx=%.3f",
            verdict, overall, faithfulness, answer_relevance, context_relevance
        )

        return EvalMetrics(
            faithfulness=round(faithfulness, 4),
            answer_relevance=round(answer_relevance, 4),
            context_relevance=round(context_relevance, 4),
            overall_score=round(overall, 4),
            verdict=verdict,
            details=details,
        )
