"""
API Key Authentication Middleware
Học từ FastAPI middleware pattern.

Bảo vệ tất cả endpoint khỏi truy cập trái phép trong Docker internal network.
Nếu settings.api_secret_key rỗng → bỏ qua auth (backward compatible khi dev local).
"""

import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

# Các path được bỏ qua auth
_PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


def register_auth_middleware(app: FastAPI, secret_key: str) -> None:
    """
    Đăng ký X-API-Key middleware.

    Args:
        app: FastAPI instance
        secret_key: Key được chia sẻ với C# caller. Rỗng = tắt auth.
    """
    if not secret_key:
        logger.warning(
            "[Auth] api_secret_key KHÔNG được cấu hình — "
            "auth bị bỏ qua. Đặt API_SECRET_KEY trong .env để bật."
        )
        return

    logger.info("[Auth] X-API-Key middleware đã được kích hoạt.")

    @app.middleware("http")
    async def api_key_middleware(request: Request, call_next):
        # Bỏ qua auth cho public paths
        if request.url.path in _PUBLIC_PATHS:
            return await call_next(request)

        # Kiểm tra header
        provided_key = request.headers.get("X-API-Key", "")
        if provided_key != secret_key:
            logger.warning(
                "[Auth] Unauthorized request to %s — key mismatch",
                request.url.path,
            )
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized — X-API-Key không hợp lệ"},
            )

        return await call_next(request)
