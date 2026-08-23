class AiServiceError(Exception):
    """Base class cho tất cả lỗi của service"""
    pass

class AiClientError(AiServiceError):
    """4xx — lỗi do client gọi sai"""
    status_code: int = 400
    
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

class AiServerError(AiServiceError):
    """5xx — lỗi do server/model"""
    status_code: int = 500
    
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

class EmbeddingUnavailableError(AiServerError):
    """Model embedder chưa sẵn sàng"""
    def __init__(self, message: str = "Embedding model is not ready"):
        super().__init__(message, status_code=503)

class OllamaTimeoutError(AiServerError):
    """Ollama timeout"""
    def __init__(self, message: str = "Ollama connection timeout"):
        super().__init__(message, status_code=504)

class InvalidChunkParamsError(AiClientError):
    """Tham số chunk không hợp lệ"""
    def __init__(self, message: str = "Invalid chunking parameters"):
        super().__init__(message, status_code=400)
