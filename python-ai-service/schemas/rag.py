from pydantic import BaseModel, Field, model_validator
from typing import Optional

class CompressRequest(BaseModel):
    # R-S03: Giới hạn query và số documents để tránh OOM
    query: str = Field(..., max_length=2000)
    documents: list[dict] = Field(..., max_length=50)  # tối đa 50 documents
    max_results: int = Field(8, ge=1, le=20)
    similarity_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)

class CompressResponse(BaseModel):
    chunks: list[dict]
    total_chunks_evaluated: int = 0
    context_string: str = ""  # Dùng thẳng vào LLM prompt

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
    text: str = Field(..., max_length=2_000_000)
    doc_title: str = ""
    doc_date: str = ""
    doc_source: str = ""
    doc_id: Optional[int] = None
    chunk_size: int = Field(800, ge=100, le=4000)
    chunk_overlap: int = Field(100, ge=0, le=1000)
    adaptive: bool = False  # mặc định TẮT — chỉ bật khi caller yêu cầu

    @model_validator(mode="after")
    def _check_overlap(self):
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap phải nhỏ hơn chunk_size")
        return self

class ChunkResponse(BaseModel):
    chunks: list[dict]
    total_chunks: int
