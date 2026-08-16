import httpx
import json
import logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

class OllamaClient:
    def __init__(self, base_url: str = "http://host.docker.internal:11434"):
        # Mặc định gọi ra host vì Ollama đang cài trực tiếp trên máy chủ
        self.base_url = base_url

    async def stream_chat(self, model: str, messages: list[dict]) -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": True
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_lines():
                        if chunk:
                            try:
                                data = json.loads(chunk)
                                if "message" in data and "content" in data["message"]:
                                    yield data["message"]["content"]
                            except json.JSONDecodeError:
                                logger.warning(f"Failed to parse JSON chunk: {chunk}")
        except httpx.HTTPError as e:
            logger.error(f"HTTP error occurred while calling Ollama: {str(e)}")
            yield f"\n[Lỗi kết nối Ollama: {str(e)}]"
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            yield f"\n[Lỗi hệ thống AI: {str(e)}]"

    async def chat(self, model: str, messages: list[dict], format="json") -> str:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": False
        }
        if format:
            payload["format"] = format
            
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"Failed to generate chat response: {str(e)}")
            return ""
