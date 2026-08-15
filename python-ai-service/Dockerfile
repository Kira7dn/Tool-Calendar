FROM python:3.11-slim

WORKDIR /app

# gcc cần cho scikit-learn (học từ gpt-researcher Dockerfile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download multilingual model trước để container khởi động nhanh
# paraphrase-multilingual-MiniLM-L12-v2 hỗ trợ tiếng Việt tốt hơn
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

COPY . .

EXPOSE 8001

# workers=1 để chia sẻ global state (batch embedder, cache)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
