# =======================================================
# SCRIPT KHỞI TẠO HỆ THỐNG (DÀNH CHO ADMIN)
# =======================================================

$Domain = "congvan.local"

# 1. Kiểm tra quyền Admin
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "VUI LÒNG CHẠY SCRIPT NÀY BẰNG QUYỀN ADMINISTRATOR!" -ForegroundColor Red
    pause
    exit
}

Write-Host "--- BẮT ĐẦU KHỞI TẠO HỆ THỐNG ---" -ForegroundColor Cyan

# 2. Cấu hình SSL
Write-Host "1. Đang cấu hình chứng chỉ SSL..." -ForegroundColor Yellow
if (!(Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Host "LỖI: Chưa cài đặt mkcert. Vui lòng cài mkcert trước!" -ForegroundColor Red
    pause
    exit
}

mkcert -install
New-Item -ItemType Directory -Force -Path "nginx/certs"
cd nginx/certs
mkcert $Domain
# Đổi tên file cho khớp config Nginx
if (Test-Path "$Domain.pem") { Move-Item "$Domain.pem" "cert.pem" -Force }
if (Test-Path "$Domain-key.pem") { Move-Item "$Domain-key.pem" "key.pem" -Force }
cd ../..

# 3. Chuẩn bị bộ cài cho Client (Thư mục DIST)
Write-Host "2. Đang chuẩn bị bộ cài cho đồng nghiệp (Thư mục 'dist')..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "dist"
$CaRoot = (mkcert -CAROOT)
Copy-Item "$CaRoot/rootCA.pem" "dist/rootCA.pem" -Force
Copy-Item "setup_client.ps1" "dist/setup_client.ps1" -Force

# 4. Cấu hình IP máy chủ
$ServerIP = Read-Host "Nhập địa chỉ IP nội bộ của máy chủ này (ví dụ: 192.168.1.10)"
if ($ServerIP) {
    (Get-Content "dist/setup_client.ps1") -replace '192.168.1.100', $ServerIP | Set-Content "dist/setup_client.ps1"
    Write-Host "Đã cập nhật IP $ServerIP vào bộ cài client." -ForegroundColor Green
}

# 5. Khởi động Docker
Write-Host "3. Đang khởi động hệ thống Docker..." -ForegroundColor Yellow
docker-compose up -d --build

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "HOÀN TẤT! Hệ thống đã chạy tại: https://$Domain" -ForegroundColor Green
Write-Host "Bộ cài cho đồng nghiệp đã sẵn sàng trong thư mục: dist" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Green
pause
