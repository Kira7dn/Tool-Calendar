# =======================================================
# SCRIPT CÀI ĐẶT NHANH HỆ THỐNG ĐIỀU PHỐI CÔNG VĂN
# =======================================================

$Domain = "congvan.local"
$IP_Server = "192.168.1.100" # <--- ANH HÃY SỬA IP CỦA MÁY CHỦ TẠI ĐÂY

# 1. Kiểm tra quyền Admin
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "VUI LÒNG CHẠY SCRIPT NÀY BẰNG QUYỀN ADMINISTRATOR!" -ForegroundColor Red
    pause
    exit
}

# 2. Cài đặt Chứng chỉ CA (Nếu file tồn tại)
$CaPath = Join-Path $PSScriptRoot "rootCA.pem"
if (Test-Path $CaPath) {
    Write-Host "Đang cài đặt chứng chỉ bảo mật..." -ForegroundColor Cyan
    certutil -addstore -f "Root" $CaPath
} else {
    Write-Host "Không tìm thấy file rootCA.pem trong cùng thư mục. Bỏ qua bước cài cert." -ForegroundColor Yellow
}

# 3. Cấu hình file Hosts
Write-Host "Đang cấu hình tên miền $Domain..." -ForegroundColor Cyan
$HostsPath = "$env:windir\System32\drivers\etc\hosts"
$HostEntry = "$IP_Server  $Domain"

if (!(Select-String -Path $HostsPath -Pattern $Domain)) {
    Add-Content -Path $HostsPath -Value "`n$HostEntry"
    Write-Host "Đã thêm tên miền thành công!" -ForegroundColor Green
} else {
    Write-Host "Tên miền đã tồn tại trong file hosts." -ForegroundColor Yellow
}

Write-Host "`n-------------------------------------------------------"
Write-Host "XONG! Anh/Chị có thể truy cập: https://$Domain" -ForegroundColor Green
Write-Host "-------------------------------------------------------"
pause
