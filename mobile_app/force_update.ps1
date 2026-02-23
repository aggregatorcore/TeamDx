# Force Update Mobile App (with uninstall)
# Use this if update_app.ps1 doesn't work
Write-Host "=== Force Update Mobile App ===" -ForegroundColor Cyan
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

Write-Host "1. Checking connected devices..." -ForegroundColor Yellow
$devices = flutter devices | Select-String -Pattern "•" | Select-Object -Skip 1

if ($devices.Count -eq 0) {
    Write-Host "❌ No devices connected" -ForegroundColor Red
    exit 1
}

Write-Host "   Found $($devices.Count) device(s)" -ForegroundColor Green

# Get device ID (first device)
$deviceInfo = flutter devices | Select-String -Pattern "•" | Select-Object -Skip 1 -First 1
if ($deviceInfo -match "•\s+(\S+)") {
    $deviceId = $matches[1]
    Write-Host "   Using device: $deviceId" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Could not detect device ID, will use default" -ForegroundColor Yellow
    $deviceId = $null
}

Write-Host ""
Write-Host "2. Uninstalling old app..." -ForegroundColor Yellow
if ($deviceId) {
    adb -s $deviceId uninstall com.example.mobile_app 2>&1 | Out-Null
} else {
    adb uninstall com.example.mobile_app 2>&1 | Out-Null
}
Write-Host "   (Old app uninstalled or not found)" -ForegroundColor Gray

Write-Host ""
Write-Host "3. Cleaning build..." -ForegroundColor Yellow
flutter clean | Out-Null

Write-Host "4. Getting dependencies..." -ForegroundColor Yellow
flutter pub get | Out-Null

Write-Host "5. Building APK (debug)..." -ForegroundColor Yellow
flutter build apk --debug

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "6. Installing fresh app..." -ForegroundColor Yellow
$apkPath = "build\app\outputs\flutter-apk\app-debug.apk"
if (Test-Path $apkPath) {
    Write-Host "   Installing APK: $apkPath" -ForegroundColor Gray
    if ($deviceId) {
        adb -s $deviceId install -r $apkPath
    } else {
        adb install -r $apkPath
    }
    $installSuccess = $LASTEXITCODE -eq 0
} else {
    Write-Host "   APK not found, trying flutter install..." -ForegroundColor Yellow
    if ($deviceId) {
        flutter install -d $deviceId
    } else {
        flutter install
    }
    $installSuccess = $LASTEXITCODE -eq 0
}

if ($installSuccess) {
    Write-Host ""
    Write-Host "✅ App force updated successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Installation failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Force Update Complete ===" -ForegroundColor Cyan

