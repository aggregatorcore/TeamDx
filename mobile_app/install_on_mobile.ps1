# Install App on Mobile Device
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installing TVF DX Mobile App" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

# Step 1: Check for connected devices
Write-Host "[1/3] Checking for connected devices..." -ForegroundColor Yellow
$devices = flutter devices 2>&1
Write-Host $devices

# Check if any device is connected
if ($devices -notmatch "mobile|android|device") {
    Write-Host ""
    Write-Host "⚠️  No device detected!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "  1. Connect your Android phone via USB" -ForegroundColor Cyan
    Write-Host "  2. Enable USB Debugging on your phone" -ForegroundColor Cyan
    Write-Host "  3. Allow USB debugging when prompted" -ForegroundColor Cyan
    Write-Host "  4. Run this script again" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or use: flutter run" -ForegroundColor Yellow
    exit 1
}

# Step 2: Build APK
Write-Host ""
Write-Host "[2/3] Building APK..." -ForegroundColor Yellow
flutter build apk --debug

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Install on device
Write-Host ""
Write-Host "[3/3] Installing on device..." -ForegroundColor Yellow
flutter install

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ App installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK Location: build\app\outputs\flutter-apk\app-debug.apk" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Installation failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try manually:" -ForegroundColor Yellow
    Write-Host "  flutter run" -ForegroundColor Cyan
}

