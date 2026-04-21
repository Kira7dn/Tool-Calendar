$ca = mkcert -CAROOT
$source = Join-Path $ca "rootCA.pem"
$dest = Join-Path $PSScriptRoot "rootCA.pem"
if (Test-Path $source) {
    Copy-Item $source $dest -Force
    Write-Host "Successfully copied rootCA.pem to $dest"
} else {
    Write-Host "Could not find rootCA.pem at $source"
}
