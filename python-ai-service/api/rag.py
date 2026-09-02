import asyncio
from fastapi import APIRouter, Depends, Request
from schemas import CompressRequest, CompressResponse, RerankRequest, HybridSearchRequest, ChunkRequest, ChunkResponse
from services.rag_service import RagService

router = APIRouter()

def get_rag_service(request: Request) -> RagService:
    return RagService(
        compressor=request.app.state.compressor,
        chunker=request.app.state.chunker,
        batch_embedder=request.app.state.embedder
    )

@router.post("/api/compress", response_model=CompressResponse)
async def compress_context(request: CompressRequest, svc: RagService = Depends(get_rag_service)):
    return await svc.compress_context(request)

@router.post("/api/chunk", response_model=ChunkResponse)
async def chunk_document(request: ChunkRequest, svc: RagService = Depends(get_rag_service)):
    # CPU-bound: dùng asyncio.to_thread để không block event loop
    return await asyncio.to_thread(svc.chunk_document, request)

@router.post("/api/rerank")
async def rerank_chunks(request: RerankRequest, svc: RagService = Depends(get_rag_service)):
    # CPU-bound (Cross-Encoder model): chạy trong thread pool
    return await asyncio.to_thread(svc.rerank_chunks, request)

@router.post("/api/hybrid-search")
async def hybrid_search(request: HybridSearchRequest, svc: RagService = Depends(get_rag_service)):
    # CPU-bound (BM25 + cosine scoring): chạy trong thread pool
    return await asyncio.to_thread(svc.hybrid_search, request)
