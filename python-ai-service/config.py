from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # LLM Provider
    ollama_url: str = "http://ollama:11434"

    # RAG Pipeline
    chunk_size: int = 800
    chunk_overlap: int = 100
    similarity_threshold: float = 0.65
    compression_fastpath_chars: int = 1500
    max_compress_results: int = 8

    # Metadata extraction
    metadata_use_llm: bool = True
    metadata_max_chars: int = 1500

    # Timezone
    tz: str = "Asia/Ho_Chi_Minh"

    # Security: X-API-Key auth — để rỗng để tắt auth (backward compat)
    # Đặt giá trị này trùng với C# caller (PythonAiService.cs header X-API-Key)
    api_secret_key: str = ""

    class Config:
        env_file = ".env"

_settings: Settings | None = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
