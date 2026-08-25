"""
Tool-Calendar Python AI Service — v3.0
Kỹ thuật từ: llama.cpp + gpt-researcher + anything-llm + SGLang + Docling + Khoj + Dify
"""

import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from embeddings.batch_processor import AsyncBatchEmbedder
from embeddings.semantic_embedder import get_embedder
from llm_provider.ollama_client import OllamaClient, get_chat_queue_manager
from llm_provider.radix_cache import get_radix_cache  # SGLang RadixTree
from rag.chunker import SmartTextChunker
from rag.compressor import ContextCompressor
from rag.docling_extractor import get_docling_extractor  # Docling
from rag.hybrid_retriever import HybridRetriever  # Dify
from rag.reranker import get_reranker  # Khoj

# Import the new main API router
from api.router import api_router

from exceptions import AiClientError, AiServerError
from api.exception_handler import register_exception_handlers

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ===== Global instances =====
_batch_embedder: Optional[AsyncBatchEmbedder] = None
_ollama_client: Optional[OllamaClient] = None
_chunker: Optional[SmartTextChunker] = None
_compressor: Optional[ContextCompressor] = None
_radix_cache = get_radix_cache()  # SGLang RadixTree — thay PromptCache
_docling = get_docling_extractor()  # Docling (lazy)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown lifecycle — học từ FastAPI lifespan pattern"""
    global _batch_embedder, _ollama_client, _chunker, _compressor

    logger.info("=== Tool-Calendar AI Service v3.0 Starting ===")

    # Load model
    embedder_model = get_embedder()
    logger.info("Model: %s | Dim: %d", embedder_model.model_name, embedder_model.embedding_dim)

    # Khởi động Batch Embedder (llama.cpp server_batch pattern)
    _batch_embedder = AsyncBatchEmbedder(embedder_model.model)
    _batch_embedder.start()

    # ── Model Warm-Up (AnythingLLM, Khoj) ──
    logger.info("Warming up embedding model...")
    try:
        await _batch_embedder.embed("warm up", normalize=True)
        logger.info("Model warm-up complete.")
    except Exception as e:
        logger.warning("Model warm-up failed: %s", str(e))

    # Khởi động các services
    _ollama_client = OllamaClient(base_url=settings.ollama_url)
    _chunker = SmartTextChunker(chunk_size=800, chunk_overlap=100)
    _compressor = ContextCompressor(
        embedder=_batch_embedder,
        chunker=_chunker,
        similarity_threshold=0.65,
        max_results=8,
    )

    # Inject dependencies into app.state for routers to use
    app.state.embedder = _batch_embedder
    app.state.ollama_client = _ollama_client
    app.state.chunker = _chunker
    app.state.compressor = _compressor
    app.state.radix_cache = _radix_cache
    app.state.docling = _docling
    app.state.settings = None # Can be initialized with config.Settings() if needed

    logger.info("=== AI Service Ready ===")
    yield

    # Shutdown
    if _batch_embedder:
        _batch_embedder.stop()
    logger.info("=== AI Service Stopped ===")


app = FastAPI(
    title="Tool-Calendar AI Service",
    description="Python AI Service với kỹ thuật từ llama.cpp, gpt-researcher, anything-llm",
    version="3.0.0",
    lifespan=lifespan,
)

# Exception handlers
register_exception_handlers(app)

# Health endpoint (kept at root for simple access)
@app.get("/health")
def health_check():
    """Health check + cache metrics + chat queue stats"""
    cache_stats = _radix_cache.stats()
    embedder = get_embedder()
    queue_mgr = get_chat_queue_manager()
    return {
        "status": "ok",
        "service": "toolcalendar-ai-service",
        "version": "3.1.0",
        "model": embedder.model_name,
        "embedding_dim": embedder.embedding_dim,
        "radix_cache": cache_stats,
        "chat_queue": {
            "waiting": queue_mgr.queue_depth,
            "max_concurrent": 4,
            "max_queue": 100,
        },
    }

# Include all API routes from routers
app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
