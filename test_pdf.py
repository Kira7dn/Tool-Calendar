import pypdfium2 as pdfium
import re

pdf_path = "/Users/macbookpro/Tool-Calendar/assets/Cv 1310.signed.pdf"
pdf = pdfium.PdfDocument(pdf_path)
text = ""
for i in range(len(pdf)):
    text += pdf[i].get_textpage().get_text_bounded() + "\n"
pdf.close()

print("--- TEXT EXTRACTED ---")
print(text[:1000])

print("--- MATCHES FOR SO VAN BAN ---")
pattern = re.compile(r'(?:Số|SỐ)[:\s]+([0-9]+[\s]*[/-][A-Z0-9ĐÀ-Ỵà-ỵ&]+(?:[-/][A-Z0-9ĐÀ-Ỵà-ỵ&]+)*)', re.IGNORECASE)
matches = pattern.findall(text)
print("Matches:", matches)

print("--- MATCHES FOR NGAY BAN HANH ---")
pattern2 = re.compile(r'ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})', re.IGNORECASE)
matches2 = pattern2.findall(text)
print("Matches2:", matches2)
