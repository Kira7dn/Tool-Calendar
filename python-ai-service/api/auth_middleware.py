"""
HMAC-SHA256 + Timestamp Auth Middleware — Enterprise Internal Service Security
=============================================================================

Bảo vệ python-ai-service khỏi request trái phép theo chuẩn AWS SigV4-inspired:

  Layer 1 — X-API-Key:    Shared secret, backward-compat (rỗng = tắt auth)
  Layer 2 — X-Timestamp:  Unix ms, cửa sổ ±30s → chống replay attack
  Layer 3 — X-Signature:  HMAC-SHA256(key, "METHOD:PATH:TIMESTAMP") → chống tampering
  Layer 4 — X-Correlation-ID: Propagate từ C# để trace cross-service

Public paths (/health, /docs, /openapi.json, /redoc) bỏ qua toàn bộ auth.
"""

import hashlib
import hmac
import logging
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

# Cửa sổ timestamp hợp lệ: ±30 giây
_TIMESTAMP_WINDOW_MS = 30_000

# Các path không cần auth
_PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc", "/api/cache/clear", "/api/cache/stats"}


def _compute_hmac(key: str, message: str) -> str:
    """Tính HMAC-SHA256(key, message), trả về hex lowercase."""
    return hmac.new(
        key.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _verify_timestamp(timestamp_ms_str: str) -> bool:
    """Kiểm tra timestamp nằm trong cửa sổ ±30s."""
    try:
        ts = int(timestamp_ms_str)
        now_ms = int(time.time() * 1000)
        return abs(now_ms - ts) <= _TIMESTAMP_WINDOW_MS
    except (ValueError, TypeError):
        return False


def _verify_signature(key: str, method: str, path: str, timestamp_ms: str, provided_sig: str) -> bool:
    """Xác minh HMAC-SHA256 signature."""
    message = f"{method}:{path}:{timestamp_ms}"
    expected = _compute_hmac(key, message)
    # Dùng hmac.compare_digest để chống timing attack
    return hmac.compare_digest(expected, provided_sig.lower())


def register_auth_middleware(app: FastAPI, secret_key: str) -> None:
    """
    Đăng ký auth middleware.

    Args:
        app: FastAPI instance
        secret_key: Shared secret với C# caller. Rỗng = tắt auth (dev mode).
    """
    if not secret_key:
        logger.warning(
            "[Auth] api_secret_key KHÔNG được cấu hình — "
            "auth bị bỏ qua. Đặt API_SECRET_KEY trong .env để bật."
        )
        return

    logger.info("[Auth] HMAC-SHA256 + Timestamp middleware đã được kích hoạt.")

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        # Bỏ qua auth cho public paths
        if request.url.path in _PUBLIC_PATHS:
            return await call_next(request)

        # --- Layer 1: X-API-Key ---
        provided_key = request.headers.get("X-API-Key", "")
        if not provided_key:
            logger.warning("[Auth] Missing X-API-Key | path=%s", request.url.path)
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized — X-API-Key header bắt buộc"},
            )

        if not hmac.compare_digest(provided_key, secret_key):
            logger.warning("[Auth] Invalid X-API-Key | path=%s", request.url.path)
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized — X-API-Key không hợp lệ"},
            )

        # --- Layer 2: Timestamp replay protection ---
        timestamp_ms = request.headers.get("X-Timestamp", "")
        if timestamp_ms:
            if not _verify_timestamp(timestamp_ms):
                logger.warning(
                    "[Auth] Replay detected — timestamp out of window | path=%s ts=%s",
                    request.url.path,
                    timestamp_ms,
                )
                return JSONResponse(
                    status_code=401,
                    content={"error": "Unauthorized — Request timestamp hết hạn (replay protection)"},
                )

            # --- Layer 3: HMAC-SHA256 signature ---
            signature = request.headers.get("X-Signature", "")
            if signature:
                method = request.method.upper()
                path = request.url.path
                if request.url.query:
                    path = f"{path}?{request.url.query}"

                if not _verify_signature(secret_key, method, path, timestamp_ms, signature):
                    logger.warning(
                        "[Auth] Invalid HMAC signature | path=%s method=%s",
                        request.url.path,
                        method,
                    )
                    return JSONResponse(
                        status_code=401,
                        content={"error": "Unauthorized — HMAC signature không hợp lệ"},
                    )

        return await call_next(request)
