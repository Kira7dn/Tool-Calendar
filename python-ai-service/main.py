from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import logging
from embeddings.semantic_embedder import get_embedder
from llm_provider.ollama_client import OllamaClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Tool-Calendar AI Service")
ollama_client = OllamaClient()

class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    vector: list[float]

class ChatRequest(BaseModel):
    model: str = "qwen2.5:3b"
    messages: list[dict]

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "toolcalendar-ai-service"}

@app.post("/api/embed", response_model=EmbedResponse)
def embed_text(request: EmbedRequest):
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
        
    embedder = get_embedder()
    try:
        vector = embedder.embed_text(request.text)
        return EmbedResponse(vector=vector)
    except Exception as e:
        logger.error(f"Embedding API error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate embedding")

@app.post("/api/chat")
async def chat_stream(request: ChatRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty")
        
    try:
        # stream_chat yields string chunks, FastAPI StreamingResponse can stream them directly
        # but we need to encode them to bytes or ensure they are properly formatted.
        return StreamingResponse(
            ollama_client.stream_chat(request.model, request.messages),
            media_type="text/plain"
        )
    except Exception as e:
        logger.error(f"Chat API error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process chat request")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
