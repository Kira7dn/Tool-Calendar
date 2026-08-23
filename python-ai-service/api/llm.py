from fastapi import APIRouter, Depends, Request
from schemas import ChatRequest, ParseDateRequest, ParseDateResponse, GenerateQARequest, GenerateQAResponse, HyDERequest, HyDEResponse, ContextualChunkRequest, ContextualChunkResponse, DocSummaryRequest, DocSummaryResponse
from services.llm_service import LlmService

router = APIRouter()

def get_llm_service(request: Request) -> LlmService:
    return LlmService(
        ollama_client=request.app.state.ollama_client,
        batch_embedder=request.app.state.embedder
    )

@router.post("/api/chat")
async def chat_stream(request: ChatRequest, svc: LlmService = Depends(get_llm_service)):
    return await svc.chat_stream(request)

@router.post("/api/parse-date", response_model=ParseDateResponse)
def parse_date_endpoint(request: ParseDateRequest, svc: LlmService = Depends(get_llm_service)):
    return svc.parse_date(request)

@router.post("/api/generate-qa", response_model=GenerateQAResponse)
async def generate_qa(request: GenerateQARequest, svc: LlmService = Depends(get_llm_service)):
    return await svc.generate_qa(request)

@router.post("/api/hyde", response_model=HyDEResponse)
async def hyde_search(request: HyDERequest, svc: LlmService = Depends(get_llm_service)):
    return await svc.hyde_search(request)

@router.post("/api/contextual-chunk", response_model=ContextualChunkResponse)
async def contextual_chunk(request: ContextualChunkRequest, svc: LlmService = Depends(get_llm_service)):
    return await svc.contextual_chunk(request)

@router.post("/api/doc-summary", response_model=DocSummaryResponse)
async def doc_summary(request: DocSummaryRequest, svc: LlmService = Depends(get_llm_service)):
    return await svc.doc_summary(request)
