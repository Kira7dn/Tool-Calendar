import re

text = """
ỦY BAN NHÂN DÂN       CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM
PHƯỜNG CẨM PHẢ               Độc lập - Tự do - Hạnh phúc
Số: 1374 /QĐ-UBND      Cẩm Phả, ngày  31  tháng 12 năm 2025
QUYẾT ĐỊNH
"""

header_text = text[:1000]

m1 = re.search(r'ng.y\s*(\d{1,2})\s*th.ng\s*(\d{1,2})\s*n.m\s*(\d{4})', header_text, re.IGNORECASE)
if m1:
    print("m1:", m1.groups())
else:
    print("m1 failed")

# What if "ngày" has 2 spaces?
text2 = "Cẩm Phả, ng ày 3 1 th áng 1 2 năm 2 0 2 5"
# wait, OCR might output "ng ày" or "n g à y" ?
