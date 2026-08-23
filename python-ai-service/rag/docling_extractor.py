"""
Docling Document Extractor — Thay thế PaddleOCR
Học từ docling/docling/document_converter.py + standard_pdf_pipeline.py

Tại sao Docling tốt hơn PaddleOCR thuần:
1. Hiểu LAYOUT: bảng biểu, heading, cột → không bị mất thông tin cấu trúc
2. Multi-format: PDF / Word (.docx) / Excel (.xlsx) / HTML → 1 API duy nhất
3. Thread-safe pipeline với bounded queues, back-pressure (không OOM)
4. Output Markdown có cấu trúc → chunker dùng heading để split tốt hơn

Pipeline:
  File (PDF/Word/Excel) → DocumentConverter → ConversionResult → structured Markdown

Học từ:
  docling/docling/document_converter.py — DocumentConverter, InputFormat, PipelineOptions
  docling/docling/pipeline/standard_pdf_pipeline.py — ThreadedQueue, back-pressure
  docling/docling/pipeline/base_pipeline.py — multi-format support

Lưu ý: Docling là thư viện lớn (~500MB với models).
Nếu server không đủ RAM, dùng DOCLING_USE_SIMPLE_PIPELINE=true để tắt table detection.
"""

import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Check docling availability
try:
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    _DOCLING_AVAILABLE = True
    logger.info("[DoclingExtractor] docling available ✓")
except ImportError:
    _DOCLING_AVAILABLE = False
    logger.warning(
        "[DoclingExtractor] docling not installed. "
        "Endpoints will return 503. Install with: pip install docling"
    )


class ExtractionResult:
    """Kết quả extract từ document"""
    def __init__(
        self,
        text: str,
        markdown: str,
        num_pages: int,
        format_detected: str,
        tables_count: int = 0,
        error: Optional[str] = None,
    ):
        self.text = text
        self.markdown = markdown
        self.num_pages = num_pages
        self.format_detected = format_detected
        self.tables_count = tables_count
        self.error = error

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "markdown": self.markdown,
            "num_pages": self.num_pages,
            "format_detected": self.format_detected,
            "tables_count": self.tables_count,
            "error": self.error,
        }


class DoclingExtractor:
    """
    Document Extractor dùng Docling.

    Học từ DocumentConverter của docling:
    - Tự detect format từ extension / MIME type
    - Pipeline options để bật/tắt table detection, OCR
    - ThreadedQueue với back-pressure (từ standard_pdf_pipeline.py)

    Thay thế cho: PaddleOCR thuần, chỉ đọc raw text không hiểu structure.
    """

    def __init__(self):
        import torch._dynamo
        torch._dynamo.config.suppress_errors = True

        if not _DOCLING_AVAILABLE:
            self._converter = None
            return

        # Học từ docling: PdfPipelineOptions để configure pipeline
        # do_table_structure=True → bảng biểu được parse thành Markdown table
        # do_ocr=True → dùng OCR cho scanned PDF
        use_simple = os.getenv("DOCLING_USE_SIMPLE_PIPELINE", "false").lower() == "true"

        pdf_options = PdfPipelineOptions()
        if use_simple:
            # Simple mode: không table detection, ít RAM hơn (~200MB)
            # Nhánh này dùng khi DOCLING_USE_SIMPLE_PIPELINE=true (production mặc định)
            logger.info("[DoclingExtractor] Using simple pipeline (no table detection, no OCR)")
            pdf_options.do_table_structure = False
            pdf_options.do_ocr = False
            self._converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_options)
                }
            )
        else:
            # Full pipeline: table + heading + OCR
            # Nhánh này chạy khi fast-path (pypdfium2) THẤT BẠI → tức là PDF scan/ảnh → CẦN OCR
            # Engine: rapidocr-onnxruntime (không cần GPU, ~90MB, hỗ trợ tiếng Việt)
            pdf_options.do_table_structure = True
            pdf_options.do_ocr = True  # ← bật OCR cho PDF scan/ảnh
            try:
                from docling.datamodel.pipeline_options import RapidOcrOptions
                pdf_options.ocr_options = RapidOcrOptions()
                logger.info("[DoclingExtractor] OCR engine: rapidocr-onnxruntime")
            except ImportError:
                # Nếu rapidocr chưa được cài, Docling sẽ dùng engine mặc định
                logger.warning("[DoclingExtractor] rapidocr not available, using Docling default OCR")

            self._converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_options)
                }
            )
            logger.info("[DoclingExtractor] Full pipeline with OCR initialized")

    def extract(self, file_path: str) -> ExtractionResult:
        """
        Extract text từ document.

        Args:
            file_path: Đường dẫn file (PDF, DOCX, XLSX, HTML...)

        Returns:
            ExtractionResult với text + markdown + metadata
        """
        if not _DOCLING_AVAILABLE or self._converter is None:
            return ExtractionResult(
                text="", markdown="", num_pages=0,
                format_detected="unknown",
                error="docling not installed"
            )

        path = Path(file_path)
        if not path.exists():
            return ExtractionResult(
                text="", markdown="", num_pages=0,
                format_detected=path.suffix,
                error=f"File not found: {file_path}"
            )

        try:
            # --- FAST PATH CHO PDF NATIVE ---
            # Dùng pypdfium2 (có sẵn trong docling) để thử đọc text thô trước.
            # Nếu PDF đã có sẵn chữ (native), ta skip luôn mô hình PyTorch siêu nặng của Docling.
            is_pdf = path.suffix.lower() == ".pdf"
            if is_pdf:
                try:
                    import pypdfium2 as pdfium
                    pdf = pdfium.PdfDocument(file_path)
                    fast_text = ""
                    for i in range(len(pdf)):
                        fast_text += pdf[i].get_textpage().get_text_bounded() + "\n"
                    
                    # Nếu text trung bình > 50 ký tự mỗi trang, đây là file native
                    if len(fast_text) > 50 * len(pdf):
                        logger.info(f"[DoclingExtractor] Fast path success for '{path.name}': extracted {len(fast_text)} chars from {len(pdf)} pages instantly.")
                        num_pages = len(pdf)
                        pdf.close()
                        return ExtractionResult(
                            text=fast_text.strip(),
                            markdown=fast_text.strip(), # Text thô
                            num_pages=num_pages,
                            format_detected="pdf",
                            tables_count=0
                        )
                    pdf.close()
                except Exception as e:
                    logger.warning(f"[DoclingExtractor] Fast path failed for {path.name}: {e}")

            # Học từ DocumentConverter.convert() — tự detect format
            # Đoạn này sẽ chạy cho ảnh, PDF scan (ít chữ), hoặc docx
            result = self._converter.convert(file_path)

            # Export to Markdown — bảo toàn cấu trúc heading, table
            markdown_text = result.document.export_to_markdown()

            # Export to plain text — cho embedding
            plain_text = result.document.export_to_text()

            # Đếm bảng biểu (nếu có table detection)
            tables_count = 0
            try:
                tables_count = len(list(result.document.tables))
            except Exception:
                pass

            # Số trang (chỉ có với PDF)
            num_pages = 0
            try:
                num_pages = result.input.page_count or 0
            except Exception:
                pass

            format_detected = path.suffix.lower().lstrip(".")

            logger.info(
                "[DoclingExtractor] Extracted '%s': %d chars, %d pages, %d tables",
                path.name, len(plain_text), num_pages, tables_count
            )

            return ExtractionResult(
                text=plain_text,
                markdown=markdown_text,
                num_pages=num_pages,
                format_detected=format_detected,
                tables_count=tables_count,
            )

        except Exception as e:
            logger.error("[DoclingExtractor] Error extracting '%s': %s", file_path, str(e))
            return ExtractionResult(
                text="", markdown="", num_pages=0,
                format_detected=path.suffix,
                error=str(e)
            )

    @property
    def is_available(self) -> bool:
        return _DOCLING_AVAILABLE and self._converter is not None


# Global singleton
_extractor_instance: Optional[DoclingExtractor] = None


def get_docling_extractor() -> DoclingExtractor:
    global _extractor_instance
    if _extractor_instance is None:
        _extractor_instance = DoclingExtractor()
    return _extractor_instance
