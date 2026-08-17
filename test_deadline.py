import re
import calendar

def test_extract(text, keywords, exclude_keywords):
    result = {"ThoiHan": ""}
    sorted_keywords = sorted(keywords, key=len, reverse=True)
    kw_pattern = "|".join(map(re.escape, sorted_keywords))
    
    date_pattern = r'(?:\s+)?(?:(?:ngày\s*)?(\d{1,2})[/\-\s]+(?:tháng\s*)?(\d{1,2})[/\-\s]+(?:năm\s*)?(\d{4})|(\d{1,2})[/\-](\d{1,2})[/\-](\d{4}))'
    full_pattern = f"(?:{kw_pattern}){date_pattern}"
    
    matches = re.finditer(full_pattern, text, re.IGNORECASE)
    for match in matches:
        matched_text = match.group(0).lower()
        is_excluded = False
        for excl in exclude_keywords:
            if excl.lower() in matched_text:
                is_excluded = True
                break
                
        if not is_excluded:
            groups = match.groups()
            if groups[0] and groups[1] and groups[2]:
                d, mo, y = groups[0], groups[1], groups[2]
            elif groups[3] and groups[4] and groups[5]:
                d, mo, y = groups[3], groups[4], groups[5]
            else:
                continue
                
            try:
                result["ThoiHan"] = f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
                break
            except ValueError:
                pass
                
    if not result["ThoiHan"] and keywords:
        month_pattern = r'(?:\s+)?(?:trong\s+tháng|tháng)\s+(\d{1,2})[/\-\s]+(?:năm\s*)?(\d{4})'
        full_month_pattern = f"(?:{kw_pattern}){month_pattern}"
        matches = re.finditer(full_month_pattern, text, re.IGNORECASE)
        for match in matches:
            mo, y = match.groups()
            try:
                mo_int = int(mo)
                y_int = int(y)
                last_day = calendar.monthrange(y_int, mo_int)[1]
                result["ThoiHan"] = f"{y_int:04d}-{mo_int:02d}-{last_day:02d}"
                break
            except ValueError:
                pass

    return result["ThoiHan"]

text1 = "Yêu cầu các đơn vị hoàn thành trước ngày 20/12/2026 và nộp báo cáo."
text2 = "Sẽ xong trong tháng 8 năm 2026 nhé."

keywords = ["hoàn thành trước ngày", "xong trong tháng", "xong"]
exclude = []

print("Test 1:", test_extract(text1, keywords, exclude))
print("Test 2:", test_extract(text2, keywords, exclude))

