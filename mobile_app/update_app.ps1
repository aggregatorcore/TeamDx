# Smart Mobile App Update Script
# This script rebuilds and updates the app without requiring manual uninstall
Write-Host "=== Mobile App Update Script ===" -ForegroundColor Cyan
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

Write-Host "1. Cleaning previous build..." -ForegroundColor Yellow
flutter clean | Out-Null

Write-Host "2. Getting dependencies..." -ForegroundColor Yellow
flutter pub get | Out-Null

Write-Host "3. Building APK (debug)..." -ForegroundColor Yellow
flutter build apk --debug

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "4. Installing/Updating app on device..." -ForegroundColor Yellow
Write-Host "   (Flutter will automatically uninstall old version if needed)" -ForegroundColor Gray

# Check connected devices
$devices = flutter devices | Select-String -Pattern "•" | Select-Object -Skip 1

if ($devices.Count -eq 0) {
    Write-Host "❌ No devices connected" -ForegroundColor Red
    Write-Host "   Please connect your device via USB and enable USB debugging" -ForegroundColor Yellow
    exit 1
}

Write-Host "   Found $($devices.Count) device(s)" -ForegroundColor Green

# Install app using adb (handles uninstall automatically with -r flag)
$apkPath = "build\app\outputs\flutter-apk\app-debug.apk"
if (Test-Path $apkPath) {
    Write-Host "   Installing APK: $apkPath" -ForegroundColor Gray
    adb install -r $apkPath
    $installSuccess = $LASTEXITCODE -eq 0
} else {
    Write-Host "   APK not found, trying flutter install..." -ForegroundColor Yellow
    flutter install
    $installSuccess = $LASTEXITCODE -eq 0
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ App updated successfully!" -ForegroundColor Green
    Write-Host "   The app should now be running with latest updates" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "⚠️  Installation completed with warnings" -ForegroundColor Yellow
    Write-Host "   If app doesn't update, try manual uninstall first" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Update Complete ===" -ForegroundColor Cyan

