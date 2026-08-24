from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    model: str = "qwen2.5:0.5b"
    messages: list[dict]

class ParseDateRequest(BaseModel):
    text: str

class ParseDateResponse(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class GenerateQARequest(BaseModel):
    text: str
    model: str = "qwen2.5:0.5b"

class GenerateQAResponse(BaseModel):
    qa_pairs: list[str]

class HyDERequest(BaseModel):
    question: str
    model: str = "qwen2.5:0.5b"

class HyDEResponse(BaseModel):
    hypothetical_document: str
    vector: list[float]

class ContextualChunkRequest(BaseModel):
    text: str               # Nội dung chunk
    doc_title: str = ""
    doc_summary: str = ""   # Tóm tắt document — được sinh trước
    model: str = "qwen2.5:0.5b"

class ContextualChunkResponse(BaseModel):
    contextual_text: str    # chunk + context sentence ghép lại
    context_sentence: str   # câu context LLM sinh ra

class DocSummaryRequest(BaseModel):
    text: str
    doc_title: str = ""
    model: str = "qwen2.5:0.5b"

class DocSummaryResponse(BaseModel):
    summary: str
    summary_vector: list[float]
