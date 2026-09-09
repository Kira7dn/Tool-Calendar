"""
Rate Limiting Middleware — Bảo vệ Python AI Service khỏi DoS / resource exhaustion.

Dùng sliding window in-memory counter (không cần Redis cho single-instance).
Ngưỡng theo từng endpoint (OCR nặng hơn embed):
  /api/extract*  → 10 req/phút  (OCR nặng, CPU cao)
  /api/embed*    → 30 req/phút  (nhẹ hơn)
  /api/*         → 60 req/phút  (tổng)

Trả về 429 với header Retry-After chuẩn RFC 7231.
"""

import logging
import time
from collections import defaultdict, deque
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)


class SlidingWindowRateLimiter:
    """
    In-memory sliding window rate limiter.
    Thread-safe cho single-process FastAPI (asyncio event loop).
    """

    def __init__(self):
        # {client_key: deque of timestamps}
        self._windows: dict[str, deque] = defaultdict(deque)

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """
        Kiểm tra xem request có được phép không.

        Returns:
            (allowed, retry_after_seconds)
        """
        now = time.monotonic()
        cutoff = now - window_seconds
        window = self._windows[key]

        # Xóa các timestamp cũ hơn window
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= limit:
            # Tính thời gian phải đợi (oldest request + window)
            retry_after = int(window[0] + window_seconds - now) + 1
            return False, retry_after

        window.append(now)
        return True, 0


# Global limiter instance
_limiter = SlidingWindowRateLimiter()

# Cấu hình rate limit theo route prefix
_RATE_LIMITS = [
    # (path_prefix, limit_per_minute, window_seconds)
    ("/api/extract", 10, 60),   # OCR nặng
    ("/api/embed", 30, 60),     # Embedding nhẹ hơn
    ("/api/", 60, 60),          # Tổng mọi API
]

# Paths không áp dụng rate limit
_SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding window rate limiter middleware."""

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in _SKIP_PATHS:
            return await call_next(request)

        # Client identifier: dùng IP (internal Docker network = container IP)
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        for path_prefix, limit, window in _RATE_LIMITS:
            if path.startswith(path_prefix):
                key = f"{client_ip}:{path_prefix}"
                allowed, retry_after = _limiter.is_allowed(key, limit, window)

                if not allowed:
                    logger.warning(
                        "[RateLimit] 429 | client=%s path=%s limit=%d/%ds retry_after=%ds",
                        client_ip, path, limit, window, retry_after,
                    )
                    return JSONResponse(
                        status_code=429,
                        headers={
                            "Retry-After": str(retry_after),
                            "X-RateLimit-Limit": str(limit),
                            "X-RateLimit-Window": f"{window}s",
                        },
                        content={
                            "error": f"Too Many Requests — Giới hạn {limit} req/{window}s cho {path_prefix}",
                            "retry_after_seconds": retry_after,
                        },
                    )
                break  # Chỉ áp dụng rule đầu tiên khớp

        return await call_next(request)


def register_rate_limit_middleware(app: FastAPI) -> None:
    """Đăng ký rate limiting middleware."""
    app.add_middleware(RateLimitMiddleware)
    logger.info("[RateLimit] Sliding window rate limiter registered.")
