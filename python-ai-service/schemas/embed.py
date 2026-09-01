from pydantic import BaseModel
from typing import Optional

class EmbedRequest(BaseModel):
    text: str
    normalize: bool = True  # L2 normalize mặc định (llama.cpp embd_normalize=2)
    use_cache: bool = True  # Dùng PromptEmbeddingCache (llama.cpp cache_prompt)

class EmbedResponse(BaseModel):
    vector: list[float]
    cached: bool = False
    dim: int = 0
    model_version: str = ""  # Embedding model name — dùng để gắn vào DocumentChunks.EmbeddingModelVersion

class BatchEmbedRequest(BaseModel):
    texts: list[str]
    normalize: bool = True

class BatchEmbedResponse(BaseModel):
    vectors: list[list[float]]
    count: int
    model_version: str = ""
