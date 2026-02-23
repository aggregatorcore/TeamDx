# Docker containers build + start
# Pehli baar 5-15 min lag sakte hain (npm ci, prisma generate) - wait karo, interrupt mat karo.

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot\..

Write-Host "=== Docker build + start (5-15 min lag sakta hai) ===" -ForegroundColor Cyan
Write-Host ""

docker-compose -f docker-compose.dev.yml up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build/start me error. Upar wale message check karo." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Status check:" -ForegroundColor Green
docker-compose -f docker-compose.dev.yml ps -a

Write-Host ""
Write-Host "Frontend: http://localhost:3000 | Backend: http://localhost:5000" -ForegroundColor Cyan
