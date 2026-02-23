# MY DX Operations - Start Flutter Web App
# This script starts the app and shows the URL

Write-Host "Starting MY DX Operations Flutter Web App..." -ForegroundColor Cyan
Write-Host ""

# Check if Flutter is available
$flutterCheck = flutter --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Flutter is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Install dependencies if needed
if (-not (Test-Path "pubspec.lock")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    flutter pub get
}

# Check if Firebase is configured
$firebaseOptions = Get-Content "lib/core/firebase/firebase_options.dart" -Raw
if ($firebaseOptions -match "YOUR_API_KEY") {
    Write-Host "WARNING: Firebase is not configured yet!" -ForegroundColor Yellow
    Write-Host "The app will show a Firebase configuration error screen." -ForegroundColor Yellow
    Write-Host ""
}

# Run the app
Write-Host "Launching Flutter Web app on port 8080..." -ForegroundColor Green
Write-Host "The app will be available at: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

flutter run -d web-server --web-port=8080

