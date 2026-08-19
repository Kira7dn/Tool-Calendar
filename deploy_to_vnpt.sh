#!/bin/bash

# Đọc thông tin từ file .deploy.env
if [ ! -f ".deploy.env" ]; then
    echo "Lỗi: Không tìm thấy file .deploy.env"
    exit 1
fi

source .deploy.env

echo "Đang triển khai lên VNPT Server ($VNPT_HOST)..."

# Dùng expect để ssh và chạy lệnh tự động
expect << EOF
set timeout -1
spawn ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=5 $VNPT_USER@$VNPT_HOST "
  set -e
  cd /root/Tool-Calendar || exit 1

  # --- Bước 1: Dọn dẹp nhẹ (giữ nguyên layer cache) ---
  docker container prune -f
  docker image prune -f

  # --- Bước 2: Git pull code mới ---
  git gc --prune=now
  git remote prune origin
  git fetch --all --force
  git reset --hard origin/develop

  # --- Bước 2.5: Backup DB ---
  echo '>>> Backup DB...'
  mkdir -p /root/Tool-Calendar/data/backups
  if [ -f '/root/Tool-Calendar/data/documents.db' ]; then
      cp '/root/Tool-Calendar/data/documents.db' '/root/Tool-Calendar/data/backups/documents.db.bak.\\\$(date +%Y%m%d%H%M)'
      echo '>>> Backup DB thành công'
  fi

  # --- Bước 3: Kiểm tra requirements.txt có đổi không ---
  HASH_NEW=\\\$(sha256sum python-ai-service/requirements.txt | cut -d' ' -f1)
  HASH_OLD=\\\$(cat /tmp/.python_ai_req_hash 2>/dev/null || echo 'none')

  if [ \\\"\\\$HASH_NEW\\\" != \\\"\\\$HASH_OLD\\\" ]; then
    echo '>>> requirements.txt thay đổi — build lại python-ai-service...'
    docker compose build python-ai-service
    echo \\\"\\\$HASH_NEW\\\" > /tmp/.python_ai_req_hash
  else
    echo '>>> requirements.txt không đổi — BỎ QUA build python-ai-service (tiết kiệm ~135s)'
  fi

  # --- Bước 4: Build backend (tuần tự sau AI service, tránh spike RAM) ---
  echo '>>> Build official-doc-backend...'
  docker compose build official-doc-backend

  # --- Bước 5: Restart containers (Zero-downtime) ---
  echo '>>> Deploying containers with zero-downtime...'
  docker compose up -d --no-deps --build official-doc-backend python-ai-service

  echo '>>> Deploy hoàn tất!'
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
"
expect {
    "password:" {
        send "$VNPT_PASS\r"
        exp_continue
    }
    eof
}
EOF

echo "Triển khai hoàn tất!"
