from fastapi import APIRouter, Depends, Request
from schemas import ExtractRequest, ExtractFastResponse, ExtractMetadataRequest, ExtractMetadataResponse, ExtractKeywordsRequest, ExtractKeywordsResponse
from services.document_service import DocumentService

router = APIRouter()

def get_document_service(request: Request) -> DocumentService:
    return DocumentService(
        docling_extractor=request.app.state.docling,
        ollama_client=request.app.state.ollama_client,
        settings=request.app.state.settings
    )

@router.post("/api/extract")
def extract_document(request: ExtractRequest, svc: DocumentService = Depends(get_document_service)):
    return svc.extract_document(request)

@router.post("/api/extract-fast", response_model=ExtractFastResponse)
def extract_fast(request: ExtractRequest, svc: DocumentService = Depends(get_document_service)):
    return svc.extract_fast(request)

@router.post("/api/extract-metadata", response_model=ExtractMetadataResponse)
async def extract_metadata(request: ExtractMetadataRequest, svc: DocumentService = Depends(get_document_service)):
    return await svc.extract_metadata(request)

@router.post("/api/extract-keywords", response_model=ExtractKeywordsResponse)
async def extract_keywords(request: ExtractKeywordsRequest, svc: DocumentService = Depends(get_document_service)):
    return await svc.extract_keywords(request)
