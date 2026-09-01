"""
Tool-Calendar Python AI Service — v3.1
"""

import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from embeddings.batch_processor import AsyncBatchEmbedder
from embeddings.semantic_embedder import get_embedder
from llm_provider.ollama_client import OllamaClient, get_chat_queue_manager
from llm_provider.radix_cache import get_radix_cache
from rag.chunker import SmartTextChunker
from rag.compressor import ContextCompressor
from rag.docling_extractor import get_docling_extractor
from rag.hybrid_retriever import HybridRetriever
from rag.reranker import get_reranker

from api.router import api_router
from api.auth_middleware import register_auth_middleware
from api.exception_handler import register_exception_handlers
from config import get_settings
from exceptions import AiClientError, AiServerError

# Configure logging — fix R-O05: thêm ngày vào datefmt
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ===== Global instances =====
_batch_embedder: Optional[AsyncBatchEmbedder] = None
_ollama_client: Optional[OllamaClient] = None
_chunker: Optional[SmartTextChunker] = None
_compressor: Optional[ContextCompressor] = None
_radix_cache = get_radix_cache()
_docling = get_docling_extractor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown lifecycle"""
    global _batch_embedder, _ollama_client, _chunker, _compressor

    settings = get_settings()
    logger.info("=== Tool-Calendar AI Service v3.1 Starting ===")

    # Load embedding model
    embedder_model = get_embedder()
    logger.info("Model: %s | Dim: %d", embedder_model.model_name, embedder_model.embedding_dim)

    # Batch Embedder (llama.cpp server_batch pattern)
    _batch_embedder = AsyncBatchEmbedder(embedder_model.model)
    _batch_embedder.start()

    # Model Warm-Up
    logger.info("Warming up embedding model...")
    try:
        await _batch_embedder.embed("warm up", normalize=True)
        logger.info("Model warm-up complete.")
    except Exception as e:
        logger.warning("Model warm-up failed: %s", str(e))

    # Khởi động các services — đọc từ Settings thay vì hardcode
    _ollama_client = OllamaClient(base_url=settings.ollama_url)
    _chunker = SmartTextChunker(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    _compressor = ContextCompressor(
        embedder=_batch_embedder,
        chunker=_chunker,
        similarity_threshold=settings.similarity_threshold,
        max_results=settings.max_compress_results,
    )

    # Inject dependencies vào app.state
    app.state.embedder = _batch_embedder
    app.state.ollama_client = _ollama_client
    app.state.chunker = _chunker
    app.state.compressor = _compressor
    app.state.radix_cache = _radix_cache
    app.state.docling = _docling
    app.state.settings = settings  # Fix: inject settings thật thay vì None

    # ── Ollama LLM Warm-Up ────────────────────────────────────────────────
    # Gọi 1 câu dummy để Ollama load model vào RAM ngay khi service khởi động.
    # Không có bước này → câu hỏi đầu tiên bị cold start 25-30 giây.
    logger.info("Warming up Ollama LLM model (loading into RAM)...")
    try:
        warmup_msg = [{"role": "user", "content": "Xin chào"}]
        warmup_response = await _ollama_client.chat(
            model=settings.llm_model,
            messages=warmup_msg,
            format="",  # Không ép JSON format cho warm-up
        )
        logger.info(
            "Ollama LLM warm-up complete. Model '%s' loaded into RAM. Response preview: '%s'",
            settings.llm_model,
            (warmup_response or "")[:30],
        )
    except Exception as e:
        logger.warning(
            "Ollama LLM warm-up failed (Ollama chưa sẵn sàng?): %s — "
            "Câu hỏi đầu tiên sẽ chậm hơn bình thường.",
            str(e),
        )
    # ─────────────────────────────────────────────────────────────────────

    logger.info("=== AI Service Ready ===")
    yield

    # Shutdown
    if _batch_embedder:
        _batch_embedder.stop()
    logger.info("=== AI Service Stopped ===")


app = FastAPI(
    title="Tool-Calendar AI Service",
    description="Python AI Service với kỹ thuật từ llama.cpp, gpt-researcher, anything-llm",
    version="3.1.0",
    lifespan=lifespan,
)

# Exception handlers
register_exception_handlers(app)

# Tracing middleware
from api.tracing_middleware import register_tracing_middleware
register_tracing_middleware(app)

# Auth middleware (X-API-Key) — bỏ qua nếu api_secret_key rỗng
settings = get_settings()
register_auth_middleware(app, settings.api_secret_key)

# Health endpoint
@app.get("/health")
def health_check():
    """Health check + cache metrics + chat queue stats"""
    cache_stats = _radix_cache.stats()
    embedder = get_embedder()
    queue_mgr = get_chat_queue_manager()

    # Kiểm tra trạng thái thực sự thay vì luôn "ok"
    embedder_ready = _batch_embedder is not None and _batch_embedder._worker_task is not None
    ollama_ready = _ollama_client is not None

    return {
        "status": "ok" if (embedder_ready and ollama_ready) else "degraded",
        "service": "toolcalendar-ai-service",
        "version": "3.1.0",
        "model": embedder.model_name,
        "embedding_dim": embedder.embedding_dim,
        "embedder_ready": embedder_ready,
        "ollama_ready": ollama_ready,
        "radix_cache": cache_stats,
        "chat_queue": {
            "waiting": queue_mgr.queue_depth,
            "max_concurrent": 4,
            "max_queue": 100,
        },
    }


# Cache management endpoint — fix R-C01: /api/cache/clear trả 500
@app.post("/api/cache/clear")
def clear_cache():
    """Xóa embedding cache — dùng khi đổi model"""
    _radix_cache.clear()
    return {"status": "cleared", "message": "Embedding cache đã được xóa"}


@app.get("/api/cache/stats")
def cache_stats():
    """Cache statistics"""
    return _radix_cache.stats()


# Include all API routes
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
