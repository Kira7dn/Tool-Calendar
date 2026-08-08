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
spawn ssh -o StrictHostKeyChecking=no $VNPT_USER@$VNPT_HOST "cd /root/Tool-Calendar || exit 1; git pull origin phonghopkhonggiayto; docker compose down; docker compose build; docker compose up -d"
expect {
    "password:" {
        send "$VNPT_PASS\r"
        exp_continue
    }
    eof
}
EOF

echo "Triển khai hoàn tất!"
