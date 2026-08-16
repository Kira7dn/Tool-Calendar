import httpx
import json
import logging
import os
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

class OllamaClient:
    def __init__(self, base_url: str = "http://host.docker.internal:11434"):
        # Mặc định gọi ra host vì Ollama đang cài trực tiếp trên máy chủ
        self.base_url = base_url
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    def _convert_messages_to_gemini(self, messages: list[dict]) -> list[dict]:
        gemini_msgs = []
        for msg in messages:
            role = msg.get("role", "user")
            # Gemini dùng "user" và "model"
            gemini_role = "user" if role in ["user", "system"] else "model"
            gemini_msgs.append({
                "role": gemini_role,
                "parts": [{"text": msg.get("content", "")}]
            })
        return gemini_msgs

    async def _chat_gemini(self, messages: list[dict], format="json") -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.gemini_api_key}"
        payload = {
            "contents": self._convert_messages_to_gemini(messages),
        }
        if format == "json":
            payload["generationConfig"] = {
                "responseMimeType": "application/json"
            }
            
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                
                # Trích xuất nội dung từ Gemini response
                candidates = data.get("candidates", [])
                if candidates and len(candidates) > 0:
                    content = candidates[0].get("content", {})
                    parts = content.get("parts", [])
                    if parts and len(parts) > 0:
                        return parts[0].get("text", "")
                return ""
        except Exception as e:
            logger.error(f"Gemini API Error: {str(e)}")
            # Fallback to Ollama if Gemini fails
            raise e

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
        # Ưu tiên dùng Gemini nếu có API Key (nhanh và chính xác hơn)
        if self.gemini_api_key:
            try:
                result = await self._chat_gemini(messages, format)
                if result:
                    return result
            except Exception as e:
                logger.warning(f"Gemini failed, falling back to Ollama. Error: {str(e)}")

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
