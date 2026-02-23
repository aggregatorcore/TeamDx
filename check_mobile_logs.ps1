# Check mobile app logs via adb logcat
Write-Host "=== Mobile App Logs Check ===" -ForegroundColor Cyan
Write-Host ""

# Check if adb is available
$adbPath = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbPath) {
    Write-Host "❌ ADB not found in PATH" -ForegroundColor Red
    Write-Host "Please ensure Android SDK platform-tools is in your PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host "Checking connected devices..." -ForegroundColor Yellow
$devices = adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }

if ($devices.Count -eq 0) {
    Write-Host "❌ No devices connected" -ForegroundColor Red
    Write-Host "Please connect your mobile device via USB and enable USB debugging" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found $($devices.Count) device(s)" -ForegroundColor Green
Write-Host ""

Write-Host "Capturing mobile app logs (last 50 lines with MOBILE APP tag)..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Filter for our debug print statements
adb logcat -d | Select-String -Pattern "MOBILE APP" | Select-Object -Last 50

Write-Host ""
Write-Host "=== Real-time log monitoring ===" -ForegroundColor Cyan
Write-Host "To see real-time logs, run: adb logcat | Select-String -Pattern 'MOBILE APP'" -ForegroundColor Yellow

