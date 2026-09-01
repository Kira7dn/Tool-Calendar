# ── Build stage: cài gcc/build-essential chỉ ở đây ──────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# build-essential cần cho một số wheel nhị phân
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# ── Bước 1: Cài torch CPU-only từ PyTorch CDN (tránh PyPI kéo bản CUDA nặng ~3GB) ──
# Làm layer riêng để Docker cache lại — không cần build lại khi requirements.txt đổi nhỏ
RUN pip install --no-cache-dir \
    torch==2.4.1+cpu \
    torchvision==0.19.1+cpu \
    --index-url https://download.pytorch.org/whl/cpu

# ── Bước 2: Cài toàn bộ requirements — bỏ qua torch vì đã có ở bước 1 ──
# --no-deps không dùng được vì sẽ bỏ qua các deps khác.
# Dùng constraint file để pip KHÔNG upgrade/reinstall torch từ PyPI.
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu

# ── Final stage: image sạch, không có compiler ───────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Chỉ cài curl cho healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy site-packages từ builder (không copy gcc/build-essential)
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Fix R-S07: chạy với non-root user
RUN useradd -m -u 1000 appuser

# Download embedding model (multilingual, hỗ trợ tiếng Việt)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# Fix R-S05: Bake cross-encoder reranker model vào image — không cần Internet lúc chạy
# ~180MB, giải quyết vi phạm cam kết offline trong ollama_client.py
RUN python -c "from sentence_transformers import CrossEncoder; CrossEncoder('cross-encoder/ms-marco-MiniLM-L-2-v2')"

COPY . .

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8001

# workers=1 để chia sẻ global state (batch embedder, cache)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
