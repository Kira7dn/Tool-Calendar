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

    # ── Model Warm-Up (AnythingLLM, Khoj) ──
    logger.info("Warming up embedding model...")
    try:
        await _batch_embedder.embed("warm up", normalize=True)
        logger.info("Model warm-up complete.")
    except Exception as e:
        logger.warning("Model warm-up failed: %s", str(e))

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

class ParseDateRequest(BaseModel):
    text: str

class ParseDateResponse(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class GenerateQARequest(BaseModel):
    text: str
    model: str = "qwen2.5:3b"

class GenerateQAResponse(BaseModel):
    qa_pairs: list[str]

class HyDERequest(BaseModel):
    question: str
    model: str = "qwen2.5:3b"

class HyDEResponse(BaseModel):
    hypothetical_document: str
    vector: list[float]

class ContextualChunkRequest(BaseModel):
    text: str               # Nội dung chunk
    doc_title: str = ""
    doc_summary: str = ""   # Tóm tắt document — được sinh trước
    model: str = "qwen2.5:3b"

class ContextualChunkResponse(BaseModel):
    contextual_text: str    # chunk + context sentence ghép lại
    context_sentence: str   # câu context LLM sinh ra

class DocSummaryRequest(BaseModel):
    text: str
    doc_title: str = ""
    model: str = "qwen2.5:3b"

class DocSummaryResponse(BaseModel):
    summary: str
    summary_vector: list[float]

class ExtractKeywordsRequest(BaseModel):
    text: str
    doc_title: str = ""
    model: str = "qwen2.5:3b"

class ExtractKeywordsResponse(BaseModel):
    keywords: list[str]

class ExtractMetadataRequest(BaseModel):
    text: str
    model: str = "qwen2.5:3b"

class ExtractMetadataResponse(BaseModel):
    SoVanBan: str = ""
    TenCongVan: str = ""
    TrichYeu: str = ""
    NgayBanHanh: str = ""
    ThoiHan: str = ""
    CoQuanBanHanh: str = ""
    CoQuanChuQuan: str = ""
    Priority: str = "Thường"

# ===== Embedding Cache (SGLang RadixCache-inspired) =====
_embed_cache: dict[str, list[float]] = {}
EMBED_CACHE_MAX_SIZE = 2000  # Tối đa 2000 entries trong memory

# ===== Endpoints =====

@app.post("/api/parse-date", response_model=ParseDateResponse)
def parse_date_endpoint(request: ParseDateRequest):
    """Parse natural language date (Khoj DateFilter)"""
    from rag.date_parser import parse_vietnamese_date
    start_d, end_d = parse_vietnamese_date(request.text)
    return ParseDateResponse(
        start_date=start_d.strftime("%Y-%m-%d") if start_d else None,
        end_date=end_d.strftime("%Y-%m-%d") if end_d else None,
    )

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
        cached = _radix_cache.get(request.text)
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


@app.post("/api/contextual-chunk", response_model=ContextualChunkResponse)
async def contextual_chunk(request: ContextualChunkRequest):
    """
    Contextual Retrieval — học từ Anthropic blog (Sep 2024).

    Vấn đề: Khi chunk riêng lẻ, nó mất đi context của document gốc.
    VD: "Biện pháp này được thực hiện từ ngày 01/01/2024" — "biện pháp nào?" → mất context.

    Giải pháp: Dùng LLM sinh 1-2 câu mô tả vị trí chunk trong document,
    rồi prepend câu đó vào đầu chunk trước khi embed.

    Kết quả: Recall tăng ~49% theo benchmark Anthropic.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Chunk text cannot be empty")

    # Xây dựng prompt Contextual Retrieval
    doc_context = f"Tài liệu: {request.doc_title}" if request.doc_title else "một công văn/tài liệu"
    summary_context = f"\n\nTóm tắt tài liệu:\n{request.doc_summary}" if request.doc_summary else ""

    prompt = f"""Bạn đang xử lý {doc_context}.{summary_context}

Đây là đoạn văn bản cần xử lý:
<chunk>
{request.text[:1000]}
</chunk>

Hãy viết 1-2 câu ngắn gọn mô tả vị trí và nội dung của đoạn này trong bối cảnh toàn bộ tài liệu.
Mục tiêu: giúp người đọc hiểu đoạn này thuộc phần nào của tài liệu, bàn về vấn đề gì.
KHÔNG diễn giải lại nội dung. CHỈ mô tả context (vị trí trong tài liệu).
Trả lời bằng tiếng Việt, ngắn gọn."""

    try:
        messages = [{"role": "user", "content": prompt}]
        context_sentence = await _ollama_client.chat(request.model, messages, format=None)
        if not context_sentence:
            context_sentence = ""

        # Ghép context sentence vào đầu chunk — đây là kỹ thuật Anthropic
        contextual_text = f"{context_sentence.strip()}\n\n{request.text}" if context_sentence.strip() else request.text

        return ContextualChunkResponse(
            contextual_text=contextual_text,
            context_sentence=context_sentence.strip()
        )
    except Exception as e:
        logger.error("[/api/contextual-chunk] Error: %s", str(e))
        # Graceful fallback — trả về chunk gốc nếu lỗi LLM
        return ContextualChunkResponse(
            contextual_text=request.text,
            context_sentence=""
        )


@app.post("/api/doc-summary", response_model=DocSummaryResponse)
async def doc_summary(request: DocSummaryRequest):
    """
    RAPTOR-inspired Document Summary Index.

    Sinh tóm tắt toàn bộ document, embed nó, trả về cả summary text và vector.
    C# dùng để:
    1. Lưu summary như 1 special chunk (để answer broad questions về toàn document)
    2. Dùng summary text làm doc_summary khi gọi /api/contextual-chunk

    Học từ RAPTOR paper: Recursive Abstractive Processing for Tree-Organized Retrieval.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Document text cannot be empty")

    # Cắt bớt nếu quá dài (LLM có context limit)
    text_for_summary = request.text[:4000] if len(request.text) > 4000 else request.text
    doc_context = f"'{request.doc_title}'" if request.doc_title else "tài liệu"

    prompt = f"""Hãy tóm tắt ngắn gọn (3-5 câu) nội dung chính của {doc_context} sau đây.
Tóm tắt phải bao gồm: chủ thể ban hành, mục đích chính, các nội dung/yêu cầu quan trọng.
Viết bằng tiếng Việt, ngắn gọn súc tích.

Nội dung:
{text_for_summary}"""

    try:
        messages = [{"role": "user", "content": prompt}]
        summary_text = await _ollama_client.chat(request.model, messages, format=None)
        if not summary_text:
            # Fallback: lấy 300 ký tự đầu
            summary_text = request.text[:300].strip()

        # Embed summary
        summary_vector = await _batch_embedder.embed(summary_text, normalize=True)

        return DocSummaryResponse(
            summary=summary_text.strip(),
            summary_vector=summary_vector
        )
    except Exception as e:
        logger.error("[/api/doc-summary] Error: %s", str(e))
        raise HTTPException(status_code=500, detail="Document summarization failed")


@app.delete("/api/cache/clear")
async def clear_embed_cache():
    """Xóa Embedding Cache (dùng khi cần invalidate sau khi model thay đổi)"""
    global _embed_cache
    count = len(_embed_cache)
    _embed_cache.clear()
    # Cũng clear RadixCache
    _radix_cache.cache.clear()
    logger.info("[Cache] Cleared %d embedding cache entries", count)
    return {"cleared": count, "status": "ok"}


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


@app.post("/api/generate-qa", response_model=GenerateQAResponse)
async def generate_qa(request: GenerateQARequest):
    """Sử dụng Ollama để sinh câu hỏi-đáp từ đoạn văn bản."""
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
        
    prompt = f"""Bạn là một chuyên gia phân tích công văn. Hãy đọc đoạn văn bản sau và tạo ra 3-5 cặp Câu hỏi - Câu trả lời (QA) quan trọng nhất.
Trả về KẾT QUẢ DƯỚI DẠNG JSON MẢNG chứa các chuỗi QA theo định dạng: ["Q: Câu hỏi 1 - A: Câu trả lời 1", "Q: Câu hỏi 2 - A: Câu trả lời 2"]. 
KHÔNG giải thích thêm.
Đoạn văn bản:
{request.text}"""
    
    try:
        import json
        messages = [{"role": "user", "content": prompt}]
        response_text = await _ollama_client.chat(request.model, messages, format="json")
        
        # Parse JSON
        qa_pairs = []
        try:
            parsed = json.loads(response_text)
            if isinstance(parsed, list):
                qa_pairs = [str(x) for x in parsed]
            elif isinstance(parsed, dict) and "qa_pairs" in parsed:
                qa_pairs = [str(x) for x in parsed["qa_pairs"]]
        except json.JSONDecodeError:
            pass
            
        return {"qa_pairs": qa_pairs}
    except Exception as e:
        logger.error("[/api/generate-qa] Error: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to generate QA pairs")

@app.post("/api/extract-metadata", response_model=ExtractMetadataResponse)
async def extract_metadata(request: ExtractMetadataRequest):
    """Bóc tách siêu dữ liệu từ văn bản thô bằng Regex (siêu nhanh & không ảo giác)."""
    import re
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    # ── Helper: Regex (100% offline, siêu nhanh 0.01s, chống ảo giác) ──────────────
    def _regex_extract(text: str) -> dict:
        result = {
            "SoVanBan": "", "TenCongVan": "CÔNG VĂN", "TrichYeu": "",
            "NgayBanHanh": "", "ThoiHan": "", "CoQuanBanHanh": "",
            "CoQuanChuQuan": "", "Priority": "Thường"
        }
        
        # 1. Số văn bản: vd "3206 /SKHCN-BCVT&TĐC"
        m = re.search(
            r'(?:Số|SỐ)[:\s]+([0-9]+[\s]*[/-][A-Z0-9ĐÀ-Ỵà-ỵ&]+(?:[-/][A-Z0-9ĐÀ-Ỵà-ỵ&]+)*)',
            text, re.IGNORECASE)
        if m:
            result["SoVanBan"] = m.group(1).strip().replace(" ", "")

        # 2. Ngày ban hành
        m = re.search(r'ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})', text, re.IGNORECASE)
        if m:
            d, mo, y = m.groups()
            result["NgayBanHanh"] = f"{y}-{int(mo):02d}-{int(d):02d}"

        # 3. Trích yếu: lấy sau "V/v" hoặc "Về việc"
        m = re.search(r'(?:V/v|Về việc)[:\s]*(.+?)(?=\nKính gửi|\n\n|\r\n\r\n|Kính gửi:)', text, re.IGNORECASE | re.DOTALL)
        if m:
            ty = re.sub(r'\s+', ' ', m.group(1)).strip()
            # Loại bỏ đoạn "Quảng Ninh, ngày..." lọt vào nếu có
            ty = re.sub(r'[A-ZÀ-Ỵa-zà-ỵ\s]+,\s*ngày.*$', '', ty).strip()
            result["TrichYeu"] = ty[:500]

        # 4. Cơ quan ban hành: dòng đầu tiên không rỗng
        lines = [l.strip() for l in text.split('\n') if l.strip() and 'CỘNG HÒA' not in l.upper()]
        if lines:
            result["CoQuanBanHanh"] = lines[0]
            if result["CoQuanBanHanh"].upper().startswith("UBND"):
                if len(lines) > 1 and "Số" not in lines[1]:
                    result["CoQuanBanHanh"] = lines[1]

        # 5. Loại văn bản từ nội dung
        text_upper = text.upper()
        for vb_type in ["QUYẾT ĐỊNH", "THÔNG TƯ", "NGHỊ ĐỊNH", "BÁO CÁO", "TỜ TRÌNH", "CÔNG VĂN"]:
            if vb_type in text_upper:
                result["TenCongVan"] = vb_type
                break

        # 6. Priority
        if "HỎA TỐC" in text_upper:
            result["Priority"] = "Hỏa tốc"
        elif "KHẨN" in text_upper:
            result["Priority"] = "Khẩn"

        return result

    # Áp dụng Regex Extraction (nhanh & chính xác 100%)
    fallback = _regex_extract(request.text)
    return ExtractMetadataResponse(**fallback)




@app.post("/api/extract-keywords", response_model=ExtractKeywordsResponse)
async def extract_keywords(request: ExtractKeywordsRequest):
    """Trích xuất từ khóa tìm kiếm cho Web Search"""
    text_sample = request.text[:1500] if request.text and len(request.text) > 1500 else request.text
    if not text_sample:
        text_sample = request.doc_title

    prompt = f"""Bạn là AI chuyên trích xuất từ khóa tìm kiếm (Search Query Generator). 
Nhiệm vụ của bạn là đọc văn bản/câu hỏi sau và trích xuất ra 1-3 TỪ KHÓA CỐT LÕI NHẤT để tra cứu trên trang Thư viện Pháp luật.
QUY TẮC BẮT BUỘC:
- Tuyệt đối không đặt câu hỏi.
- Từ khóa ngắn gọn, tập trung vào danh từ, số hiệu, tên luật pháp.
- Mỗi từ khóa trên 1 dòng, KHÔNG đánh số thứ tự, KHÔNG giải thích.
Văn bản/Câu hỏi: {text_sample}
Từ khóa:"""
    try:
        messages = [{"role": "user", "content": prompt}]
        ai_text = await _ollama_client.chat(request.model, messages, format=None)
        if not ai_text:
            return ExtractKeywordsResponse(keywords=[request.doc_title or "văn bản pháp luật"])
        
        lines = ai_text.splitlines()
        keywords_list = []
        for line in lines:
            k = line.strip(' "\'.*-123456789')
            if k and len(k) < 100 and not k.startswith("["):
                keywords_list.append(k)
        
        if keywords_list:
            return ExtractKeywordsResponse(keywords=keywords_list[:3])
        return ExtractKeywordsResponse(keywords=[request.doc_title or "văn bản pháp luật"])
    except Exception as e:
        logger.error("[/api/extract-keywords] Error: %s", str(e))
        return ExtractKeywordsResponse(keywords=[request.doc_title or "văn bản pháp luật"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)


@app.post("/api/hyde", response_model=HyDEResponse)
async def hyde_search(request: HyDERequest):
    """
    Hypothetical Document Embeddings (HyDE) — học từ Khoj / GPT-Researcher.

    Thay vì embed câu hỏi → search, ta:
    1. Dùng LLM sinh ra đoạn VĂN BẢN GIẢ ĐỊNH phù hợp với câu hỏi.
    2. Embed đoạn văn bản giả định đó.
    3. Dùng vector này để search → tìm được đoạn thực tế gần nghĩa hơn.
    """
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Bước 1: Sinh hypothetical document
    prompt = f"""Bạn là một chuyên gia về văn bản pháp luật và công văn hành chính Việt Nam.
Hãy viết một đoạn văn bản ngắn (2-4 câu) có thể là nội dung của một công văn/quy định trả lời cho câu hỏi sau.
KHÔNG giải thích, chỉ viết đoạn văn bản đó, như thể đây là trích dẫn từ tài liệu thực tế.

Câu hỏi: {request.question}"""

    try:
        messages = [{"role": "user", "content": prompt}]
        hypothetical_doc = await _ollama_client.chat(request.model, messages, format=None)
        if not hypothetical_doc:
            hypothetical_doc = request.question  # Fallback về câu hỏi gốc

        # Bước 2: Embed hypothetical document
        vector = await _batch_embedder.embed(hypothetical_doc, normalize=True)

        return HyDEResponse(
            hypothetical_document=hypothetical_doc,
            vector=vector
        )
    except Exception as e:
        logger.error("[/api/hyde] Error: %s", str(e))
        # Fallback: embed câu hỏi gốc
        try:
            vector = await _batch_embedder.embed(request.question, normalize=True)
            return HyDEResponse(hypothetical_document=request.question, vector=vector)
        except Exception:
            raise HTTPException(status_code=500, detail="HyDE generation failed")
import re
from datetime import datetime

def fallback_extract_metadata(text: str) -> dict:
    result = {
        "SoVanBan": "",
        "TenCongVan": "",
        "TrichYeu": "",
        "NgayBanHanh": "",
        "ThoiHan": "",
        "CoQuanBanHanh": "",
        "CoQuanChuQuan": "",
        "Priority": "Thường"
    }
    
    # 1. Trích xuất Số văn bản
    so_van_ban_match = re.search(r'(Số|SỐ):\s*([0-9]+/[A-Z0-9Đ]+-[A-Z0-9Đ]+|[0-9]+/[A-Z0-9Đ]+)', text)
    if so_van_ban_match:
        result["SoVanBan"] = so_van_ban_match.group(2)
        
    # 2. Ngày ban hành
    ngay_match = re.search(r'ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})', text, re.IGNORECASE)
    if ngay_match:
        d, m, y = ngay_match.groups()
        result["NgayBanHanh"] = f"{y}-{int(m):02d}-{int(d):02d}"
        
    # 3. Trích yếu
    trich_yeu_match = re.search(r'(V/v|Về việc)\s*([^Kính]+)', text, re.IGNORECASE | re.DOTALL)
    if trich_yeu_match:
        ty = trich_yeu_match.group(2).strip()
        ty = re.sub(r'\s+', ' ', ty)
        result["TrichYeu"] = ty[:500] # Giới hạn độ dài
        
    # 4. Cơ quan ban hành
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if lines:
        result["CoQuanBanHanh"] = lines[0]
        if len(lines) > 1 and "CỘNG" not in lines[1]:
            result["CoQuanChuQuan"] = lines[1]
            
    return result
