---
trigger: on_demand
description: "Kỹ năng setup Docker và debug môi trường development."
---

# TC-SKILL-DOCKER-SETUP

Kỹ năng này hướng dẫn cách setup, chạy và debug môi trường Docker cho Tool-Calendar.

## Cấu trúc docker-compose

```
Tool-Calendar/
├── docker-compose.yml          ← Main compose file
├── Dockerfile                  ← ASP.NET Core + React build
├── nginx/                      ← Nginx reverse proxy config
│   └── nginx.conf
└── data_dump/                  ← SQLite DB mount (local dev)
    └── documents.db
```

## Lệnh cơ bản

```bash
# Build và khởi động toàn bộ stack
docker-compose up --build -d

# Xem logs realtime
docker-compose logs -f api
docker-compose logs -f rabbitmq

# Dừng và xóa containers
docker-compose down

# Dừng nhưng giữ volumes (DB không mất)
docker-compose stop
```

## Mount Points quan trọng

| Container Path | Local Path | Mô tả |
|---|---|---|
| `/app/data/documents.db` | `./data_dump/documents.db` | SQLite DB chính |
| `/app/data/uploads/` | `./data_dump/uploads/` | File upload |
| `/app/data/debug/` | `./data_dump/debug/` | OCR debug artifacts |

## Khi DB bị lỗi hoặc cần reset

```bash
# Backup DB hiện tại
cp data_dump/documents.db data_dump/documents.db.backup

# Reset và seed lại dữ liệu mẫu
sqlite3 data_dump/documents.db < seed_db.sql

# Hoặc chạy script fix data
python3 fix_db.py
```

## Debug khi container không start

```bash
# Xem logs của container lỗi
docker-compose logs api

# Exec vào container để kiểm tra
docker-compose exec api sh

# Kiểm tra kết nối DB trong container
docker-compose exec api ls /app/data/
```

## Environment Variables cần thiết

Tạo file `.env` ở thư mục gốc (không commit):
```env
JWT_SECRET=your_long_random_secret_here
RABBITMQ_DEFAULT_USER=admin
RABBITMQ_DEFAULT_PASS=your_rabbitmq_password
CLAMAV_HOST=clamav
PADDLEOCR_URL=http://paddleocr:8000
```

## Cổng mặc định

| Service | Port | Mô tả |
|---|---|---|
| Nginx | `80` | Entry point chính |
| ASP.NET Core | `5000` (internal) | Backend API |
| RabbitMQ Management | `15672` | Admin UI |
| PaddleOCR | `8000` (internal) | OCR service |

---
**Status:** ACTIVE  
**Use when:** Setup môi trường hoặc debug Docker issues
