import re

text = """
UBND TỈNH QUẢNG NINH CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
SỞ KHOA HỌC VÀ CÔNG NGHỆ Độc lập - Tự do - Hạnh phúc
Số: 3206 /SKHCN-BCVT&TĐC
V/v rà soát, báo cáo về tình hình sử
dụng phần mềm máy tính có bản quyền
(lần 2)
Quảng Ninh, ngày 10 tháng 7 năm 2026
Kính gửi:
"""

def extract(text):
    result = {"SoVanBan": "", "NgayBanHanh": "", "TrichYeu": "", "CoQuanBanHanh": ""}
    
    # 1. Số văn bản
    m = re.search(r'(?:Số|SỐ)[:\s]+([0-9]+[\s]*[/-][A-Z0-9ĐÀ-Ỵà-ỵ&]+(?:[-/][A-Z0-9ĐÀ-Ỵà-ỵ&]+)*)', text, re.IGNORECASE)
    if m:
        result["SoVanBan"] = m.group(1).strip().replace(" ", "")
        
    # 2. Ngày ban hành
    m = re.search(r'ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})', text, re.IGNORECASE)
    if m:
        result["NgayBanHanh"] = f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
        
    # 3. Trích yếu
    m = re.search(r'(?:V/v|Về việc)[:\s]*(.+?)(?=\nKính gửi|\n\n|\r\n\r\n|Kính gửi:)', text, re.IGNORECASE | re.DOTALL)
    if m:
        ty = re.sub(r'\s+', ' ', m.group(1)).strip()
        # Loại bỏ đoạn "Quảng Ninh, ngày..." bị lọt vào
        ty = re.sub(r'[A-ZÀ-Ỵa-zà-ỵ\s]+,\s*ngày.*$', '', ty).strip()
        result["TrichYeu"] = ty

    # 4. Cơ quan ban hành
    lines = [l.strip() for l in text.split('\n') if l.strip() and 'CỘNG HÒA' not in l.upper()]
    if lines:
        result["CoQuanBanHanh"] = lines[0]
        if result["CoQuanBanHanh"].upper().startswith("UBND"):
            # Lấy dòng thứ 2 nếu có
            if len(lines) > 1 and "Số" not in lines[1]:
                result["CoQuanBanHanh"] = lines[1]
                
    return result

print(extract(text))
