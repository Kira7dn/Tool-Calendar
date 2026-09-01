import logging
from exceptions import AiClientError, AiServerError

logger = logging.getLogger(__name__)

class RagService:
    def __init__(self, compressor, chunker, batch_embedder):
        self.compressor = compressor
        self.chunker = chunker
        self.batch_embedder = batch_embedder

    async def compress_context(self, request):
        if not request.query or not request.documents:
            raise AiClientError("query and documents required")

        # Fix: không tạo ContextCompressor mới mỗi request
        # Truyền params trực tiếp vào compress() — compressor dùng chung singleton
        effective_threshold = request.similarity_threshold or self.compressor.similarity_threshold
        effective_max = request.max_results or self.compressor.max_results

        try:
            chunks = await self.compressor.compress(
                query=request.query,
                documents=request.documents,
                max_results=effective_max,
                similarity_threshold_override=effective_threshold,
            )
        except Exception as e:
            logger.error("[RagService.compress] Error: %s", str(e))
            raise AiServerError("Compression failed")


        if chunks:
            context_parts = []
            for i, chunk in enumerate(chunks, 1):
                if chunk.get("is_raw"):
                    context_parts.append(f"[Đoạn {i} | Nguyên văn]\n{chunk['content']}")
                else:
                    context_parts.append(f"[Đoạn {i} | Điểm: {chunk['score']:.0%}]\n{chunk['content']}")
            context_string = "\n\n---\n\n".join(context_parts)
        else:
            context_string = ""

        from schemas import CompressResponse
        return CompressResponse(
            chunks=chunks,
            total_chunks_evaluated=0,
            context_string=context_string,
        )

    def chunk_document(self, request):
        if not request.text or not request.text.strip():
            raise AiClientError("Text cannot be empty")
            
        from rag.chunker import SmartTextChunker
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
            adaptive=request.adaptive
        )
        from schemas import ChunkResponse
        return ChunkResponse(chunks=chunks, total_chunks=len(chunks))

    def rerank_chunks(self, request):
        from rag.reranker import get_reranker
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
            logger.error("[RagService.rerank] Error: %s", str(e))
            raise AiServerError("Reranking failed")

    def hybrid_search(self, request):
        from rag.hybrid_retriever import HybridRetriever
        hybrid = HybridRetriever(
            keyword_weight=request.keyword_weight,
            semantic_weight=request.semantic_weight
        )
        try:
            results = hybrid.rerank(
                query=request.query,
                chunks=request.chunks,
                top_n=request.top_n
            )
            return {"chunks": results, "count": len(results)}
        except Exception as e:
            logger.error("[RagService.hybrid_search] Error: %s", str(e))
            raise AiServerError("Hybrid search failed")
