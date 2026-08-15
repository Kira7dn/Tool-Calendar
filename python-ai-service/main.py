"""
Tool-Calendar Python AI Service — v3.0
Kỹ thuật từ: llama.cpp + gpt-researcher + anything-llm + SGLang + Docling + Khoj + Dify

Endpoints:
  GET  /health                 — Health check + RadixCache metrics
  POST /api/embed              — Embed 1 text (RadixCache + L2 normalize)
  POST /api/embed/batch        — Batch embed (llama.cpp server_batch)
  POST /api/compress           — RAG pipeline 3 bước: Embed→Hybrid→Rerank
  POST /api/chunk              — Smart chunker với metadata (anything-llm)
  POST /api/rerank             — CrossEncoder reranker (Khoj)
  POST /api/hybrid-search      — BM25 + Semantic hybrid (Dify)
  POST /api/extract            — Document extractor (Docling)
  GET  /api/cache/stats        — RadixTree cache statistics (SGLang)
  POST /api/chat               — Stream chat qua Ollama

Architecture (v3.0):
  - AsyncBatchEmbedder   (llama.cpp server_batch)
  - RadixPrefixCache     (SGLang radix_cache + SLRU eviction)
  - ContextCompressor    (gpt-researcher EmbeddingsFilter)
  - SmartTextChunker     (anything-llm TextSplitter + ChunkHeaderMeta)
  - HybridRetriever      (Dify BM25 + Semantic weighted merge)
  - CrossEncoderReranker (Khoj mxbai-rerank, Dify score_threshold)
  - DoclingExtractor     (Docling PDF/Word/Excel structured parse)
"""

import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from embeddings.batch_processor import AsyncBatchEmbedder
from embeddings.semantic_embedder import get_embedder
from llm_provider.ollama_client import OllamaClient
from llm_provider.radix_cache import get_radix_cache  # SGLang RadixTree
from rag.chunker import SmartTextChunker
from rag.compressor import ContextCompressor
from rag.docling_extractor import get_docling_extractor  # Docling
from rag.hybrid_retriever import HybridRetriever  # Dify
from rag.reranker import get_reranker  # Khoj

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
_hybrid_retriever: Optional[HybridRetriever] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown lifecycle — học từ FastAPI lifespan pattern"""
    global _batch_embedder, _ollama_client, _chunker, _compressor

    logger.info("=== Tool-Calendar AI Service v2.0 Starting ===")

    # Load model
    embedder_model = get_embedder()
    logger.info("Model: %s | Dim: %d", embedder_model.model_name, embedder_model.embedding_dim)

    # Khởi động Batch Embedder (llama.cpp server_batch pattern)
    _batch_embedder = AsyncBatchEmbedder(embedder_model.model)
    _batch_embedder.start()

    # Khởi động các services
    _ollama_client = OllamaClient()
    _chunker = SmartTextChunker(chunk_size=800, chunk_overlap=100)
    _compressor = ContextCompressor(
        embedder=_batch_embedder,
        chunker=_chunker,
        similarity_threshold=0.65,
        max_results=8,
    )

    logger.info("=== AI Service Ready ===")
    yield

    # Shutdown
    if _batch_embedder:
        _batch_embedder.stop()
    logger.info("=== AI Service Stopped ===")


app = FastAPI(
    title="Tool-Calendar AI Service",
    description="Python AI Service với kỹ thuật từ llama.cpp, gpt-researcher, anything-llm",
    version="2.0.0",
    lifespan=lifespan,
)


# ===== Request / Response Models =====

class EmbedRequest(BaseModel):
    text: str
    normalize: bool = True  # L2 normalize mặc định (llama.cpp embd_normalize=2)
    use_cache: bool = True  # Dùng PromptEmbeddingCache (llama.cpp cache_prompt)


class EmbedResponse(BaseModel):
    vector: list[float]
    cached: bool = False
    dim: int = 0


class BatchEmbedRequest(BaseModel):
    texts: list[str]
    normalize: bool = True


class BatchEmbedResponse(BaseModel):
    vectors: list[list[float]]
    count: int


class CompressRequest(BaseModel):
    query: str
    documents: list[dict]  # [{text, title, date, source, id}]
    max_results: int = 8
    similarity_threshold: Optional[float] = None  # Override default 0.65


class CompressResponse(BaseModel):
    chunks: list[dict]
    total_chunks_evaluated: int = 0
    context_string: str = ""  # Dùng thẳng vào LLM prompt


class ExtractRequest(BaseModel):
    file_path: str


class RerankRequest(BaseModel):
    query: str
    chunks: list[dict]
    top_n: int = 5
    score_threshold: Optional[float] = None


class HybridSearchRequest(BaseModel):
    query: str
    chunks: list[dict]
    top_n: int = 5
    keyword_weight: float = 0.3
    semantic_weight: float = 0.7


class ChunkRequest(BaseModel):
    text: str
    doc_title: str = ""
    doc_date: str = ""
    doc_source: str = ""
    doc_id: Optional[int] = None
    chunk_size: int = 800
    chunk_overlap: int = 100


class ChunkResponse(BaseModel):
    chunks: list[dict]
    total_chunks: int


class ChatRequest(BaseModel):
    model: str = "qwen2.5:3b"
    messages: list[dict]


# ===== Endpoints =====

@app.get("/health")
def health_check():
    """Health check + cache metrics — học từ llama.cpp /metrics endpoint"""
    cache_stats = _radix_cache.stats()
    embedder = get_embedder()
    return {
        "status": "ok",
        "service": "toolcalendar-ai-service",
        "version": "3.0.0",
        "model": embedder.model_name,
        "embedding_dim": embedder.embedding_dim,
        "radix_cache": cache_stats,
    }

@app.get("/api/cache/stats")
def cache_stats():
    """RadixTree cache statistics (SGLang)"""
    return _radix_cache.stats()


@app.post("/api/embed", response_model=EmbedResponse)
async def embed_text(request: EmbedRequest):
    """
    Embed 1 text với LRU cache + L2 normalize.
    Cache hit → trả về ngay không cần chạy model (llama.cpp cache_prompt).
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    # Kiểm tra cache trước (llama.cpp cache_prompt = true)
    if request.use_cache:
        cached = _prompt_cache.get(request.text)
        if cached is not None:
            return EmbedResponse(vector=cached, cached=True, dim=len(cached))

    # Embed qua batch processor
    try:
        vector = await _batch_embedder.embed(request.text, normalize=request.normalize)
    except Exception as e:
        logger.error("[/api/embed] Error: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to generate embedding")

    # Lưu cache
    if request.use_cache:
        _radix_cache.put(request.text, vector)

    return EmbedResponse(vector=vector, cached=False, dim=len(vector))


@app.post("/api/embed/batch", response_model=BatchEmbedResponse)
async def embed_batch(request: BatchEmbedRequest):
    """
    Embed nhiều texts cùng lúc — batch inference (llama.cpp server_batch).
    Nhanh hơn gọi /api/embed N lần khoảng 3-5x.
    """
    if not request.texts:
        raise HTTPException(status_code=400, detail="Texts list cannot be empty")
    if len(request.texts) > 100:
        raise HTTPException(status_code=400, detail="Max 100 texts per batch")

    # Kiểm tra cache cho từng text
    vectors = []
    texts_to_embed = []
    indices_to_embed = []

    for i, text in enumerate(request.texts):
        if not text or not text.strip():
            vectors.append([])
            continue
        cached = _radix_cache.get(text)
        if cached is not None:
            vectors.append(cached)
        else:
            vectors.append(None)  # placeholder
            texts_to_embed.append(text)
            indices_to_embed.append(i)

    # Embed các text chưa có cache
    if texts_to_embed:
        try:
            new_vectors = await _batch_embedder.embed_batch(texts_to_embed, normalize=request.normalize)
            for idx, vec in zip(indices_to_embed, new_vectors):
                vectors[idx] = vec
                _radix_cache.put(request.texts[idx], vec)
        except Exception as e:
            logger.error("[/api/embed/batch] Error: %s", str(e))
            raise HTTPException(status_code=500, detail="Failed to generate batch embeddings")

    # Fill empty lists cho texts rỗng
    final_vectors = [v if v is not None else [] for v in vectors]

    return BatchEmbedResponse(vectors=final_vectors, count=len(final_vectors))


@app.post("/api/compress", response_model=CompressResponse)
async def compress_context(request: CompressRequest):
    """
    RAG Context Compression — học từ gpt-researcher ContextCompressor.

    Nhận danh sách documents + query → trả về top-K chunks liên quan nhất.
    C# dùng endpoint này để lấy context chính xác trước khi gọi LLM.
    """
    if not request.query or not request.documents:
        raise HTTPException(status_code=400, detail="query and documents required")

    # Override threshold nếu có
    compressor = _compressor
    if request.similarity_threshold is not None:
        from rag.compressor import ContextCompressor
        compressor = ContextCompressor(
            embedder=_batch_embedder,
            chunker=_chunker,
            similarity_threshold=request.similarity_threshold,
            max_results=request.max_results,
        )

    try:
        chunks = await compressor.compress(
            query=request.query,
            documents=request.documents,
            max_results=request.max_results,
        )
    except Exception as e:
        logger.error("[/api/compress] Error: %s", str(e))
        raise HTTPException(status_code=500, detail="Compression failed")

    # Tạo context string gộp (dùng thẳng vào LLM prompt)
    if chunks:
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            context_parts.append(
                f"[Đoạn {i} - Liên quan: {chunk['score']:.0%}]\n{chunk['content']}"
            )
        context_string = "\n\n---\n\n".join(context_parts)
    else:
        context_string = ""

    return CompressResponse(
        chunks=chunks,
        total_chunks_evaluated=0,  # Filled by compressor internally
        context_string=context_string,
    )


@app.post("/api/extract")
def extract_document(request: ExtractRequest):
    """
    Document Extractor — học từ Docling.
    Thay thế cho PaddleOCR: giữ được cấu trúc bảng biểu, heading, hỗ trợ PDF/Word/Excel.
    """
    if not _docling.is_available:
        raise HTTPException(status_code=503, detail="Docling not installed")
    
    result = _docling.extract(request.file_path)
    if result.error:
        logger.error("[/api/extract] Error: %s", result.error)
        raise HTTPException(status_code=500, detail=result.error)
        
    return result.to_dict()


@app.post("/api/rerank")
def rerank_chunks(request: RerankRequest):
    """
    CrossEncoder Reranker — học từ Khoj.
    Rerank danh sách chunks dựa trên query bằng model CrossEncoder để tăng độ chính xác.
    """
    reranker = get_reranker()
    try:
        results = reranker.rerank(
            query=request.query,
            chunks=request.chunks,
            top_n=request.top_n,
            score_threshold=request.score_threshold
        )
        return {"chunks": results, "count": len(results)}
    except Exception as e:
        logger.error("[/api/rerank] Error: %s", str(e))
        raise HTTPException(status_code=500, detail="Reranking failed")


@app.post("/api/hybrid-search")
def hybrid_search(request: HybridSearchRequest):
    """
    Hybrid Search (BM25 + Semantic) — học từ Dify.
    Merge BM25 keyword score và semantic score để tìm kiếm tốt hơn với các identifier.
    """
    if not _hybrid_retriever:
        from rag.hybrid_retriever import HybridRetriever
        hybrid = HybridRetriever(
            keyword_weight=request.keyword_weight,
            semantic_weight=request.semantic_weight
        )
    else:
        hybrid = _hybrid_retriever
        
    try:
        results = hybrid.rerank(
            query=request.query,
            chunks=request.chunks,
            top_n=request.top_n
        )
        return {"chunks": results, "count": len(results)}
    except Exception as e:
        logger.error("[/api/hybrid-search] Error: %s", str(e))
        raise HTTPException(status_code=500, detail="Hybrid search failed")



@app.post("/api/chunk", response_model=ChunkResponse)
def chunk_document(request: ChunkRequest):
    """
    Chia text thành chunks có metadata — học từ anything-llm TextSplitter.
    Dùng để chuẩn bị document trước khi index vào vector DB.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    chunker = SmartTextChunker(
        chunk_size=request.chunk_size,
        chunk_overlap=request.chunk_overlap,
    )

    chunks = chunker.chunk_document(
        text=request.text,
        doc_title=request.doc_title,
        doc_date=request.doc_date,
        doc_source=request.doc_source,
        doc_id=request.doc_id,
    )

    return ChunkResponse(
        chunks=[c.to_dict() for c in chunks],
        total_chunks=len(chunks),
    )


@app.post("/api/chat")
async def chat_stream(request: ChatRequest):
    """Stream chat qua Ollama (giữ nguyên từ v1.0)"""
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty")

    try:
        return StreamingResponse(
            _ollama_client.stream_chat(request.model, request.messages),
            media_type="text/plain",
        )
    except Exception as e:
        logger.error("[/api/chat] Error: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to process chat request")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
