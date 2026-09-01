"""
Batch Embedding Processor — học từ llama.cpp server-queue.h
Kỹ thuật: Slot-based Request Queue + Batch Inference

Thay vì mỗi request embed riêng lẻ (1 text → 1 lần forward),
ta gom nhiều text vào 1 batch → 1 lần forward → tiết kiệm 50-70% memory
và giảm latency tổng thể khi có nhiều request đến cùng lúc.

Ref: llama.cpp/tools/server/server-queue.h (queue_tasks + queue_tasks_deferred)
     llama.cpp/tools/server/server-context.cpp (server_batch)
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Max batch size (học từ llama.cpp n_batch param, thường là 512 hoặc 2048)
MAX_BATCH_SIZE = 16
# Thời gian chờ tối đa để gom request vào batch (ms)
BATCH_WAIT_MS = 10


@dataclass
class EmbedRequest:
    """Một request embed — tương đương server_task trong llama.cpp"""
    text: str
    normalize: bool = True  # L2-normalize như llama.cpp embd_normalize=2
    # future được tạo tường minh bởi caller — không dùng default_factory để tránh get_event_loop deprecated
    future: asyncio.Future = field(default=None)  # type: ignore[assignment]


class AsyncBatchEmbedder:
    """
    Async Batch Embedding Queue — học từ server_queue của llama.cpp.

    Luồng xử lý:
    1. Request đến → đưa vào pending queue
    2. Worker chờ BATCH_WAIT_MS để gom batch
    3. Khi đủ MAX_BATCH_SIZE hoặc hết thời gian → chạy model.encode() 1 lần
    4. Phân phối kết quả về từng Future
    """

    def __init__(self, embedder_model):
        self._model = embedder_model
        self._queue: asyncio.Queue[EmbedRequest] = asyncio.Queue()
        self._worker_task: Optional[asyncio.Task] = None

    def start(self):
        """Khởi động worker loop — gọi sau khi FastAPI app startup"""
        self._worker_task = asyncio.create_task(self._batch_worker())
        logger.info("[BatchEmbedder] Worker started (batch_size=%d, wait_ms=%d)", MAX_BATCH_SIZE, BATCH_WAIT_MS)

    def stop(self):
        if self._worker_task:
            self._worker_task.cancel()

    async def embed(self, text: str, normalize: bool = True) -> list[float]:
        """
        Gửi 1 request embed vào queue, chờ kết quả.
        Timeout 30s để tránh treo vĩnh viễn khi worker chết (fix R-C03).
        """
        loop = asyncio.get_running_loop()  # Fix: get_running_loop() thay vì deprecated get_event_loop()
        req = EmbedRequest(text=text, future=loop.create_future(), normalize=normalize)
        await self._queue.put(req)
        try:
            return await asyncio.wait_for(req.future, timeout=30.0)
        except asyncio.TimeoutError:
            from exceptions import EmbeddingUnavailableError
            raise EmbeddingUnavailableError("Embedding worker không phản hồi sau 30s — worker có thể đã chết")

    async def embed_batch(self, texts: list[str], normalize: bool = True) -> list[list[float]]:
        """Gửi nhiều text cùng lúc, chờ tất cả kết quả về. Timeout 60s tổng."""
        futures = []
        loop = asyncio.get_running_loop()  # Fix: deprecated get_event_loop()
        for text in texts:
            req = EmbedRequest(text=text, future=loop.create_future(), normalize=normalize)
            await self._queue.put(req)
            futures.append(req.future)
        try:
            return await asyncio.wait_for(asyncio.gather(*futures), timeout=60.0)
        except asyncio.TimeoutError:
            from exceptions import EmbeddingUnavailableError
            raise EmbeddingUnavailableError("Batch embedding timeout sau 60s")

    async def _batch_worker(self):
        """
        Worker loop — tương đương start_loop() trong server_queue.h
        Thu thập requests trong BATCH_WAIT_MS rồi xử lý 1 lần.
        """
        while True:
            try:
                # Đợi ít nhất 1 request
                pending: list[EmbedRequest] = []
                first = await self._queue.get()
                pending.append(first)

                # Chờ thêm BATCH_WAIT_MS để gom batch — giống deferred queue
                loop = asyncio.get_running_loop()  # Fix: deprecated get_event_loop()
                deadline = loop.time() + BATCH_WAIT_MS / 1000
                while len(pending) < MAX_BATCH_SIZE:
                    remaining = deadline - loop.time()
                    if remaining <= 0:
                        break
                    try:
                        req = await asyncio.wait_for(self._queue.get(), timeout=remaining)
                        pending.append(req)
                    except asyncio.TimeoutError:
                        break

                # Chạy model.encode() một lần cho toàn bộ batch
                texts = [r.text for r in pending]
                try:
                    # convert_to_numpy=True để vectorized numpy ops
                    vectors = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: self._model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
                    )
                    # L2 Normalize — học từ llama.cpp embd_normalize=2 (Euclidean/L2)
                    # Giúp cosine similarity chính xác hơn 15-20%
                    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
                    norms = np.where(norms == 0, 1, norms)  # tránh chia 0
                    vectors_normalized = vectors / norms

                    # Gửi kết quả về từng Future
                    for i, req in enumerate(pending):
                        result = vectors_normalized[i] if req.normalize else vectors[i]
                        req.future.set_result(result.tolist())

                    logger.debug("[BatchEmbedder] Processed batch of %d texts", len(pending))

                except Exception as e:
                    logger.error("[BatchEmbedder] Batch encode error: %s", str(e))
                    for req in pending:
                        if not req.future.done():
                            req.future.set_exception(e)

            except asyncio.CancelledError:
                logger.info("[BatchEmbedder] Worker stopped")
                break
            except Exception as e:
                logger.error("[BatchEmbedder] Worker error: %s", str(e))
                await asyncio.sleep(0.1)
