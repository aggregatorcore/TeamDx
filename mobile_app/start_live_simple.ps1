# Simple Live Development Starter
# Fixes syntax issues and starts clean
Write-Host "=== Starting Mobile App Live Development ===" -ForegroundColor Cyan
Write-Host ""

# Navigate to mobile app directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Check Flutter
try {
    flutter --version | Out-Null
} catch {
    Write-Host "❌ Flutter not found" -ForegroundColor Red
    exit 1
}

# Check device
Write-Host "Checking devices..." -ForegroundColor Yellow
$devices = flutter devices 2>&1 | Select-String -Pattern "mobile"

if (-not $devices) {
    Write-Host "❌ No mobile device found" -ForegroundColor Red
    Write-Host "   Please connect device via USB" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Device found" -ForegroundColor Green
Write-Host ""

# Get device ID
$deviceLine = flutter devices 2>&1 | Select-String -Pattern "mobile" | Select-Object -First 1
$deviceId = $null

if ($deviceLine -match "•\s+(\S+)\s+\(mobile\)") {
    $deviceId = $matches[1]
    Write-Host "Using device: $deviceId" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🚀 Starting Flutter in DEBUG mode..." -ForegroundColor Green
Write-Host ""
Write-Host "=== Hot Reload Commands ===" -ForegroundColor Cyan
Write-Host "  Press 'r' → Hot Reload (fast)" -ForegroundColor Yellow
Write-Host "  Press 'R' → Hot Restart (full)" -ForegroundColor Yellow
Write-Host "  Press 'q' → Quit" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting..." -ForegroundColor Yellow
Write-Host ""

# Start Flutter
if ($deviceId) {
    flutter run -d $deviceId
} else {
    flutter run
}

