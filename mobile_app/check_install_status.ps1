# Check App Installation Status
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checking App Installation Status" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

# Check for APK
Write-Host "[1/3] Checking for APK file..." -ForegroundColor Yellow
$apkPath = "build\app\outputs\flutter-apk\app-debug.apk"
if (Test-Path $apkPath) {
    $apkSize = (Get-Item $apkPath).Length / 1MB
    Write-Host "✅ APK Found: $apkPath ($([math]::Round($apkSize, 2)) MB)" -ForegroundColor Green
    $apkExists = $true
} else {
    Write-Host "❌ APK not found - Build not completed yet" -ForegroundColor Red
    $apkExists = $false
}

# Check connected device
Write-Host ""
Write-Host "[2/3] Checking connected device..." -ForegroundColor Yellow
$devices = flutter devices 2>&1 | Out-String
if ($devices -match "25028RN03I|9b010059305331323800e26c455b3c") {
    Write-Host "✅ Device Connected: 25028RN03I" -ForegroundColor Green
    $deviceConnected = $true
} else {
    Write-Host "❌ Device not connected" -ForegroundColor Red
    $deviceConnected = $false
}

# Summary
Write-Host ""
Write-Host "[3/3] Installation Status:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

if ($apkExists -and $deviceConnected) {
    Write-Host ""
    Write-Host "📱 To check if app is installed on phone:" -ForegroundColor Yellow
    Write-Host "   1. Open your phone app drawer" -ForegroundColor Cyan
    Write-Host "   2. Look for TVF DX Mobile app" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📦 To install APK manually:" -ForegroundColor Yellow
    Write-Host "   flutter install -d 9b010059305331323800e26c455b3c" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🚀 To build and install:" -ForegroundColor Yellow
    Write-Host "   flutter run -d 9b010059305331323800e26c455b3c" -ForegroundColor Cyan
} elseif (-not $apkExists) {
    Write-Host ""
    Write-Host "⚠️  APK not built yet. Building now..." -ForegroundColor Yellow
    Write-Host "   This will take 2-5 minutes..." -ForegroundColor Cyan
} elseif (-not $deviceConnected) {
    Write-Host ""
    Write-Host "⚠️  Device not connected" -ForegroundColor Yellow
    Write-Host "   Please connect your phone via USB" -ForegroundColor Cyan
}

Write-Host ""

