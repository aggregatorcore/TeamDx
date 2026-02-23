# MY DX Operations - Run Flutter Web App
# Quick script to run the Flutter web app

Write-Host "Starting MY DX Operations (Flutter Web)..." -ForegroundColor Cyan
Write-Host ""

# Check if Flutter is available
$flutterCheck = flutter --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Flutter is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if dependencies are installed
if (-not (Test-Path "pubspec.lock")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    flutter pub get
}

# Check if Firebase is configured
$firebaseOptions = Get-Content "lib/core/firebase/firebase_options.dart" -Raw
if ($firebaseOptions -match "YOUR_API_KEY") {
    Write-Host "WARNING: Firebase is not configured yet!" -ForegroundColor Yellow
    Write-Host "Run: .\setup_flutter_firebase.ps1" -ForegroundColor Yellow
    Write-Host "Then: flutterfire configure" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 0
    }
}

# Run the app
Write-Host "Launching Flutter Web app..." -ForegroundColor Green
Write-Host ""
flutter run -d chrome

