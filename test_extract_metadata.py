import requests

text = """UBND TỈNH QUẢNG NINH CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
SỞ KHOA HỌC VÀ CÔNG NGHỆ Độc lập - Tự do - Hạnh phúc
Số: /SKHCN-BCVT&TĐC
V/v rà soát, báo cáo về tình hình sử
dụng phần mềm máy tính có bản quyền
(lần 2)
Quảng Ninh, ngày tháng 7 năm 2026
Kính gửi:
- Các sở, ban, ngành thuộc tỉnh;
- Các đơn vị sự nghiệp công lập thuộc tỉnh;
- UBND các xã, phường, đặc khu."""

resp = requests.post("http://127.0.0.1:8001/api/extract-metadata", json={"text": text})
print(resp.json())
