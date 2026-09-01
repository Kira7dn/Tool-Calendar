import logging
from exceptions import AiClientError, AiServerError
from schemas import EmbedRequest, EmbedResponse, BatchEmbedRequest, BatchEmbedResponse

logger = logging.getLogger(__name__)

class EmbedService:
    def __init__(self, embedder, radix_cache):
        self.embedder = embedder
        self.radix_cache = radix_cache

    async def embed(self, request: EmbedRequest) -> EmbedResponse:
        if not request.text or not request.text.strip():
            raise AiClientError("Text cannot be empty")

        if request.use_cache:
            cached = self.radix_cache.get(request.text)
            if cached is not None:
                return EmbedResponse(vector=cached, cached=True, dim=len(cached))

        try:
            vector = await self.embedder.embed(request.text, normalize=request.normalize)
        except Exception as e:
            logger.error("[EmbedService.embed] Error: %s", str(e))
            raise AiServerError("Failed to generate embedding")

        if request.use_cache:
            self.radix_cache.put(request.text, vector)

        # Get model version from the original embedder instance
        from embeddings.semantic_embedder import get_embedder
        model_name = get_embedder().model_name

        return EmbedResponse(vector=vector, cached=False, dim=len(vector), model_version=model_name)

    async def embed_batch(self, request: BatchEmbedRequest) -> BatchEmbedResponse:
        if not request.texts:
            raise AiClientError("Texts list cannot be empty")
        if len(request.texts) > 100:
            raise AiClientError("Max 100 texts per batch")

        vectors = []
        texts_to_embed = []
        indices_to_embed = []

        for i, text in enumerate(request.texts):
            if not text or not text.strip():
                vectors.append([])
                continue
            cached = self.radix_cache.get(text)
            if cached is not None:
                vectors.append(cached)
            else:
                vectors.append(None)
                texts_to_embed.append(text)
                indices_to_embed.append(i)

        if texts_to_embed:
            try:
                new_vectors = await self.embedder.embed_batch(texts_to_embed, normalize=request.normalize)
                for idx, vec in zip(indices_to_embed, new_vectors):
                    vectors[idx] = vec
                    self.radix_cache.put(request.texts[idx], vec)
            except Exception as e:
                logger.error("[EmbedService.embed_batch] Error: %s", str(e))
                raise AiServerError("Failed to generate batch embeddings")

        final_vectors = [v if v is not None else [] for v in vectors]
        
        # Lấy model version
        from embeddings.semantic_embedder import get_embedder
        model_name = get_embedder().model_name
        
        return BatchEmbedResponse(vectors=final_vectors, count=len(final_vectors), model_version=model_name)
    
    def cache_stats(self) -> dict:
        return self.radix_cache.stats()
