from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ollama_url: str = "http://ollama:11434"
    chunk_size: int = 800
    chunk_overlap: int = 100
    similarity_threshold: float = 0.65
    compression_fastpath_chars: int = 1500
    metadata_use_llm: bool = True
    metadata_max_chars: int = 1500
    tz: str = "Asia/Ho_Chi_Minh"

    class Config:
        env_file = ".env"

_settings: Settings | None = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
