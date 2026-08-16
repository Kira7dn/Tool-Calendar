import re
from datetime import datetime

def fallback_extract_metadata(text: str) -> dict:
    result = {
        "SoVanBan": "",
        "TenCongVan": "",
        "TrichYeu": "",
        "NgayBanHanh": "",
        "ThoiHan": "",
        "CoQuanBanHanh": "",
        "CoQuanChuQuan": "",
        "Priority": "Thường"
    }
    
    # 1. Trích xuất Số văn bản
    so_van_ban_match = re.search(r'(Số|SỐ):\s*([0-9]+/[A-Z0-9Đ]+-[A-Z0-9Đ]+|[0-9]+/[A-Z0-9Đ]+)', text)
    if so_van_ban_match:
        result["SoVanBan"] = so_van_ban_match.group(2)
        
    # 2. Ngày ban hành
    ngay_match = re.search(r'ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})', text, re.IGNORECASE)
    if ngay_match:
        d, m, y = ngay_match.groups()
        result["NgayBanHanh"] = f"{y}-{int(m):02d}-{int(d):02d}"
        
    # 3. Trích yếu
    trich_yeu_match = re.search(r'(V/v|Về việc)\s*([^Kính]+)', text, re.IGNORECASE | re.DOTALL)
    if trich_yeu_match:
        ty = trich_yeu_match.group(2).strip()
        ty = re.sub(r'\s+', ' ', ty)
        result["TrichYeu"] = ty[:500] # Giới hạn độ dài
        
    # 4. Cơ quan ban hành
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if lines:
        result["CoQuanBanHanh"] = lines[0]
        if len(lines) > 1 and "CỘNG" not in lines[1]:
            result["CoQuanChuQuan"] = lines[1]
            
    return result
