from fastapi import APIRouter, Depends, Request
from schemas import EmbedRequest, EmbedResponse, BatchEmbedRequest, BatchEmbedResponse
from services.embed_service import EmbedService

router = APIRouter()

def get_embed_service(request: Request) -> EmbedService:
    return EmbedService(
        embedder=request.app.state.embedder,
        radix_cache=request.app.state.radix_cache
    )

@router.post("/api/embed", response_model=EmbedResponse)
async def embed_text(request: EmbedRequest, svc: EmbedService = Depends(get_embed_service)):
    return await svc.embed(request)

@router.post("/api/embed/batch", response_model=BatchEmbedResponse)
async def embed_batch(request: BatchEmbedRequest, svc: EmbedService = Depends(get_embed_service)):
    return await svc.embed_batch(request)

@router.get("/api/cache/stats")
async def cache_stats(svc: EmbedService = Depends(get_embed_service)):
    return svc.cache_stats()

@router.delete("/api/cache/clear")
async def clear_embed_cache(request: Request):
    """Xóa Embedding Cache (dùng khi cần invalidate sau khi model thay đổi)"""
    request.app.state.radix_cache.clear()
    return {"status": "ok", "message": "Cache cleared"}
