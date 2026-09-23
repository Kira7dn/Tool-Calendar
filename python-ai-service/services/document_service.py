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
            
            # Giới hạn tìm kiếm trong 1000 ký tự đầu tiên để tránh nhặt nhầm số trong phần thân bài
            header_text = text[:1000]

            # Pre-normalize superscript Unicode trước khi chạy regex
            # OCR viết tay hay tạo ra ký tự superscript: ¹²³⁴⁵⁶⁷⁸⁹⁰
            _superscript_map = str.maketrans('¹²³⁴⁵⁶⁷⁸⁹⁰', '1234567890')
            header_text = header_text.translate(_superscript_map)

            # ─── Bộ chuẩn hóa SoVanBan nhiều lớp ───────────────────────────────────────
            # Mục tiêu: xử lý mọi dạng nhiễu OCR từ văn bản viết tay/scan mờ
            # KHÔNG dùng AI cho tầng này → nhanh hơn 1000x, không bao giờ bịa số
            def _normalize_so_van_ban(raw: str) -> str:
                """Chuẩn hóa số văn bản OCR về dạng chuẩn: 515/BCA-QLHC"""
                if not raw:
                    return ""
                import unicodedata

                # Bước 1: Chuẩn hóa Unicode (NFC) — xử lý ký tự tổ hợp
                raw = unicodedata.normalize('NFC', raw)

                # Bước 2: Thay thế ký tự đặc biệt bị OCR nhầm
                ocr_char_map = {
                    'O': '0', 'o': '0',   # chữ O → số 0 (chỉ trong phần số)
                    'I': '1', 'l': '1',   # chữ I/l → số 1 (chỉ trong phần số)
                    ',': '.',              # dấu phẩy thập phân
                    '¹': '1', '²': '2', '³': '3',  # superscript
                    '⁴': '4', '⁵': '5', '⁶': '6',
                    '⁷': '7', '⁸': '8', '⁹': '9', '⁰': '0',
                }
                # Tìm vị trí dấu /
                slash_pos = raw.find('/')
                if slash_pos == -1:
                    slash_pos = len(raw)
                # Chỉ thay OCR char trong phần SỐ (trước /)
                num_part = raw[:slash_pos]
                suffix = raw[slash_pos:]
                for wrong, right in ocr_char_map.items():
                    num_part = num_part.replace(wrong, right)
                raw = num_part + suffix

                # Bước 3: Xóa ký tự thừa không phải số/chữ trong phần số
                # VD: "5.15/BCA" → "515/BCA", "5-15/BCA" → "515/BCA" (khi trước / chỉ toàn số)
                # KHÔNG strip nếu phần trước / có cả chữ (VD: "904-CV/VPTU" → giữ nguyên)
                slash_pos = raw.find('/')
                if slash_pos > 0:
                    num_part = raw[:slash_pos]
                    suffix = raw[slash_pos:]
                    # Chỉ strip nhiễu khi phần trước / toàn số (không có chữ cái)
                    if re.match(r'^[\d\s\.\-]+$', num_part):
                        num_part = re.sub(r'[\s\.\-]', '', num_part)  # "5 . 15" → "515"
                    # Nếu có chữ cái (VD: "904 -CV") → chỉ strip khoảng trắng thừa
                    else:
                        num_part = num_part.strip()
                    raw = num_part + suffix

                # Bước 4: Chuẩn hóa khoảng trắng quanh / và -
                # VD: "515 / BCA - QLHC" → "515/BCA-QLHC"
                raw = re.sub(r'\s*/\s*', '/', raw)
                raw = re.sub(r'\s*-\s*', '-', raw)

                # Bước 5: Xóa khoảng trắng thừa còn sót
                raw = raw.strip()

                # Bước 6: Validate — phải có ít nhất 1 số và 1 chữ cái, có dấu /
                if not re.search(r'\d', raw) or not re.search(r'[a-zA-ZĐđ]', raw) or '/' not in raw:
                    return ""

                return raw


            _SO_VAN_BAN_PATTERNS = [
                # Pattern 1: "Số: 515/BCA-QLHC" — chuẩn, có từ "Số" rõ ràng
                # Cho phép khoảng trắng quanh dấu - trong suffix ("BCA - QLHC" → "BCA-QLHC")
                r'(?:S[oốôóòỏõọ06][:\.\s]+)'
                r'([\d][\d\s\.\-]{0,8}[/][\s]*[A-ZĐÔƯĂ][A-ZĐÔƯĂa-zđôưă0-9\-\.\s]{1,30}'
                r'(?:[/\-][\s]*[A-ZĐÔƯĂa-zđôưă0-9\-\.]+)*)',

                # Pattern 2: OCR nhầm "Số" → "S06", "6o", "56" (dòng bắt đầu bằng số ngay)
                r'(?:^|[\n\r])[\s]*S[0-9o6][:\s]+'
                r'([\d][\d\s]{0,5}[/][\s]*[A-ZĐÔƯĂ][A-ZĐÔƯĂa-z0-9\-\.\s]+)',

                # Pattern 3: Bắt trực tiếp pattern số-ký-hiệu trong header
                # VD: dòng chỉ có "515/BCA-QLHC" không có từ "Số" (bị OCR mất)
                r'(?:^|[\n\r])[\s]*(\d{2,5}[\s]*[/][\s]*[A-ZĐÔƯĂ]{2,}[\-][A-ZĐÔƯĂ]{2,})',

                # Pattern 4: Format "Số 904 -CV/VPTU" — số + dấu - + loại VB + /cơ quan
                # VD: "Số 904 -CV/VPTU", "904-CV/VPTU", "Số904 - CV/VPTU"
                # Khác Pattern 1-3: loại văn bản (CV, TB, QĐ...) nằm SAU dấu - và TRƯỚC dấu /
                r'(?:S[oốôóòỏõọ06][:\.\s]*)?'
                r'(\d{1,5}[\s]*[-][\s]*(?:CV|TB|QĐ|QD|NQ|TT|CT|BC|KH|HD|PB|TL|VB|VP|GM|PC|ĐA|DA|TG|KT|UBND|HĐND)'
                r'[\s]*/[\s]*[A-ZĐÔƯĂ][A-ZĐÔƯĂa-z0-9\-\.]{1,30}'
                r'(?:[/\-][A-ZĐÔƯĂa-z0-9\-\.]+)*)',
            ]


            so_van_ban_found = ""
            for i, pattern in enumerate(_SO_VAN_BAN_PATTERNS):
                flags = re.IGNORECASE | (re.MULTILINE if i >= 1 else 0)
                m = re.search(pattern, header_text, flags)
                if m:
                    normalized = _normalize_so_van_ban(m.group(1).strip())
                    if normalized:
                        so_van_ban_found = normalized
                        break  # Dùng kết quả đầu tiên khớp

            if so_van_ban_found:
                result["SoVanBan"] = so_van_ban_found


            # Nới lỏng regex tối đa: bắt các trường hợp chữ có/không dấu, bắt số bị cắt vụn (vd: 3 1)
            m = re.search(r'ng.y\s*([\d\s]{1,3})\s*th.ng\s*([\d\s]{1,3})\s*n.m\s*([\d\s]{4,7})', header_text, re.IGNORECASE)
            if m:
                try:
                    d = m.group(1).replace(" ", "")
                    mo = m.group(2).replace(" ", "")
                    y = m.group(3).replace(" ", "")
                    result["NgayBanHanh"] = f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
                except:
                    pass

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
        # Lưu ý: SoVanBan đã được tách khỏi STRUCTURED_FIELDS — AI được phép bổ sung khi regex thất bại
        # (văn bản viết tay/dấu in mờ bị OCR đọc lệch, regex không bắt được)
        STRUCTURED_FIELDS = {"NgayBanHanh", "ThoiHan"}
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

                STRUCTURED_FIELDS = {"NgayBanHanh", "ThoiHan"}
                for k in fallback.keys():
                    if k not in parsed:
                        continue
                    ai_val = str(parsed[k]).strip()
                    if ai_val.lower() in JUNK_VALUES:
                        continue
                    if k == "SoVanBan":
                        # AI chỉ điền SoVanBan khi Regex thất bại (số viết tay OCR lệch)
                        # Nhưng AI vẫn bị giới hạn: giá trị phải có dấu / hoặc - để tránh AI bịạ
                        if not fallback[k] and re.search(r'[0-9].*[/\-].*[A-Za-zĐđ]', ai_val):
                            # Làm sạch SoVanBan do AI trả về: xóa khoảng trắng quanh dấu /
                            ai_val = re.sub(r'\s*/\s*', '/', ai_val)
                            ai_val = re.sub(r'\s*-\s*', '-', ai_val)
                            fallback[k] = ai_val
                    elif k in LLM_PRIORITY_FIELDS:
                        # AI được phép override Regex với 2 trường ngữ nghĩa này
                        fallback[k] = ai_val
                    elif not fallback[k]:
                        # Nếu là trường cấu trúc chặt, tuyệt đối cấm AI tự bọa khi Regex đã thất bại
                        if k in STRUCTURED_FIELDS:
                            continue
                        # Các trường khác — AI chỉ điền khi Regex thất bại
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
