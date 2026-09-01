"""
OllamaClient v2.0 — Continuous Batching-inspired Concurrency Control
Học từ vLLM source:
  - FCFSRequestQueue (vllm/v1/core/sched/request_queue.py:75)  → asyncio.Queue FIFO
  - Scheduler.max_num_running_reqs (scheduler.py:110)          → asyncio.Semaphore
  - Preemption / queue overflow (scheduler.py)                 → 503 khi queue đầy

Kỹ thuật: Semaphore điều tiết số request Ollama đồng thời (= OLLAMA_NUM_PARALLEL).
Queue FIFO đảm bảo thứ tự công bằng (FCFS — First Come First Served).
"""

import asyncio
import logging
from collections import deque
from typing import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

# Khớp với OLLAMA_NUM_PARALLEL trên server — 4 chat song song
OLLAMA_MAX_CONCURRENT = 4
# Tối đa bao nhiêu request nằm trong hàng chờ (vLLM: max_num_seqs giới hạn)
OLLAMA_MAX_QUEUE_SIZE = 100
# Timeout toàn bộ: connect + stream
CHAT_TIMEOUT_S = 180.0
CONNECT_TIMEOUT_S = 3.0


class ChatQueueManager:
    """
    FCFS Concurrency Controller — học từ vLLM FCFSRequestQueue + Scheduler.

    Thay vì mỗi request gọi thẳng Ollama (serial nếu OLLAMA_NUM_PARALLEL=1),
    ta dùng asyncio.Semaphore để đảm bảo tối đa OLLAMA_MAX_CONCURRENT request
    chạy thật sự trên Ollama cùng lúc. Request vượt quá sẽ chờ trong asyncio queue
    theo thứ tự FCFS — đúng như FCFSRequestQueue của vLLM.

    Kết quả: 100 user đồng thời → tối đa 4 chạy, 96 còn lại xếp hàng FCFS,
    không ai bị timeout hay lỗi (trừ khi queue > 100).
    """

    def __init__(
        self,
        max_concurrent: int = OLLAMA_MAX_CONCURRENT,
        max_queue: int = OLLAMA_MAX_QUEUE_SIZE,
    ):
        # vLLM: max_num_running_reqs → Semaphore
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._max_queue = max_queue
        # Đếm số request đang chờ (chưa acquire semaphore)
        self._waiting = 0

    @property
    def queue_depth(self) -> int:
        """Số request đang chờ trong hàng — dùng cho health check / metrics."""
        return self._waiting

    async def acquire(self) -> None:
        """
        Vào hàng chờ. Nếu queue đầy → raise ngay (vLLM preemption).
        Nếu còn chỗ → chờ Semaphore theo FCFS.
        """
        if self._waiting >= self._max_queue:
            raise OverflowError(
                f"Hệ thống đang xử lý quá nhiều yêu cầu. "
                f"Hàng chờ hiện tại: {self._waiting}/{self._max_queue}. "
                f"Vui lòng thử lại sau."
            )
        self._waiting += 1
        await self._semaphore.acquire()
        self._waiting -= 1

    def release(self) -> None:
        self._semaphore.release()


# Singleton — dùng chung toàn app (giống global _batch_embedder trong main.py)
_chat_queue_manager: ChatQueueManager | None = None


def get_chat_queue_manager() -> ChatQueueManager:
    global _chat_queue_manager
    if _chat_queue_manager is None:
        _chat_queue_manager = ChatQueueManager(
            max_concurrent=OLLAMA_MAX_CONCURRENT,
            max_queue=OLLAMA_MAX_QUEUE_SIZE,
        )
        logger.info(
            "[ChatQueue] Initialized — max_concurrent=%d, max_queue=%d",
            OLLAMA_MAX_CONCURRENT,
            OLLAMA_MAX_QUEUE_SIZE,
        )
    return _chat_queue_manager


class OllamaClient:
    def __init__(self, base_url: str = ""):
        # Fix R-O04: Đọc URL từ env hoặc caller, không hardcode
        # Priority: 1) caller truyền tường minh, 2) env OLLAMA_URL, 3) default docker service name
        import os
        self.base_url = base_url or os.getenv("OLLAMA_URL", "http://ollama:11434")

    async def stream_chat(
        self, model: str, messages: list[dict]
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat qua Ollama với FCFS concurrency control.

        Luồng (học từ vLLM):
        1. Request vào → kiểm tra queue size (preemption nếu đầy)
        2. Acquire semaphore — chờ FCFS nếu max_concurrent đang chạy hết
        3. Gọi Ollama stream → yield từng token về client
        4. Release semaphore → request kế tiếp trong queue được phục vụ
        """
        url = f"{self.base_url}/api/chat"
        payload = {"model": model, "messages": messages, "stream": True}

        queue_mgr = get_chat_queue_manager()
        try:
            await queue_mgr.acquire()
        except OverflowError as e:
            yield f"\n[{str(e)}]"
            return

        try:
            timeout_config = httpx.Timeout(CHAT_TIMEOUT_S, connect=CONNECT_TIMEOUT_S)
            async with httpx.AsyncClient(timeout=timeout_config) as client:
                async with client.stream("POST", url, json=payload) as response:
                    response.raise_for_status()
                    import json

                    async for chunk in response.aiter_lines():
                        if chunk:
                            try:
                                data = json.loads(chunk)
                                if "message" in data and "content" in data["message"]:
                                    yield data["message"]["content"]
                            except json.JSONDecodeError:
                                logger.warning("Failed to parse JSON chunk: %s", chunk)
        except httpx.HTTPError as e:
            logger.error("HTTP error while calling Ollama: %s", str(e))
            yield f"\n[Lỗi kết nối Ollama: {str(e)}]"
        except Exception as e:
            logger.error("Unexpected error: %s", str(e))
            yield f"\n[Lỗi hệ thống AI: {str(e)}]"
        finally:
            # QUAN TRỌNG: luôn release dù có lỗi — tránh deadlock
            queue_mgr.release()

    async def chat(
        self, model: str, messages: list[dict], format="json"
    ) -> str:
        """
        Non-stream chat với FCFS queue control — dùng cho internal API calls
        (extract-metadata, generate-qa, doc-summary...).
        """
        url = f"{self.base_url}/api/chat"
        payload = {"model": model, "messages": messages, "stream": False}
        if format:
            payload["format"] = format

        queue_mgr = get_chat_queue_manager()
        try:
            await queue_mgr.acquire()
        except OverflowError as e:
            logger.warning("[OllamaClient] Queue overflow: %s", str(e))
            return ""

        try:
            timeout_config = httpx.Timeout(CHAT_TIMEOUT_S, connect=CONNECT_TIMEOUT_S)
            async with httpx.AsyncClient(timeout=timeout_config) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("message", {}).get("content", "")
        except Exception as e:
            logger.error("Failed to generate chat response: %s", str(e))
            return ""
        finally:
            queue_mgr.release()
