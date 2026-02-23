# Flutter Project Setup Script
# Run this AFTER installing Flutter SDK

Write-Host "🚀 Setting up Flutter Mobile App..." -ForegroundColor Green

# Check if Flutter is installed
Write-Host "`n📋 Checking Flutter installation..." -ForegroundColor Yellow
try {
    $flutterVersion = flutter --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Flutter is installed!" -ForegroundColor Green
        Write-Host $flutterVersion
    } else {
        Write-Host "❌ Flutter is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Please install Flutter first. See FLUTTER_INSTALLATION.md" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Flutter is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Flutter first. See FLUTTER_INSTALLATION.md" -ForegroundColor Yellow
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "pubspec.yaml")) {
    Write-Host "❌ pubspec.yaml not found. Are you in the mobile_app directory?" -ForegroundColor Red
    exit 1
}

# Run flutter doctor
Write-Host "`n🔍 Running Flutter Doctor..." -ForegroundColor Yellow
flutter doctor

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
flutter pub get

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Check for Android setup
Write-Host "`n🤖 Checking Android setup..." -ForegroundColor Yellow
$androidSetup = flutter doctor | Select-String "Android"
if ($androidSetup) {
    Write-Host "Android setup status:" -ForegroundColor Cyan
    Write-Host $androidSetup
}

# Final instructions
Write-Host "`n✅ Setup Complete!" -ForegroundColor Green
Write-Host "`n📝 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update lib/utils/constants.dart with your server URL" -ForegroundColor White
Write-Host "2. Connect an Android device or start an emulator" -ForegroundColor White
Write-Host "3. Run: flutter run" -ForegroundColor White
Write-Host "`n💡 For more details, see SETUP.md" -ForegroundColor Cyan

