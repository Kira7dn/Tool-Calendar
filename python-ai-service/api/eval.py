from fastapi import APIRouter, Depends, Request
from schemas.eval import EvalRequest, EvalMetrics
from services.eval_service import EvalService

router = APIRouter()

def get_eval_service(request: Request) -> EvalService:
    return EvalService(batch_embedder=request.app.state.embedder)

@router.post("/api/eval", response_model=EvalMetrics)
async def evaluate_rag(request: EvalRequest, svc: EvalService = Depends(get_eval_service)):
    """
    Đánh giá RAG response offline bằng Cosine Similarity.
    Trả về faithfulness, answer relevance, context relevance.
    """
    return await svc.evaluate(request)
