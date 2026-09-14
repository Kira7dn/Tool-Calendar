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
                # Ưu tiên dùng pdftotext (poppler) vì nó đọc được các Form Fields, Annotations ẩn
                # pdftotext -layout giữ nguyên định dạng trực quan (ví dụ: "Số:    05")
                import subprocess
                try:
                    result = subprocess.run(
                        ["pdftotext", "-layout", "-nopgbrk", request.file_path, "-"],
                        capture_output=True,
                        text=True,
                        check=True
                    )
                    if result.stdout and len(result.stdout.strip()) > 10:
                        return ExtractFastResponse(text=result.stdout.strip())
                except Exception as e:
                    logger.warning("[DocumentService.extract_fast] pdftotext failed, fallback to pypdfium2: %s", str(e))
                
                # Fallback: dùng pypdfium2 nếu pdftotext không hoạt động
                import pypdfium2 as pdfium
                pdf = pdfium.PdfDocument(request.file_path)
                fast_text = ""
                for page in pdf:
                    textpage = page.get_textpage()
                    extracted = textpage.get_text_range()
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
            import unicodedata
            text = unicodedata.normalize('NFC', text)
            result = {
                "SoVanBan": "", "TenCongVan": "CÔNG VĂN", "TrichYeu": "",
                "NgayBanHanh": "", "ThoiHan": "", "CoQuanBanHanh": "",
                "CoQuanChuQuan": "", "Priority": "Thường"
            }
            
            m = re.search(r'(?i:s[oốôóòỏõọ])[:\s]*([0-9]+[\s]*[/-][\s]*[a-z0-9đà-ỵ&]+(?:[\s]*[-/][\s]*[a-z0-9đà-ỵ&]+)*)', text, re.IGNORECASE)
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

            # Pattern cắt bỏ nội dung cột phải bị dính (≥2 khoảng trắng + cụm header phải)
            _right_col_patterns = [
                r'\s{2,}Độc\s+lập',
                r'\s{2,}Tự\s+do',
                r'\s{2,}Hạnh\s+phúc',
                r'\s{2,}CỘNG\s+HÒA',
                r'\s{2,}Cộng\s+hòa',
                r'\s{2,}[A-ZÀ-Ỵa-zà-ỵ\s]+,\s*ngày\s+\d',   # "Quảng Ninh, ngày 02..."
            ]
            def _strip_right_col(s: str) -> str:
                for _p in _right_col_patterns:
                    s = re.split(_p, s, maxsplit=1, flags=re.IGNORECASE)[0].strip()
                return s

            # Lọc: bỏ dòng CỘNG HÒA, strip cột phải, bỏ dòng rỗng sau khi strip
            lines = []
            for l in text.split('\n'):
                l = l.strip()
                if not l or 'CỘNG HÒA' in l.upper():
                    continue
                l = _strip_right_col(l)
                if l:
                    lines.append(l)

            # Marker dừng: bắt đầu số hiệu hoặc trích yếu hoặc kính gửi
            _stop_re = re.compile(r'^(Số[\s:./]|V/v|Kính gửi|Căn cứ)', re.IGNORECASE)

            if lines:
                if lines[0].upper().startswith('UBND'):
                    # Dòng UBND → CoQuanChuQuan (nếu chưa có giá trị nào tốt hơn từ LLM sau này)
                    result["CoQuanChuQuan"] = lines[0]
                    # Ghép các dòng tiếp theo thành CoQuanBanHanh cho đến khi gặp marker dừng
                    org_parts = []
                    for l in lines[1:]:
                        if _stop_re.match(l):
                            break
                        # Bỏ các dòng là năm đơn thuần (vd "NĂM 2026") nếu đứng riêng lẻ
                        # nhưng vẫn giữ nếu nó là một phần của tên tổ chức có từ kèm theo
                        org_parts.append(l)
                    if org_parts:
                        result["CoQuanBanHanh"] = ' '.join(org_parts)
                    elif len(lines) > 1:
                        result["CoQuanBanHanh"] = lines[1]
                else:
                    result["CoQuanBanHanh"] = lines[0]

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

        # Trường có cấu trúc rõ → Regex chính xác hơn, AI chỉ fill-empty
        STRUCTURED_FIELDS = {"SoVanBan", "NgayBanHanh", "ThoiHan"}
        # Trường ngữ nghĩa → AI hiểu ngữ cảnh tốt hơn, được phép override Regex
        LLM_PRIORITY_FIELDS = {"CoQuanBanHanh", "CoQuanChuQuan"}
        JUNK_VALUES = {"none", "null", "không có", "không đề cập", "", "n/a"}

        if USE_LLM_METADATA:
            try:
                text_for_llm = request.text[:MAX_METADATA_CHARS]
                prompt = (
                    "Bạn là chuyên gia phân tích công văn hành chính Việt Nam. Trích xuất thông tin từ văn bản sau.\n"
                    "TRẢ VỀ JSON VỚI CÁC KEY: SoVanBan, TenCongVan, TrichYeu, NgayBanHanh (YYYY-MM-DD), "
                    "ThoiHan (YYYY-MM-DD), CoQuanBanHanh, CoQuanChuQuan, Priority (Thường/Khẩn/Hỏa tốc).\n"
                    "HƯỚNG DẪN ĐẶC BIỆT:\n"
                    "- Header văn bản hành chính VN có 2 cột: cột TRÁI là tên cơ quan, cột PHẢI là 'Cộng hòa...Độc lập...'.\n"
                    "- CoQuanChuQuan: là dòng đầu tiên cột TRÁI (thường là UBND Tỉnh/Huyện/Bộ/Ban...). Tuyệt đối lấy từ văn bản, KHÔNG tự bịa.\n"
                    "- CoQuanBanHanh: là tên đơn vị ban hành trực tiếp bên dưới CoQuanChuQuan (nếu có). Có thể trải nhiều dòng. Nếu chỉ có 1 cơ quan (VD: Ủy ban nhân dân Phường X) thì đó là CoQuanBanHanh, còn CoQuanChuQuan để rỗng.\n"
                    "- TUYỆT ĐỐI không lấy 'Độc lập - Tự do - Hạnh phúc', địa danh ngày tháng, hay nội dung thân bài vào 2 trường này.\n"
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
                    if k in LLM_PRIORITY_FIELDS:
                        # AI được phép override Regex với 2 trường ngữ nghĩa này
                        fallback[k] = ai_val
                    elif not fallback[k]:
                        # R-P04: Các trường khác — AI chỉ điền khi Regex thất bại
                        fallback[k] = ai_val

            except Exception as e:
                logger.warning("[DocumentService.extract_metadata] Lỗi AI, sử dụng Regex: %s", str(e))


        return ExtractMetadataResponse(**fallback)

    async def extract_keywords(self, request):
        text_sample = request.text[:1500] if request.text and len(request.text) > 1500 else request.text
        if not text_sample:
            text_sample = request.doc_title

        prompt = f"""Bạn là chuyên gia phân tích pháp lý. Nhiệm vụ của bạn là đọc nội dung công văn dưới đây và rút trích ra MỘT HOẶC HAI TỪ KHÓA QUAN TRỌNG NHẤT dùng để tra cứu trên Thư viện Pháp luật.
QUY TẮC BẮT BUỘC:
- BỎ QUA các phần tiêu đề hành chính (như: UBND Tỉnh, Sở Y tế, Bộ Y tế, Cộng hòa xã hội...).
- TẬP TRUNG vào phần "Trích yếu" (V/v...), phần "Căn cứ" (Luật, Nghị định, Thông tư...) hoặc nội dung chính.
- Từ khóa phải là tên của một quy định pháp luật, số hiệu văn bản, hoặc chủ đề chính của công văn (VD: Luật Khám bệnh chữa bệnh, Thông tư 22/2023, Quản lý chất thải y tế...).
- Tuyệt đối không sinh ra câu dài. Mỗi từ khóa trên 1 dòng. KHÔNG đánh số thứ tự, KHÔNG gạch đầu dòng, KHÔNG giải thích.
Văn bản: {text_sample}
Từ khóa tìm kiếm:"""
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
