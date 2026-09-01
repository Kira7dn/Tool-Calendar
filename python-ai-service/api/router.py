from fastapi import APIRouter
from .embed import router as embed_router
from .rag import router as rag_router
from .document import router as document_router
from .llm import router as llm_router
from .eval import router as eval_router

api_router = APIRouter()

api_router.include_router(embed_router, tags=["Embedding"])
api_router.include_router(rag_router, tags=["RAG"])
api_router.include_router(document_router, tags=["Document"])
api_router.include_router(llm_router, tags=["LLM"])
api_router.include_router(eval_router, tags=["Evaluation"])
