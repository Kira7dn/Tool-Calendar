"""
Request Tracing Middleware
Mỗi request được gắn X-Request-ID và đo thời gian xử lý.
Log theo format structured để dễ grep và phân tích.
"""

import logging
import time
import uuid
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Các path không cần log chi tiết
_SKIP_LOG_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class RequestTracingMiddleware(BaseHTTPMiddleware):
    """
    Middleware đo thời gian và gắn request ID.
    - Thêm header X-Request-ID vào response (để client trace)
    - Log mỗi request: path, method, status, duration_ms, request_id
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Lấy hoặc tạo request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())[:8]

        # Inject vào request state để các handler khác dùng được
        request.state.request_id = request_id

        start_time = time.monotonic()

        response = await call_next(request)

        duration_ms = int((time.monotonic() - start_time) * 1000)

        # Gắn vào response header để client trace
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Duration-Ms"] = str(duration_ms)

        # Log (bỏ qua các path không quan trọng)
        if request.url.path not in _SKIP_LOG_PATHS:
            logger.info(
                "[TRACE] %s %s → %d | %dms | req=%s",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
                request_id,
            )

        return response


def register_tracing_middleware(app: FastAPI) -> None:
    """Đăng ký request tracing middleware."""
    app.add_middleware(RequestTracingMiddleware)
    logger.info("[Tracing] Request tracing middleware registered.")
