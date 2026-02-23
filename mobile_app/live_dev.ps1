# Live Development Mode - Mobile App
# Similar to web app's hot reload, this runs Flutter in debug mode with hot reload
Write-Host "=== Mobile App Live Development Mode ===" -ForegroundColor Cyan
Write-Host ""

# Check if Flutter is available
try {
    flutter --version | Out-Null
} catch {
    Write-Host "❌ Flutter not found in PATH" -ForegroundColor Red
    exit 1
}

# Navigate to mobile app directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Checking connected devices..." -ForegroundColor Yellow
$devices = flutter devices | Select-String -Pattern "•" | Select-Object -Skip 1

if ($devices.Count -eq 0) {
    Write-Host "❌ No devices connected" -ForegroundColor Red
    Write-Host "   Please connect your mobile device via USB and enable USB debugging" -ForegroundColor Yellow
    exit 1
}

# Find mobile device
$mobileDevice = flutter devices | Select-String -Pattern "mobile" | Select-Object -First 1
$deviceId = $null

if ($mobileDevice -match "•\s+(\S+)\s+\(mobile\)") {
    $deviceId = $matches[1]
    Write-Host "✅ Found mobile device: $deviceId" -ForegroundColor Green
} else {
    Write-Host "⚠️  Could not detect mobile device ID" -ForegroundColor Yellow
    Write-Host "   Will use default device" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🚀 Starting Flutter in DEBUG mode with HOT RELOAD..." -ForegroundColor Green
Write-Host ""
Write-Host "=== Hot Reload Commands ===" -ForegroundColor Cyan
Write-Host "  Press 'r' in this terminal to HOT RELOAD (fast, keeps state)" -ForegroundColor Yellow
Write-Host "  Press 'R' to HOT RESTART (slower, resets state)" -ForegroundColor Yellow
Write-Host "  Press 'q' to QUIT" -ForegroundColor Yellow
Write-Host ""
Write-Host "=== Error Checking ===" -ForegroundColor Cyan
Write-Host "  Errors will appear in this terminal in real-time" -ForegroundColor Gray
Write-Host "  Red text = Errors" -ForegroundColor Red
Write-Host "  Yellow text = Warnings" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting app..." -ForegroundColor Yellow
Write-Host ""

# Run Flutter in debug mode with hot reload
Write-Host "Launching Flutter in debug mode..." -ForegroundColor Yellow
Write-Host ""

try {
    if ($deviceId) {
        flutter run -d $deviceId
    } else {
        flutter run
    }
} catch {
    Write-Host "❌ Error starting Flutter: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check if device is connected: flutter devices" -ForegroundColor Gray
    Write-Host "  2. Check if app is already running" -ForegroundColor Gray
    Write-Host "  3. Try: flutter clean && flutter pub get" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "=== Development Session Ended ===" -ForegroundColor Cyan

