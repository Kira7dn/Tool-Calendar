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
spawn ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=5 $VNPT_USER@$VNPT_HOST "cd /root/Tool-Calendar || exit 1; \
  docker container prune -f; \
  docker image prune -f; \
  git gc --prune=now; \
  git remote prune origin; \
  git fetch --all --force && git reset --hard origin/develop && \
  docker compose build official-doc-backend python-ai-service && \
  docker rm -f doc-coordination-system python-ai-service; \
  docker compose up -d official-doc-backend python-ai-service"
expect {
    "password:" {
        send "$VNPT_PASS\r"
        exp_continue
    }
    eof
}
EOF

echo "Triển khai hoàn tất!"
