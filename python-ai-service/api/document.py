import asyncio
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
async def extract_document(request: ExtractRequest, svc: DocumentService = Depends(get_document_service)):
    # CPU-bound + I/O (Docling OCR): chạy trong thread pool, tránh block event loop
    return await asyncio.to_thread(svc.extract_document, request)

@router.post("/api/extract-fast", response_model=ExtractFastResponse)
async def extract_fast(request: ExtractRequest, svc: DocumentService = Depends(get_document_service)):
    # I/O-bound (pypdf đọc file PDF): chạy trong thread pool
    return await asyncio.to_thread(svc.extract_fast, request)

@router.post("/api/extract-metadata", response_model=ExtractMetadataResponse)
async def extract_metadata(request: ExtractMetadataRequest, svc: DocumentService = Depends(get_document_service)):
    return await svc.extract_metadata(request)

@router.post("/api/extract-keywords", response_model=ExtractKeywordsResponse)
async def extract_keywords(request: ExtractKeywordsRequest, svc: DocumentService = Depends(get_document_service)):
    return await svc.extract_keywords(request)
