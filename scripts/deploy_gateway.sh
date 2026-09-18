#!/bin/bash

if [ ! -f ".deploy.env" ]; then
    echo "Lỗi: Không tìm thấy file .deploy.env"
    exit 1
fi
source .deploy.env

echo "Đang đẩy API Gateway lên VNPT Server ($VNPT_HOST)..."

sshpass -p "$VNPT_PASS" ssh -o StrictHostKeyChecking=no $VNPT_USER@$VNPT_HOST "mkdir -p /root/vp-gateway/nginx"
sshpass -p "$VNPT_PASS" scp -o StrictHostKeyChecking=no -r gateway/* $VNPT_USER@$VNPT_HOST:/root/vp-gateway/

sshpass -p "$VNPT_PASS" ssh -o StrictHostKeyChecking=no $VNPT_USER@$VNPT_HOST << 'CMD'
  cd /root/vp-gateway
  
  # Copy certificates từ Tool-Calendar cũ sang nếu có
  if [ -d "/root/Tool-Calendar/nginx/certs" ]; then
      cp -r /root/Tool-Calendar/nginx/certs /root/vp-gateway/nginx/
  fi
  
  # Xóa bỏ proxy nginx cũ
  docker stop nginx-proxy || true
  docker rm nginx-proxy || true

  # Khởi động lại
  docker compose pull
  docker compose up -d --build
  echo ">>> API Gateway Deploy hoàn tất!"
  docker ps --filter "name=nginx-proxy" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
CMD

echo "Gateway đã độc lập hoàn toàn!"
