with open("COMMIT_LOG.md", "r") as f:
    content = f.read()

new_log = """
### [2026-08-16 22:20] Cập nhật bóc tách siêu dữ liệu công văn (Metadata Extraction)
- **Mô tả**: Sửa lỗi "Số văn bản" bị gán bằng tên file và không hiển thị Trích yếu khi server không cấu hình Ollama hoặc chạy quá tải. Tích hợp trực tiếp API Gemini vào `python-ai-service` để tận dụng tốc độ và độ chính xác của Cloud LLM nếu có `GEMINI_API_KEY`. Đồng thời thiết lập lớp bảo vệ thứ 3: Regex Fallback (tự bóc tách bằng lệnh Regex) khi cả Gemini và Ollama đều thất bại.
- **Tệp thay đổi**:
  - `python-ai-service/main.py` (Sửa đổi: Thêm Regex fallback, chặn lỗi sập luồng khi parse JSON thất bại)
  - `python-ai-service/llm_provider/ollama_client.py` (Sửa đổi: Nâng cấp thành Hybrid Client, ưu tiên gọi Gemini qua REST API nếu có key)
  - `docker-compose.yml` (Sửa đổi: Truyền biến môi trường GEMINI_API_KEY cho khối Python)
- **Lệnh git commit**: `git commit -m "fix(ocr): sửa lỗi bóc tách metadata bằng fallback Gemini và Regex"`
"""

parts = content.split("## 2026-08-16\n")
if len(parts) == 2:
    new_content = parts[0] + "## 2026-08-16\n" + new_log + parts[1]
else:
    new_content = content + "\n## 2026-08-16\n" + new_log

with open("COMMIT_LOG.md", "w") as f:
    f.write(new_content)
