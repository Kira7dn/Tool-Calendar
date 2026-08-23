import logging
import os
import re
import json
from exceptions import AiClientError, AiServerError
from schemas import ExtractFastResponse, ExtractMetadataResponse, ExtractKeywordsResponse

logger = logging.getLogger(__name__)

class DocumentService:
    def __init__(self, docling_extractor, ollama_client, settings):
        self.docling = docling_extractor
        self.ollama_client = ollama_client
        self.settings = settings

    def extract_document(self, request):
        if not self.docling.is_available:
            raise AiServerError("Docling not installed")
        
        result = self.docling.extract(request.file_path)
        if result.error:
            logger.error("[DocumentService.extract] Error: %s", result.error)
            raise AiServerError(result.error)
            
        return result.to_dict()

    def extract_fast(self, request):
        if not os.path.exists(request.file_path):
            return ExtractFastResponse(text="")
            
        try:
            if request.file_path.lower().endswith('.pdf'):
                import pypdf
                reader = pypdf.PdfReader(request.file_path)
                fast_text = ""
                for page in reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        fast_text += extracted + "\n"
                return ExtractFastResponse(text=fast_text.strip())
        except Exception as e:
            logger.warning("[DocumentService.extract_fast] Error: %s", str(e))
            
        return ExtractFastResponse(text="")

    async def extract_metadata(self, request):
        if not request.text or not request.text.strip():
            raise AiClientError("Text cannot be empty")

        def _regex_extract(text: str) -> dict:
            result = {
                "SoVanBan": "", "TenCongVan": "CÔNG VĂN", "TrichYeu": "",
                "NgayBanHanh": "", "ThoiHan": "", "CoQuanBanHanh": "",
                "CoQuanChuQuan": "", "Priority": "Thường"
            }
            
            m = re.search(r'(?m)^[\s]*(?:Số|SỐ)[:\s]+([0-9]+[\s]*[/-][A-Z0-9ĐÀ-Ỵa-zà-ỵ&]+(?:[-/][A-Z0-9ĐÀ-Ỵa-zà-ỵ&]+)*)', text, re.IGNORECASE)
            if m:
                result["SoVanBan"] = m.group(1).strip().replace(" ", "")

            m = re.search(r'ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})', text, re.IGNORECASE)
            if m:
                d, mo, y = m.groups()
                result["NgayBanHanh"] = f"{y}-{int(mo):02d}-{int(d):02d}"

            m = re.search(r'(?:V/v|V/v:|Về việc)[:\s]*(.+?)(?=\nKính gửi|\n\n|\r\n\r\n|Kính gửi:)', text, re.IGNORECASE | re.DOTALL)
            if m:
                ty = re.sub(r'\s+', ' ', m.group(1)).strip()
                ty = re.sub(r'[A-ZÀ-Ỵa-zà-ỵ\s]+,\s*ngày.*$', '', ty).strip()
                result["TrichYeu"] = ty[:500]

            lines = [l.strip() for l in text.split('\n') if l.strip() and 'CỘNG HÒA' not in l.upper()]
            if lines:
                result["CoQuanBanHanh"] = lines[0]
                if result["CoQuanBanHanh"].upper().startswith("UBND"):
                    if len(lines) > 1 and "Số" not in lines[1]:
                        result["CoQuanBanHanh"] = lines[1]

            text_upper = text.upper()
            for vb_type in ["QUYẾT ĐỊNH", "THÔNG TƯ", "NGHỊ ĐỊNH", "BÁO CÁO", "TỜ TRÌNH", "CÔNG VĂN"]:
                if vb_type in text_upper:
                    result["TenCongVan"] = vb_type
                    break

            if "HỎA TỐC" in text_upper:
                result["Priority"] = "Hỏa tốc"
            elif "KHẨN" in text_upper:
                result["Priority"] = "Khẩn"

            if request.deadline_keywords:
                sorted_keywords = sorted(request.deadline_keywords, key=len, reverse=True)
                escaped_kws = [re.escape(k).replace(r"\ ", r"\s+") for k in sorted_keywords]
                kw_pattern = "|".join(escaped_kws)
                date_pattern = r'(?:\s+)?(?:(?:ngày\s*)?(\d{1,2})[/\-\s]+(?:tháng\s*)?(\d{1,2})[/\-\s]+(?:năm\s*)?(\d{4})|(\d{1,2})[/\-](\d{1,2})[/\-](\d{4}))'
                full_pattern = f"(?:{kw_pattern}){date_pattern}"
                
                matches = re.finditer(full_pattern, text, re.IGNORECASE)
                for match in matches:
                    matched_text = match.group(0).lower()
                    
                    is_excluded = False
                    for excl in request.deadline_exclude_keywords:
                        if excl.lower() in matched_text:
                            is_excluded = True
                            break
                            
                    if not is_excluded:
                        groups = match.groups()
                        if groups[0] and groups[1] and groups[2]:
                            d, mo, y = groups[0], groups[1], groups[2]
                        elif groups[3] and groups[4] and groups[5]:
                            d, mo, y = groups[3], groups[4], groups[5]
                        else: continue
                        try:
                            parsed_date = f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
                            result["ThoiHan"] = parsed_date
                            break
                        except ValueError: pass
            return result

        fallback = _regex_extract(request.text)

        USE_LLM_METADATA = self.settings.metadata_use_llm if self.settings else True
        MAX_METADATA_CHARS = 1500  # R-P04: Chỉ đọc 1500 ký tự đầu tiên để tránh ngợp & giảm độ trễ

        STRUCTURED_FIELDS = {"SoVanBan", "NgayBanHanh", "ThoiHan"}
        JUNK_VALUES = {"none", "null", "không có", "không đề cập", "", "n/a"}

        if USE_LLM_METADATA:
            try:
                text_for_llm = request.text[:MAX_METADATA_CHARS]
                prompt = (
                    "Bạn là chuyên gia phân tích công văn hành chính. Trích xuất thông tin từ văn bản sau.\n"
                    "TRẢ VỀ JSON VỚI CÁC KEY: SoVanBan, TenCongVan, TrichYeu, NgayBanHanh (YYYY-MM-DD), "
                    "ThoiHan (YYYY-MM-DD), CoQuanBanHanh, CoQuanChuQuan, Priority (Thường/Khẩn/Hỏa tốc).\n"
                    "TUYỆT ĐỐI KHÔNG BỊA ĐẶT THÔNG TIN. NẾU KHÔNG THẤY, ĐỂ RỖNG \"\".\n"
                    f"Văn bản:\n{text_for_llm}"
                )
                messages = [{"role": "user", "content": prompt}]

                response_text = await self.ollama_client.chat(request.model, messages, format="json")
                try:
                    parsed = json.loads(response_text)
                except json.JSONDecodeError:
                    parsed = {}

                for k in fallback.keys():
                    if k not in parsed:
                        continue
                    ai_val = str(parsed[k]).strip()
                    if ai_val.lower() in JUNK_VALUES:
                        continue
                    # R-P04: AI chỉ được điền khi Regex thất bại (giá trị hiện tại đang rỗng)
                    if not fallback[k]:
                        fallback[k] = ai_val

            except Exception as e:
                logger.warning("[DocumentService.extract_metadata] Lỗi AI, sử dụng Regex: %s", str(e))

        return ExtractMetadataResponse(**fallback)

    async def extract_keywords(self, request):
        text_sample = request.text[:1500] if request.text and len(request.text) > 1500 else request.text
        if not text_sample:
            text_sample = request.doc_title

        prompt = f"""Bạn là AI chuyên trích xuất từ khóa tìm kiếm (Search Query Generator). 
Nhiệm vụ của bạn là đọc văn bản/câu hỏi sau và trích xuất ra 1-3 TỪ KHÓA CỐT LÕI NHẤT để tra cứu trên trang Thư viện Pháp luật.
QUY TẮC BẮT BUỘC:
- Tuyệt đối không đặt câu hỏi.
- Từ khóa ngắn gọn, tập trung vào danh từ, số hiệu, tên luật pháp.
- Mỗi từ khóa trên 1 dòng, KHÔNG đánh số thứ tự, KHÔNG giải thích.
Văn bản/Câu hỏi: {text_sample}
Từ khóa:"""
        try:
            messages = [{"role": "user", "content": prompt}]
            ai_text = await self.ollama_client.chat(request.model, messages, format=None)
            if not ai_text:
                return ExtractKeywordsResponse(keywords=[request.doc_title or "văn bản pháp luật"])
            
            lines = ai_text.splitlines()
            keywords_list = []
            for line in lines:
                k = line.strip(' "\'.*-123456789')
                if k and len(k) < 100 and not k.startswith("["):
                    keywords_list.append(k)
            
            if keywords_list:
                return ExtractKeywordsResponse(keywords=keywords_list[:3])
            return ExtractKeywordsResponse(keywords=[request.doc_title or "văn bản pháp luật"])
        except Exception as e:
            logger.error("[DocumentService.extract_keywords] Error: %s", str(e))
            return ExtractKeywordsResponse(keywords=[request.doc_title or "văn bản pháp luật"])
