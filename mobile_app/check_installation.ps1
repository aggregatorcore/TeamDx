# Check if App is Installed on Phone
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checking App Installation Status" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

# Check connected devices
Write-Host "Checking connected devices..." -ForegroundColor Yellow
$devices = flutter devices 2>&1 | Out-String
Write-Host $devices

# Check if Android device is connected
if ($devices -match "25028RN03I|9b010059305331323800e26c455b3c") {
    Write-Host ""
    Write-Host "✅ Device detected: 25028RN03I" -ForegroundColor Green
    Write-Host ""
    Write-Host "To check if app is installed:" -ForegroundColor Yellow
    Write-Host "  1. Check your phone's app drawer for 'TVF DX Mobile'" -ForegroundColor Cyan
    Write-Host "  2. Or run: flutter run -d 9b010059305331323800e26c455b3c" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "If app is not installed, we need to build it first." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ No Android device detected" -ForegroundColor Red
    Write-Host "Please connect your phone via USB and enable USB debugging" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Checking for existing APK..." -ForegroundColor Yellow
$apkPath = "build\app\outputs\flutter-apk\app-debug.apk"
if (Test-Path $apkPath) {
    $apkSize = (Get-Item $apkPath).Length / 1MB
    Write-Host "✅ APK found: $apkPath ($([math]::Round($apkSize, 2)) MB)" -ForegroundColor Green
    Write-Host ""
    Write-Host "To install this APK:" -ForegroundColor Yellow
    Write-Host "  flutter install -d 9b010059305331323800e26c455b3c" -ForegroundColor Cyan
} else {
    Write-Host "❌ No APK found. Need to build first." -ForegroundColor Red
    Write-Host ""
    Write-Host "To build APK:" -ForegroundColor Yellow
    Write-Host "  flutter build apk --debug" -ForegroundColor Cyan
}

