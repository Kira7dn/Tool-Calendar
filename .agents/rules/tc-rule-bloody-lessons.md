# TC-RULE-BLOODY-LESSONS

Tài liệu này tổng hợp các "bài học máu xương" (Bloody Lessons) — những lỗi ngớ ngẩn, những cái bẫy kỹ thuật, hoặc những lỗi nghiêm trọng có thể làm sập hệ thống đã gặp phải trong quá trình phát triển Tool-Calendar từ đầu năm đến nay. **AI Agent BẮT BUỘC phải tham khảo tài liệu này để không lặp lại sai lầm.**

## 1. Hạ tầng & Docker (VNPT Server)

- **[CHẾT NGƯỜI] Dùng `docker compose down` trên server VNPT:** Server 14.225.172.225 chạy chung Nginx Proxy cho cả Tool-Calendar và Hệ thống Lịch Công Tác. Nếu dùng `docker compose down` sẽ kéo sập luôn `nginx-proxy` làm hệ thống Lịch Công Tác bị ngắt kết nối. 
  - **Bài học:** Bắt buộc chỉ dùng `docker restart <tên-container>` hoặc build/up từng container cụ thể (VD: `docker compose up -d --no-deps --build official-doc-backend`).
- **[LỖI 502 BAD GATEWAY] Nginx cache IP của Container:** Khi container backend bị khởi động lại, IP nội bộ của nó trong network có thể thay đổi. Nginx proxy sẽ vẫn cache IP cũ và trả về lỗi 502.
  - **Bài học:** Luôn phải chạy `docker exec nginx-proxy nginx -s reload` sau khi deploy backend.
- **[OOM KILL] Rò rỉ RAM Docker:** Ban đầu sử dụng thuộc tính `deploy.resources` trong `docker-compose.yml` để giới hạn RAM, nhưng thuộc tính này vô hiệu khi không chạy Docker Swarm. Hậu quả là `python-ai-service` ngốn cạn RAM kéo sập toàn server.
  - **Bài học:** Chuyển sang dùng `mem_limit` và `memswap_limit` để giới hạn RAM (VD: 2560m cho AI). Cần build tuần tự để tránh spike RAM.

## 2. Database (SQLite)

- **[BẪY SCHEMA] `CREATE TABLE IF NOT EXISTS` không tự update cột:** Khi thêm cột mới vào class, câu lệnh SQL `CREATE TABLE IF NOT EXISTS` sẽ bị bỏ qua nếu bảng đã tồn tại, dẫn đến việc thiếu cột trong production DB. Gây lỗi 500 khi query.
  - **Bài học:** Không có framework Migration. Mọi thay đổi schema đều phải viết script `ALTER TABLE` + `try/catch` thủ công và chạy trên server.

## 3. Kiến trúc Backend & AI (C# / Python)

- **[LỖI NGỚ NGẨN] Lệch `SecurityStamp` gây văng tài khoản:** Hàm `UserRepository.UpdateUser` vô tình tạo mới `SecurityStamp` liên tục mà không đồng bộ với Identity. Do bật tính năng chống đăng nhập nhiều nơi, hệ thống thấy Stamp thay đổi nên đá user ra ngoài ngay sau khi login.
  - **Bài học:** Chỉ tạo mới `SecurityStamp` khi Admin chủ động thay đổi quyền hạn hoặc đổi mật khẩu.
- **[LỖI BẤT ĐỒNG BỘ] `ObjectDisposedException` trong vòng lặp AI:** Khi sử dụng `using var doc = JsonDocument.Parse(...)` bên trong vòng lặp N-hop function calling. Kết thúc mỗi vòng lặp `doc` bị dispose, qua vòng lặp sau biến truyền vào danh sách thông điệp chat sẽ throw exception "Cannot access a disposed object".
  - **Bài học:** Deserialize hẳn sang Object C# thuần thay vì truyền tham chiếu JsonElement/JsonDocument vào mảng tồn tại lâu hơn scope của vòng lặp.
- **[STREAMING BỊ CHẶN] Nginx Proxy Buffering chặn luồng SSE (Server-Sent Events):** Mặc dù AI backend trả về chunk-by-chunk (`yield return`), frontend vẫn bị treo lâu do Nginx tự động buffer lại toàn bộ rồi mới trả về một cục.
  - **Bài học:** Bắt buộc phải thêm HTTP Header `X-Accel-Buffering: no` ở endpoint API trả về stream.

## 4. Frontend & Trải nghiệm người dùng (React)

- **[LỖI CSS NGẦM] Component bị che khuất do `z-index` hoặc `overflow`:**
  - Floating Chatbox bị cắt xén icon AI do cha có thuộc tính `overflow-hidden`.
  - Box Chat AI trên mobile bị thanh điều hướng dưới cùng (Bottom Nav) đè lên do `z-index` quá thấp.
  - Chữ bị tràn viền (`overflow`) trên điện thoại nhỏ, hiển thị "THẢO LUẬN TRỰC T...".
  - **Bài học:** Kiểm tra kỹ responsive trên mobile, điều chỉnh `z-index` (VD: `z-[600]`) và `bottom` phù hợp.
- **[LỖI UX] Idle Timeout không bắt được sự kiện mở màn hình:** Việc tự động đăng xuất sau thời gian không hoạt động (idle) trên điện thoại gặp lỗi. Đặt sự kiện `touchstart` là chưa đủ vì user có thể bật sáng màn hình và thấy dữ liệu cũ từ tối hôm trước trước khi có thao tác chạm.
  - **Bài học:** Phải dùng event `visibilitychange` trên document để trigger hàm check timeout NGAY LÚC trình duyệt được hiển thị lại.
- **[LỖI KẸT GIAO DIỆN] Fullscreen PDF trên in-app browser:** Tính năng phóng to PDF sử dụng `window.open`. Trên trình duyệt Zalo (in-app), nó sẽ mở lấp toàn màn hình và mất nút "Back" của OS, khiến user bị kẹt.
  - **Bài học:** Chuyển sang dùng in-app Modal với CSS `fixed inset-0 z-[100]` cùng nút Minimize nội bộ để tự kiểm soát luồng thoát.
- **[LỖI XUNG ĐỘT TÊN FILE] File `UploadPage.jsx` và folder `UploadPage/`:** Trên macOS/Windows, hệ thống file không phân biệt hoa thường nên code chạy bình thường. Khi đẩy lên Linux (VNPT server), Vite không thể resolve module do trùng tên.
  - **Bài học:** Đổi tên file thành `UploadPage/index.jsx` nếu có các file con bên trong thư mục cùng tên.
- **[LỖI PARSE JSON] Unwrap API Response bị lỗi do kiểm tra field `success`:** Global fetch interceptor đã tự unwrap `ApiResponse` và chỉ trả về mảng `data` thay vì object json đầy đủ. Một số component kiểm tra `json.success` (không tồn tại) dẫn đến lọt vào nhánh lỗi dù API thành công.
  - **Bài học:** Interceptor đã handle lỗi, component chỉ cần kiểm tra xem response có phải `Array` (đối với data list) hoặc object không.

## 6. Dịch vụ AI (Python AI Service)

- **[TỰ BẮN VÀO CHÂN] Tắt hoàn toàn OCR:** Trong module `docling_extractor.py`, biến `do_ocr = False` bị hardcode ở cả 2 nhánh (bao gồm cả nhánh xử lý file scan). Hậu quả là PDF scan/ảnh đi qua hệ thống sẽ cho ra văn bản rỗng, khiến C# không cập nhật trạng thái văn bản, làm công văn bị **treo vĩnh viễn** ở trạng thái "Đang xử lý".
  - **Bài học:** Kiểm tra kỹ logic fallback. Phải bật `do_ocr=True` kèm engine (`rapidocr-onnxruntime`) cho nhánh xử lý ảnh scan.
- **[LỖI THIẾT KẾ RAG] Fast-path giết chết Pipeline RAG:** API `/api/compress` được cài đặt một "fast-path": nếu độ dài văn bản < 8.000 ký tự thì bypass toàn bộ quá trình chia chunk, embed, chấm điểm BM25 và rerank, trả về nguyên xi với điểm 100%. Hậu quả là LLM phải đọc toàn văn gây nhiễu loạn, ảo giác và làm chậm, đồng thời hiển thị cho người dùng `[Liên quan: 100%]` sai sự thật.
  - **Bài học:** Không tự ý tạo fast-path cắt xén logic cốt lõi. RAG luôn phải làm đúng bổn phận là tìm đoạn liên quan nhất, bất kể văn bản dài ngắn thế nào.
- **[HIỆU NĂNG] Truyền toàn văn bản cho LLM extract Metadata:** Việc LLM trích xuất siêu dữ liệu (Số ký hiệu, Ngày ban hành) thay vì dùng 100% Regex đã biến tác vụ chạy mất 0.01s thành tác vụ mất **40-60s**. Tệ hơn, code không cắt ngắn input mà truyền cả văn bản chục trang vào LLM, gây tràn context và chiếm trọn tài nguyên của Ollama.
  - **Bài học:** Giới hạn cực độ số lượng ký tự truyền vào LLM (ví dụ: cắt 6000 ký tự đầu tiên). Dữ liệu cứng (số văn bản) thì Regex phải là vua, LLM chỉ đóng vai trò fallback.
- **[LỖI HỢP ĐỒNG API] Chunker tự ý ghi đè tham số:** Chunker có tính năng "Adaptive Size" tự ý sửa tham số `chunk_size` mà .NET truyền vào. Điều này phá vỡ kiến trúc Parent-Child (VD: yêu cầu chunk con 400 ký tự nhưng hệ thống tự phình lên 800 ký tự), làm giảm khả năng trích xuất chính xác.
  - **Bài học:** Service Python chỉ là API phục vụ. Không được phép tự ý thay đổi cấu hình/yêu cầu từ client gọi nó nếu không được yêu cầu.
- **[TIMEZONE] Lệch giờ do Docker UTC:** Date Parser trên Python dùng `datetime.now()` để phân tích thời hạn. Do container không có tham số `TZ=Asia/Ho_Chi_Minh` nên bị lệch múi giờ. Từ 0h-7h sáng giờ VN, hệ thống nhận diện ngày bị lùi lại 1 ngày, dẫn đến báo cáo công văn tới hạn bị sai.
  - **Bài học:** Các container xử lý thời gian bắt buộc phải truyền biến môi trường `TZ=Asia/Ho_Chi_Minh` hoặc ép dùng `ZoneInfo("Asia/Ho_Chi_Minh")` trong code.
- **[DOS ATTACK] Đệ quy vô hạn trong Chunker:** Code không validate tham số đầu vào. Nếu client truyền `chunk_overlap >= chunk_size`, logic cắt chuỗi sẽ đi vào đệ quy không thu hẹp khoảng cách và gây Crash/treo toàn bộ luồng xử lý.
  - **Bài học:** Luôn phải Validate input (FastAPI/Pydantic).

## 7. Quản lý Source Code & Workspace

- **[LỖI RÁC GIT] Commit cache của Python:** `.gitignore` thiếu thư mục `__pycache__` và file `*.pyc` dẫn đến lịch sử Git chứa hàng loạt file binary vô nghĩa gây phình repo và conflict.
  - **Bài học:** Đảm bảo `.gitignore` chặn các định dạng cache/build của ngôn ngữ đang sử dụng.
- **[LỖI QUY TRÌNH] Bỏ qua `COMMIT_LOG.md`:** AI làm mất context của phiên trước do Developer quên ép AI cập nhật `COMMIT_LOG.md` sau mỗi thay đổi lớn. Hậu quả là AI đời sau không biết DB đã thay đổi gì, API nào mới được thêm vào.
  - **Bài học:** Cập nhật `COMMIT_LOG.md` là **bắt buộc** và là chốt chặn (quality gate) trước khi commit.

## 8. Upload File & Tải thư mục (File Upload Limits)

- **[LỖI NHANH 413 PAYLOAD TOO LARGE] Tải tệp/thư mục bị lỗi ngay lập tức:** Khi người dùng sử dụng chức năng "Tải cả thư mục" hoặc tải một file PDF có dung lượng lớn (chỉ cần > 1MB hoặc > 30MB), file bị báo lỗi "• Lỗi" ngay lập tức mà không rõ nguyên nhân (Frontend bắt lỗi JSON parse vì Server trả về HTML error page). 
  - **Nguyên nhân cốt lõi:**
    1. **Nginx Proxy Limit:** Nginx mặc định giới hạn `client_max_body_size` là 1MB. Mọi request lớn hơn 1MB sẽ bị chặn đứng ngay ở cổng Nginx và trả về lỗi `413 Request Entity Too Large`.
    2. **Kestrel & Form Limit:** ASP.NET Core Kestrel có giới hạn mặc định `MaxRequestBodySize` là ~30MB (28.6MB). Cùng với đó, `FormOptions.MultipartBodyLengthLimit` (mặc định 128MB) cũng là một chốt chặn.
      - Nếu vượt qua giới hạn của Kestrel, server sẽ trả về lỗi `413 Payload Too Large`.
      - Ngay cả khi đã mở giới hạn Kestrel, nếu file vượt qua `MultipartBodyLengthLimit`, ASP.NET Core sẽ âm thầm ném `InvalidDataException` trong quá trình Model Binding (`IFormFile file`) và tự động trả về lỗi `400 Bad Request` với response body 144 bytes (`{"status":400,"errors":{"file":["The file field is required."]}}`) mà KHÔNG HỀ in ra exception trong console log của server! Điều này cực kỳ khó debug.
    3. **Application Validation Limit (FileSignatureValidator):** Ngoài giới hạn hệ thống (Nginx/Kestrel), ứng dụng còn có file `FileSignatureValidator.cs` thực hiện kiểm tra Magic Bytes và cấu hình giới hạn cứng kích thước cho từng loại file qua dictionary `MaxFileSizes` (PDF bị giới hạn cứng ở **50MB**).
      - Hậu quả: Khi upload file PDF lớn hơn 50MB (nhưng nhỏ hơn giới hạn Nginx/Kestrel), validator trong service `DocumentUploadService.cs` sẽ trả về lỗi "File quá lớn. Giới hạn cho .pdf: 50MB". Lỗi này trả về dạng `400 Bad Request` của `ApiResponse` và không hiển thị trên log hệ thống mà chỉ hiển thị tại Frontend.
  - **Bài học:** 
    - Bắt buộc phải thêm `client_max_body_size 100M;` (hoặc cao hơn) vào cấu hình `nginx.conf` của Nginx Proxy dùng chung.
    - Tại endpoint `[HttpPost("upload")]` trong `DocumentsController.cs` (và các endpoint nhận file khác), bắt buộc phải dùng `[DisableRequestSizeLimit]` và cấu hình giới hạn cực lớn (ví dụ: `536870912` = 500MB) cho `[RequestFormLimits(MultipartBodyLengthLimit = ...)]`.
    - Phải cấu hình cả `builder.WebHost.ConfigureKestrel` và `builder.Services.Configure<FormOptions>` trong `Program.cs` để bảo hiểm 2 lớp, tránh tình trạng Kestrel hay Model Binding âm thầm drop request. Mặc định của framework KHÔNG BAO GIỜ đủ cho tính năng tải lên thư mục/tài liệu hạng nặng của doanh nghiệp.
    - Đảm bảo kiểm tra các bộ lọc validate định dạng file nội bộ (`FileSignatureValidator.cs`) để nới lỏng giới hạn cứng (`MaxFileSizes`) của ứng dụng đồng bộ với giới hạn của hệ thống.

## 9. Hạ tầng & Triển khai (Infrastructure & Deployment Gotchas)

- **[LỖI KHÓA IP SSH - FAIL2BAN] Từ chối kết nối SSH khi deploy hoặc xem log:** Khi cố gắng chạy các lệnh shell kiểm tra/log (vd: `ssh root@<IP>`) mà quên truyền password/key qua `sshpass` hoặc sai password nhiều lần.
  - **Hậu quả:** Tường lửa của Server (như Fail2ban) sẽ lập tức ban/chặn IP của máy Local. Tất cả lệnh `ssh` hoặc chạy script `./deploy_to_vnpt.sh` sau đó đều sẽ thất bại ngay lập tức với lỗi `Connection refused`.
  - **Bài học:** 
    - Luôn bọc lệnh SSH tự động bằng `sshpass -p "$PASSWORD"` hoặc sử dụng SSH key đã được authorized trước khi chạy bất kỳ câu lệnh check/log nào lên server production.
    - Nếu lỡ bị ban IP, hãy chuyển kết nối mạng sang 4G/Hotspot trên điện thoại để lấy IP mới khác và tiếp tục deploy/work.
---
**LƯU Ý:** Do file này đã quá dài, các bài học từ số 10 trở đi được ghi chép tại **[Phần 2: tc-rule-bloody-lessons-v2.md](tc-rule-bloody-lessons-v2.md)**. Vui lòng tham khảo file đó để biết thêm chi tiết.

---
**Status:** ACTIVE  
**Priority:** CAUTION — Những bài học phải ghi nhớ để tránh "đổ máu" lần 2.
