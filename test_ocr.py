import requests
import time

url = "http://localhost:8001/api/extract"
file_path = "/Users/macbookpro/Tool-Calendar/assets/Cv 1310.signed.pdf"

print(f"Bắt đầu upload file: {file_path}")
start_time = time.time()

with open(file_path, "rb") as f:
    files = {"file": f}
    try:
        response = requests.post(url, files=files)
        response.raise_for_status()
        end_time = time.time()
        print(f"✅ OCR Thành công! Tổng thời gian: {end_time - start_time:.2f} giây.")
        
        data = response.json()
        print(f"- Số trang: {data.get('num_pages')}")
        print(f"- Có chứa bảng biểu: {data.get('tables_count')}")
        print(f"- Độ dài text: {len(data.get('text', ''))} ký tự")
    except Exception as e:
        print(f"❌ Lỗi: {str(e)}")
        if 'response' in locals():
            print(response.text)
