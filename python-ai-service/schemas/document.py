from pydantic import BaseModel
from typing import Optional

class ExtractRequest(BaseModel):
    file_path: str

class ExtractFastResponse(BaseModel):
    text: str

class ExtractKeywordsRequest(BaseModel):
    text: str
    doc_title: str = ""
    model: str = "qwen2.5:3b"

class ExtractKeywordsResponse(BaseModel):
    keywords: list[str]

class ExtractMetadataRequest(BaseModel):
    text: str
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
