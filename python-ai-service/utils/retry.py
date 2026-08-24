"""
Retry Utilities — học từ Khoj tenacity patterns
Ref: khoj/src/khoj/processor/embeddings.py

Khoj dùng tenacity để tự động retry khi:
  - HTTPError khi gọi HuggingFace/OpenAI API
  - Exponential backoff với jitter để tránh thundering herd
  - Log trước mỗi lần sleep để debug dễ hơn

Áp dụng cho python-ai-service:
  - Retry khi gọi Ollama (server có thể bận)
  - Retry khi CrossEncoder lỗi
  - Retry khi download model lần đầu
"""

import logging
from functools import wraps
from typing import Callable, Type, TypeVar

from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")


def with_retry(
    exception_types: tuple[Type[Exception], ...] = (Exception,),
    max_attempts: int = 3,
    min_wait: float = 1,
    max_wait: float = 10,
) -> Callable:
    """
    Decorator factory cho retry với exponential backoff + jitter.

    Học từ Khoj:
    @retry(
        retry=retry_if_exception_type(requests.exceptions.HTTPError),
        wait=wait_random_exponential(multiplier=1, max=10),
        stop=stop_after_attempt(5),
        before_sleep=before_sleep_log(logger, logging.DEBUG),
    )

    Args:
        exception_types: Tuple các exception sẽ trigger retry
        max_attempts: Số lần thử tối đa
        min_wait: Thời gian chờ tối thiểu (giây)
        max_wait: Thời gian chờ tối đa (giây)
    """
    def decorator(func: Callable) -> Callable:
        @retry(
            retry=retry_if_exception_type(exception_types),
            wait=wait_random_exponential(multiplier=min_wait, max=max_wait),
            stop=stop_after_attempt(max_attempts),
            before_sleep=before_sleep_log(logger, logging.WARNING),
        )
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        return wrapper
    return decorator


# Pre-configured retry decorators cho từng use case

ollama_retry = with_retry(
    exception_types=(ConnectionError, TimeoutError, OSError),
    max_attempts=3,
    max_wait=8,
)

model_inference_retry = with_retry(
    exception_types=(RuntimeError, ValueError),
    max_attempts=3,
    max_wait=10,
)
