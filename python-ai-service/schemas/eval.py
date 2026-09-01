from pydantic import BaseModel, Field
from typing import Optional


class EvalRequest(BaseModel):
    """
    Input để đánh giá chất lượng một câu trả lời RAG.
    Không cần ground truth — tự đo bằng similarity.
    """
    question: str = Field(..., max_length=2000)
    answer: str = Field(..., max_length=10000)
    contexts: list[str] = Field(..., max_length=20)  # Các đoạn chunk được retrieve


class EvalMetrics(BaseModel):
    """Kết quả đánh giá RAG theo 3 chiều."""

    # Faithfulness: câu trả lời có bám vào context không?
    # 1.0 = câu trả lời hoàn toàn từ context, 0.0 = bịa hoàn toàn
    faithfulness: float

    # Answer Relevance: câu trả lời có liên quan đến câu hỏi không?
    # 1.0 = cực kỳ liên quan, 0.0 = không liên quan
    answer_relevance: float

    # Context Relevance: các context được retrieve có liên quan đến câu hỏi không?
    # 1.0 = context tốt, 0.0 = retrieve sai hoàn toàn
    context_relevance: float

    # Score tổng hợp (trung bình có trọng số)
    overall_score: float

    # Đánh giá ngắn gọn
    verdict: str  # "PASS" | "WARN" | "FAIL"
    details: Optional[str] = None
