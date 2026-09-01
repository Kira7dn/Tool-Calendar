from pydantic import BaseModel, Field, field_validator
from typing import Optional
import os

class ExtractRequest(BaseModel):
    file_path: str

    @field_validator("file_path")
    @classmethod
    def _check_path_safety(cls, v: str) -> str:
        """Chặn path traversal: chỉ cho phép file trong /app/Uploads"""
        abs_path = os.path.realpath(v)
        allowed_roots = ["/app/Uploads", "/app/uploads", "/tmp"]
        if not any(abs_path.startswith(root) for root in allowed_roots):
            raise ValueError(f"file_path phải nằm trong thư mục Uploads được phép, nhận được: {v}")
        return v

class ExtractFastResponse(BaseModel):
    text: str

class ExtractKeywordsRequest(BaseModel):
    text: str
    doc_title: str = ""
    model: str = "qwen2.5:3b"

class ExtractKeywordsResponse(BaseModel):
    keywords: list[str]

class ExtractMetadataRequest(BaseModel):
    # R-S03: Giới hạn 500k ký tự — tránh OOM khi gửi văn bản khổng lồ
    text: str = Field(..., max_length=500_000)
    deadline_keywords: list[str] = []
    deadline_exclude_keywords: list[str] = []
    model: str = "qwen2.5:3b"

class ExtractMetadataResponse(BaseModel):
    SoVanBan: str = ""
    TenCongVan: str = ""
    TrichYeu: str = ""
    NgayBanHanh: str = ""
    ThoiHan: str = ""
    CoQuanBanHanh: str = ""
    CoQuanChuQuan: str = ""
    Priority: str = "Thường"
