"""
Smart Text Chunker — học từ anything-llm/server/utils/TextSplitter/index.js
và gpt-researcher/context/compression.py

Kỹ thuật:
1. RecursiveCharacterTextSplitter (gpt-researcher) — chia text theo ngữ nghĩa,
   ưu tiên cắt ở dấu chấm câu, dòng mới, khoảng trắng
2. ChunkHeaderMeta (anything-llm) — thêm metadata (tên công văn, ngày, nguồn)
   vào đầu mỗi chunk để LLM biết context khi trích dẫn
3. Chunk Overlap — chunk_overlap=100 để không mất context ở ranh giới
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Tham số mặc định học từ anything-llm TextSplitter
# chunk_size=1000 token ≈ 750-800 từ tiếng Việt
DEFAULT_CHUNK_SIZE = 800
DEFAULT_CHUNK_OVERLAP = 100

# Separators theo thứ tự ưu tiên (RecursiveCharacterTextSplitter logic)
# Học từ langchain/gpt-researcher
VIETNAMESE_SEPARATORS = [
    "\n\n",   # Đoạn văn (ưu tiên nhất)
    "\n",     # Dòng mới
    "。",     # Dấu chấm tiếng Trung (đôi khi xuất hiện trong OCR)
    ".",      # Dấu chấm tiếng Việt
    "!",
    "?",
    ";",
    ":",
    " ",      # Khoảng trắng (cuối cùng)
    "",       # Ký tự (fallback)
]

# Adaptive Chunk Size — học từ Dify
def compute_adaptive_chunk_size(text_length: int, base_size: int = DEFAULT_CHUNK_SIZE) -> int:
    """
    DIFY Idea: Adaptive Chunk Size.
    Tài liệu ngắn → chunk nhỏ hơn (giữ nguyên ngữ cảnh).
    Tài liệu dài → chunk lớn hơn (giảm số lượt embed).
    """
    if text_length < 2000:
        return min(base_size, 400)   # Tài liệu ngắn: chia nhỏ
    elif text_length < 10000:
        return base_size             # Vừa: giữ nguyên
    else:
        return min(base_size * 2, 1500)  # Tài liệu dài: chunk lớn hơn


class DocumentChunk:
    """Một chunk văn bản với metadata — tương đương DocumentMetadata trong anything-llm"""

    def __init__(
        self,
        content: str,
        chunk_index: int,
        doc_title: str = "",
        doc_date: str = "",
        doc_source: str = "",
        doc_id: Optional[int] = None,
    ):
        self.content = content
        self.chunk_index = chunk_index
        self.doc_title = doc_title
        self.doc_date = doc_date
        self.doc_source = doc_source
        self.doc_id = doc_id
        # Word count — học từ anything-llm wordCount field
        self.word_count = len(content.split())

    def with_header(self) -> str:
        """
        Tạo chunk text có header metadata — học từ TextSplitter.buildHeaderMeta() của anything-llm.
        Header giúp LLM biết đây là đoạn từ tài liệu nào để trích dẫn chính xác.
        """
        header_parts = []
        if self.doc_title:
            header_parts.append(f"sourceDocument: {self.doc_title}")
        if self.doc_date:
            header_parts.append(f"published: {self.doc_date}")
        if self.doc_source:
            header_parts.append(f"source: {self.doc_source}")

        if header_parts:
            header = "[" + " | ".join(header_parts) + "]\n"
            return header + self.content
        return self.content

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "content_with_header": self.with_header(),
            "chunk_index": self.chunk_index,
            "word_count": self.word_count,
            "doc_title": self.doc_title,
            "doc_id": self.doc_id,
        }


class SmartTextChunker:
    """
    Chunker thông minh cho văn bản tiếng Việt (đặc biệt OCR từ công văn).

    Kết hợp:
    - RecursiveCharacterTextSplitter logic (gpt-researcher)
    - ChunkHeaderMeta pattern (anything-llm)
    - Vietnamese-aware separators
    """

    def __init__(
        self,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def _split_text(self, text: str, chunk_size: int | None = None) -> list[str]:
        """
        Recursive character splitter — cắt text theo separators theo thứ tự ưu tiên.
        """
        effective_size = chunk_size or self.chunk_size
        # Dọn dẹp OCR noise
        text = re.sub(r'[^\x20-\x7E\u00C0-\u024F\u1E00-\u1EFF\n\t]', ' ', text)
        text = re.sub(r'\s{3,}', '\n\n', text)
        text = text.strip()

        if len(text) <= effective_size:
            return [text] if text else []

        chunks = []
        self._recursive_split(text, VIETNAMESE_SEPARATORS, chunks, effective_size)
        return [c for c in chunks if c.strip()]

    def _recursive_split(self, text: str, separators: list[str], chunks: list[str], chunk_size: int | None = None):
        """Dệ quy chia text theo separator tốt nhất"""
        effective_size = chunk_size or self.chunk_size
        if len(text) <= effective_size:
            chunks.append(text)
            return

        separator = ""
        new_separators = []

        # Tìm separator phù hợp
        for i, sep in enumerate(separators):
            if sep == "" or sep in text:
                separator = sep
                new_separators = separators[i + 1:]
                break

        if not separator:
            # Fallback: cắt thẳng
            chunks.append(text[:effective_size])
            remaining = text[effective_size - self.chunk_overlap:]
            self._recursive_split(remaining, separators, chunks, effective_size)
            return

        # Chia theo separator
        splits = text.split(separator) if separator else list(text)
        current_chunk = ""

        for split in splits:
            candidate = (current_chunk + separator + split).strip() if current_chunk else split.strip()

            if len(candidate) > effective_size and current_chunk:
                # Flush current chunk
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                # Bắt đầu chunk mới với overlap
                overlap_text = current_chunk[-self.chunk_overlap:] if len(current_chunk) > self.chunk_overlap else current_chunk
                current_chunk = overlap_text + separator + split if overlap_text else split
            elif len(candidate) > effective_size:
                # Split đơn lẻ quá lớn — đệ quy với separator nhỏ hơn
                if new_separators:
                    self._recursive_split(split, new_separators, chunks, effective_size)
                else:
                    # Force cut
                    for i in range(0, len(split), effective_size - self.chunk_overlap):
                        chunks.append(split[i:i + effective_size])
                current_chunk = ""
            else:
                current_chunk = candidate

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

    def _merge_short_chunks(self, chunks: list[str], min_length: int = 80) -> list[str]:
        """Late Chunking: gộp các chunk quá ngắn vào chunk trước nó."""
        if not chunks:
            return []
        merged = [chunks[0]]
        for chunk in chunks[1:]:
            if len(chunk) < min_length and merged:
                merged[-1] = merged[-1] + " " + chunk
            else:
                merged.append(chunk)
        return merged

    def chunk_document(
        self,
        text: str,
        doc_title: str = "",
        doc_date: str = "",
        doc_source: str = "",
        doc_id: Optional[int] = None,
        adaptive: bool = False,
    ) -> list[DocumentChunk]:
        """
        Chia một văn bản thành danh sách chunks có metadata.

        Args:
            text: Nội dung văn bản (thường là OCR full text)
            doc_title: Tên công văn
            doc_date: Ngày ban hành
            doc_source: Số hiệu công văn
            doc_id: ID trong DB
            adaptive: Bật DIFY Adaptive Chunk Size — thay đổi chunk_size theo độ dài văn bản

        Returns:
            Danh sách DocumentChunk
        """
        # Fix thread-safety: không ghi đè self.chunk_size nữa
        # Truyền chunk_size_to_use xuống _split_text/recursive_split như parameter
        if adaptive:
            chunk_size_to_use = compute_adaptive_chunk_size(len(text), self.chunk_size)
        else:
            chunk_size_to_use = self.chunk_size

        try:
            raw_chunks = self._split_text(text, chunk_size=chunk_size_to_use)
            raw_chunks = self._merge_short_chunks(raw_chunks, min_length=80)
        except Exception as e:
            logger.error("[Chunker] Split error: %s", str(e))
            raw_chunks = [text]  # Fallback: trả nguyên văn bản

        result = []
        for i, chunk_text in enumerate(raw_chunks):
            result.append(DocumentChunk(
                content=chunk_text,
                chunk_index=i,
                doc_title=doc_title,
                doc_date=doc_date,
                doc_source=doc_source,
                doc_id=doc_id,
            ))

        logger.info(
            "[Chunker] Chunked '%s' into %d chunks (size=%d, overlap=%d, adaptive=%s)",
            doc_title or "document", len(result), chunk_size_to_use, self.chunk_overlap, adaptive
        )
        return result
