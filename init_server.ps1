$ErrorActionPreference = "Stop"

try {
    Write-Host "--- DOCUMENT COORDINATION SYSTEM: SERVER INITIALIZATION ---" -ForegroundColor Cyan

    # 1. Strict IP Detection
    Write-Host "Detecting physical IP address..." -ForegroundColor Gray
    $ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.InterfaceAlias -notlike "*Loopback*" -and 
        $_.InterfaceAlias -notlike "*vEthernet*" -and 
        $_.InterfaceAlias -notlike "*WSL*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.IPAddress -notlike "127.*"
    } | Select-Object -First 1).IPAddress
    
    if (!$ipAddress) { 
        # Fallback to any non-loopback if strict fails
        $ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" } | Select-Object -First 1).IPAddress
    }
    Write-Host "Server IP: $ipAddress" -ForegroundColor Green

    # 2. Check Prerequisites
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker not found!" }
    if (!(Get-Command npx -ErrorAction SilentlyContinue)) { throw "NodeJS not found!" }

    # 3. Secure client_setup folder
    $clientDir = "$PSScriptRoot\client_setup"
    if (!(Test-Path $clientDir)) { New-Item -ItemType Directory -Path $clientDir | Out-Null }

    # 4. GENERATE setup_client.ps1
    Write-Host "Generating self-debugging client_setup\setup_client.ps1..." -ForegroundColor Gray
    $domain = "congvan.local"
    $template = @'
$ErrorActionPreference = "Stop"
$Domain = "DOMAIN_PLACEHOLDER"
$ServerIP = "IP_PLACEHOLDER"

try {
    Write-Host "--- DOCUMENT COORDINATION SYSTEM: CLIENT SETUP ---" -ForegroundColor Cyan

    # 1. Admin Elevation
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (!$isAdmin) {
        Write-Host "Requesting Administrator privileges..." -ForegroundColor Yellow
        Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
        exit
    }

    # 2. SSL Trust
    $rootCa = "$PSScriptRoot\rootCA.pem"
    if (Test-Path $rootCa) {
        Write-Host "Installing Root CA..." -ForegroundColor Yellow
        certutil -addstore -f "Root" "$rootCa" > $null
        Write-Host "Success: Root CA installed." -ForegroundColor Green
    } else {
        throw "Missing rootCA.pem! Please ensure it is in the same folder as this script."
    }

    # 3. Domain Mapping (Hosts)
    $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
    $hostsLine = "$ServerIP  $Domain"
    
    Write-Host "Updating hosts file..." -ForegroundColor Yellow
    if (!(Select-String -Path $hostsPath -Pattern "\b$Domain\b" -Quiet)) {
        try {
            Add-Content -Path $hostsPath -Value "`n$hostsLine" -Encoding ASCII
        } catch {
            throw "Access denied to hosts file. Please disable Anti-virus and try again."
        }
    } else {
        $content = Get-Content $hostsPath
        $content -replace ".*$Domain.*", $hostsLine | Set-Content $hostsPath
    }
    Write-Host "Success: Domain mapped to $ServerIP." -ForegroundColor Green

    Write-Host "`n--- SETUP COMPLETED SUCCESSFULLY ---" -ForegroundColor Green
    Write-Host "URL: https://$Domain" -ForegroundColor Cyan
    Write-Host "Press Enter to finish..."
    Read-Host
}
catch {
    Write-Host "`n--- SETUP FAILED ---" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor White
    Write-Host "--------------------" -ForegroundColor Red
    Write-Host "Press Enter to exit..."
    Read-Host
    exit 1
}
'@
    $scriptContent = $template.Replace("DOMAIN_PLACEHOLDER", $domain).Replace("IP_PLACEHOLDER", $ipAddress)
    $scriptContent | Set-Content "$clientDir\setup_client.ps1" -Encoding UTF8

    # 5. SSL & Nginx
    $nginxConfFile = "$PSScriptRoot\nginx\conf.d\default.conf"
    if (Test-Path $nginxConfFile) {
        (Get-Content $nginxConfFile) -replace 'server_name congvan.local .*', "server_name $domain $ipAddress;" | Set-Content $nginxConfFile
    }

    $certDir = "$PSScriptRoot\nginx\certs"
    $tempDir = "$PSScriptRoot\.tmp_certs"
    if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    Push-Location $tempDir
    try {
        cmd /c "npx -y -p mkcert mkcert create-ca"
        cmd /c "npx -y -p mkcert mkcert create-cert --ca-cert ca.crt --ca-key ca.key --domains $domain localhost 127.0.0.1 $ipAddress --validity 3650"
        if (Test-Path "cert.crt") {
            Copy-Item "cert.crt" "$certDir\cert.pem" -Force
            Copy-Item "cert.key" "$certDir\key.pem" -Force
            Copy-Item "ca.crt" "$clientDir\rootCA.pem" -Force
        }
    }
    finally {
        Pop-Location
        if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
    }

    # 6. Docker
    Write-Host "Starting services..." -ForegroundColor Gray
    docker-compose down
    docker-compose up -d --build

    # 7. Seed Database
    Write-Host "Seeding database with sample data..." -ForegroundColor Gray
    $dbFile = "$PSScriptRoot\data\documents.db"
    $seedFile = "$PSScriptRoot\seed_db.sql"
    
    if (Test-Path $seedFile) {
        # Using a temporary sqlite3 container to execute the script against the mounted volume
        docker run --rm `
            -v "$($PSScriptRoot)\data:/db_data" `
            -v "$($seedFile):/seed.sql" `
            keinos/sqlite3 /db_data/documents.db ".read /seed.sql"
        Write-Host "Success: Database seeded." -ForegroundColor Green
    } else {
        Write-Host "Warning: seed_db.sql not found, skipping seeding." -ForegroundColor Yellow
    }

    Write-Host "`n--- SERVER READY ---" -ForegroundColor Green
    Write-Host "Access: https://$domain ($ipAddress)" -ForegroundColor Cyan
    Write-Host "Go to 'client_setup' and run 'setup_client.ps1' as Admin." -ForegroundColor Yellow
    Read-Host "`nPress Enter to exit"
}
catch {
    Write-Host "`nFATAL ERROR: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
}
