import logging
import json
from exceptions import AiClientError, AiServerError
from fastapi.responses import StreamingResponse
from schemas import (
    ParseDateResponse, ContextualChunkResponse, DocSummaryResponse,
    GenerateQAResponse, HyDEResponse
)

logger = logging.getLogger(__name__)

class LlmService:
    def __init__(self, ollama_client, batch_embedder):
        self.ollama_client = ollama_client
        self.batch_embedder = batch_embedder

    async def chat_stream(self, request):
        if not request.messages:
            raise AiClientError("Messages list cannot be empty")
        
        try:
            return StreamingResponse(
                self.ollama_client.stream_chat(request.model, request.messages),
                media_type="text/plain",
            )
        except Exception as e:
            logger.error("[LlmService.chat] Error: %s", str(e))
            raise AiServerError("Failed to process chat request")

    def parse_date(self, request):
        from rag.date_parser import parse_vietnamese_date
        start_d, end_d = parse_vietnamese_date(request.text)
        return ParseDateResponse(
            start_date=start_d.strftime("%Y-%m-%d") if start_d else None,
            end_date=end_d.strftime("%Y-%m-%d") if end_d else None,
        )

    async def generate_qa(self, request):
        if not request.text or not request.text.strip():
            raise AiClientError("Text cannot be empty")
            
        prompt = f"""Bạn là một chuyên gia phân tích công văn. Hãy đọc đoạn văn bản sau và tạo ra 3-5 cặp Câu hỏi - Câu trả lời (QA) quan trọng nhất.
Trả về KẾT QUẢ DƯỚI DẠNG JSON MẢNG chứa các chuỗi QA theo định dạng: ["Q: Câu hỏi 1 - A: Câu trả lời 1", "Q: Câu hỏi 2 - A: Câu trả lời 2"]. 
KHÔNG giải thích thêm.
Đoạn văn bản:
{request.text}"""
        
        try:
            messages = [{"role": "user", "content": prompt}]
            response_text = await self.ollama_client.chat(request.model, messages, format="json")
            
            qa_pairs = []
            try:
                parsed = json.loads(response_text)
                if isinstance(parsed, list):
                    qa_pairs = [str(x) for x in parsed]
                elif isinstance(parsed, dict) and "qa_pairs" in parsed:
                    qa_pairs = [str(x) for x in parsed["qa_pairs"]]
            except json.JSONDecodeError:
                pass
                
            return GenerateQAResponse(qa_pairs=qa_pairs)
        except Exception as e:
            logger.error("[LlmService.generate_qa] Error: %s", str(e))
            raise AiServerError("Failed to generate QA pairs")

    async def hyde_search(self, request):
        if not request.question or not request.question.strip():
            raise AiClientError("Question cannot be empty")

        prompt = f"""Bạn là một chuyên gia về văn bản pháp luật và công văn hành chính Việt Nam.
Hãy viết một đoạn văn bản ngắn (2-4 câu) có thể là nội dung của một công văn/quy định trả lời cho câu hỏi sau.
KHÔNG giải thích, chỉ viết đoạn văn bản đó, như thể đây là trích dẫn từ tài liệu thực tế.

Câu hỏi: {request.question}"""

        try:
            messages = [{"role": "user", "content": prompt}]
            hypothetical_doc = await self.ollama_client.chat(request.model, messages, format=None)
            if not hypothetical_doc:
                hypothetical_doc = request.question 
            vector = await self.batch_embedder.embed(hypothetical_doc, normalize=True)
            return HyDEResponse(
                hypothetical_document=hypothetical_doc,
                vector=vector
            )
        except Exception as e:
            logger.error("[LlmService.hyde] Error: %s", str(e))
            try:
                vector = await self.batch_embedder.embed(request.question, normalize=True)
                return HyDEResponse(hypothetical_document=request.question, vector=vector)
            except Exception:
                raise AiServerError("HyDE generation failed")

    async def contextual_chunk(self, request):
        if not request.text or not request.text.strip():
            raise AiClientError("Chunk text cannot be empty")

        doc_context = f"Tài liệu: {request.doc_title}" if request.doc_title else "một công văn/tài liệu"
        summary_context = f"\n\nTóm tắt tài liệu:\n{request.doc_summary}" if request.doc_summary else ""

        prompt = f"""Bạn đang xử lý {doc_context}.{summary_context}

Đây là đoạn văn bản cần xử lý:
<chunk>
{request.text[:1000]}
</chunk>

Hãy viết 1-2 câu ngắn gọn mô tả vị trí và nội dung của đoạn này trong bối cảnh toàn bộ tài liệu.
Mục tiêu: giúp người đọc hiểu đoạn này thuộc phần nào của tài liệu, bàn về vấn đề gì.
KHÔNG diễn giải lại nội dung. CHỈ mô tả context (vị trí trong tài liệu).
Trả lời bằng tiếng Việt, ngắn gọn."""

        try:
            messages = [{"role": "user", "content": prompt}]
            context_sentence = await self.ollama_client.chat(request.model, messages, format=None)
            if not context_sentence:
                context_sentence = ""

            contextual_text = f"{context_sentence.strip()}\n\n{request.text}" if context_sentence.strip() else request.text

            return ContextualChunkResponse(
                contextual_text=contextual_text,
                context_sentence=context_sentence.strip()
            )
        except Exception as e:
            logger.error("[LlmService.contextual_chunk] Error: %s", str(e))
            return ContextualChunkResponse(
                contextual_text=request.text,
                context_sentence=""
            )

    async def doc_summary(self, request):
        if not request.text or not request.text.strip():
            raise AiClientError("Document text cannot be empty")

        text_for_summary = request.text[:4000] if len(request.text) > 4000 else request.text
        doc_context = f"'{request.doc_title}'" if request.doc_title else "tài liệu"

        prompt = f"""Hãy tóm tắt ngắn gọn (3-5 câu) nội dung chính của {doc_context} sau đây.
Tóm tắt phải bao gồm: chủ thể ban hành, mục đích chính, các nội dung/yêu cầu quan trọng.
Viết bằng tiếng Việt, ngắn gọn súc tích.

Nội dung:
{text_for_summary}"""

        try:
            messages = [{"role": "user", "content": prompt}]
            summary_text = await self.ollama_client.chat(request.model, messages, format=None)
            if not summary_text:
                summary_text = request.text[:300].strip()

            summary_vector = await self.batch_embedder.embed(summary_text, normalize=True)

            return DocSummaryResponse(
                summary=summary_text.strip(),
                summary_vector=summary_vector
            )
        except Exception as e:
            logger.error("[LlmService.doc_summary] Error: %s", str(e))
            raise AiServerError("Document summarization failed")
