import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from exceptions import AiClientError, AiServerError

logger = logging.getLogger(__name__)

def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AiClientError)
    async def client_error_handler(request: Request, exc: AiClientError):
        logger.warning(f"Client error on {request.url.path}: {exc.message}")
        return JSONResponse(status_code=exc.status_code, content={"error": exc.message})
    
    @app.exception_handler(AiServerError)
    async def server_error_handler(request: Request, exc: AiServerError):
        logger.error(f"Server error on {request.url.path}: {exc.message}", exc_info=exc)
        return JSONResponse(status_code=exc.status_code, content={"error": exc.message})
