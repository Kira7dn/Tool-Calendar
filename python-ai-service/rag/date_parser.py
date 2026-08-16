import datetime
import re
from typing import Optional, Tuple

def parse_vietnamese_date(text: str) -> Tuple[Optional[datetime.datetime], Optional[datetime.datetime]]:
    """
    Parse ngày tháng từ ngôn ngữ tự nhiên (tiếng Việt).
    Trả về tuple (start_date, end_date). Nếu là một ngày cụ thể, start_date = end_date.
    
    Hỗ trợ:
    - hôm nay, ngày mai, ngày kia, hôm qua
    - tuần này, tuần trước, tuần sau
    - tháng này, tháng trước, tháng sau
    - tháng X năm Y
    - năm nay, năm ngoái, năm sau
    """
    text = text.lower().strip()
    now = datetime.datetime.now()
    today = datetime.datetime(now.year, now.month, now.day)
    
    # 1. Các ngày cụ thể tương đối
    if "hôm nay" in text:
        return today, today
    if "ngày mai" in text:
        tomorrow = today + datetime.timedelta(days=1)
        return tomorrow, tomorrow
    if "ngày kia" in text:
        day_after = today + datetime.timedelta(days=2)
        return day_after, day_after
    if "hôm qua" in text:
        yesterday = today - datetime.timedelta(days=1)
        return yesterday, yesterday
        
    # 2. Tuần
    if "tuần này" in text:
        start_week = today - datetime.timedelta(days=today.weekday())
        end_week = start_week + datetime.timedelta(days=6)
        return start_week, end_week
    if "tuần trước" in text:
        start_week = today - datetime.timedelta(days=today.weekday() + 7)
        end_week = start_week + datetime.timedelta(days=6)
        return start_week, end_week
    if "tuần sau" in text:
        start_week = today - datetime.timedelta(days=today.weekday() - 7)
        end_week = start_week + datetime.timedelta(days=6)
        return start_week, end_week
        
    # 3. Tháng
    if "tháng này" in text:
        start_month = datetime.datetime(now.year, now.month, 1)
        next_month = start_month.month + 1 if start_month.month < 12 else 1
        next_month_year = start_month.year if start_month.month < 12 else start_month.year + 1
        end_month = datetime.datetime(next_month_year, next_month, 1) - datetime.timedelta(days=1)
        return start_month, end_month
    
    if "tháng trước" in text:
        prev_month = now.month - 1 if now.month > 1 else 12
        prev_month_year = now.year if now.month > 1 else now.year - 1
        start_month = datetime.datetime(prev_month_year, prev_month, 1)
        end_month = datetime.datetime(now.year, now.month, 1) - datetime.timedelta(days=1)
        return start_month, end_month
        
    # 4. Năm
    if "năm nay" in text:
        return datetime.datetime(now.year, 1, 1), datetime.datetime(now.year, 12, 31)
    if "năm ngoái" in text or "năm trước" in text:
        return datetime.datetime(now.year - 1, 1, 1), datetime.datetime(now.year - 1, 12, 31)
        
    # 5. Khớp ngày cụ thể dd/mm/yyyy
    match_date = re.search(r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})', text)
    if match_date:
        try:
            d = int(match_date.group(1))
            m = int(match_date.group(2))
            y = int(match_date.group(3))
            date_val = datetime.datetime(y, m, d)
            return date_val, date_val
        except:
            pass
            
    # 6. Tháng X năm Y
    match_month = re.search(r'tháng (\d{1,2})( năm (\d{4}))?', text)
    if match_month:
        try:
            m = int(match_month.group(1))
            y = int(match_month.group(3)) if match_month.group(3) else now.year
            start_month = datetime.datetime(y, m, 1)
            next_m = m + 1 if m < 12 else 1
            next_y = y if m < 12 else y + 1
            end_month = datetime.datetime(next_y, next_m, 1) - datetime.timedelta(days=1)
            return start_month, end_month
        except:
            pass
            
    return None, None
