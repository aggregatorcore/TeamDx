# Fast Rebuild Script - Optimized for Speed
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fast Rebuild - TVF DX Mobile App" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to mobile_app directory
Set-Location $PSScriptRoot

# Step 1: Clean only build folder (faster than full clean)
Write-Host "[1/4] Cleaning build cache (fast clean)..." -ForegroundColor Yellow
if (Test-Path "build") {
    Remove-Item -Recurse -Force "build" -ErrorAction SilentlyContinue
}
if (Test-Path "android\app\build") {
    Remove-Item -Recurse -Force "android\app\build" -ErrorAction SilentlyContinue
}

# Step 2: Get dependencies (skip if already done)
Write-Host "[2/4] Getting dependencies..." -ForegroundColor Yellow
flutter pub get

# Step 3: Build with optimizations
Write-Host "[3/4] Building APK (optimized)..." -ForegroundColor Yellow
Write-Host "Using: --split-debug-info (smaller build)" -ForegroundColor Cyan
Write-Host "Using: --no-tree-shake-icons (faster)" -ForegroundColor Cyan
Write-Host ""

# Build APK
flutter build apk --debug --split-debug-info=build/debug-info

Write-Host ""
Write-Host "[4/4] Build Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "APK Location: build\app\outputs\flutter-apk\app-debug.apk" -ForegroundColor Cyan
Write-Host ""
Write-Host "To install on device:" -ForegroundColor Yellow
Write-Host "  flutter install" -ForegroundColor Cyan
Write-Host ""

