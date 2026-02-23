# MY DX Operations - Flutter Firebase Setup Script
# This script helps set up Firebase for the Flutter Web app

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MY DX Operations - Firebase Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Flutter is installed
Write-Host "Checking Flutter installation..." -ForegroundColor Yellow
$flutterVersion = flutter --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Flutter is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Flutter from: https://flutter.dev/docs/get-started/install" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Flutter is installed" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "Installing Flutter dependencies..." -ForegroundColor Yellow
flutter pub get
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Check if FlutterFire CLI is installed
Write-Host "Checking FlutterFire CLI..." -ForegroundColor Yellow
$flutterfireCheck = dart pub global list 2>&1 | Select-String "flutterfire_cli"
if (-not $flutterfireCheck) {
    Write-Host "Installing FlutterFire CLI..." -ForegroundColor Yellow
    dart pub global activate flutterfire_cli
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install FlutterFire CLI" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ FlutterFire CLI installed" -ForegroundColor Green
} else {
    Write-Host "✓ FlutterFire CLI is already installed" -ForegroundColor Green
}
Write-Host ""

# Instructions for Firebase setup
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Login to Firebase (if not already logged in):" -ForegroundColor Yellow
Write-Host "   firebase login" -ForegroundColor White
Write-Host ""
Write-Host "2. Configure Firebase for this project:" -ForegroundColor Yellow
Write-Host "   flutterfire configure" -ForegroundColor White
Write-Host ""
Write-Host "   This will:" -ForegroundColor Gray
Write-Host "   - Show your Firebase projects" -ForegroundColor Gray
Write-Host "   - Let you select/create a project" -ForegroundColor Gray
Write-Host "   - Generate firebase_options.dart automatically" -ForegroundColor Gray
Write-Host ""
Write-Host "3. After configuration, set up Firebase Console:" -ForegroundColor Yellow
Write-Host "   a) Enable Authentication → Email/Password" -ForegroundColor White
Write-Host "   b) Create Firestore Database (test mode)" -ForegroundColor White
Write-Host "   c) Create 'users' collection" -ForegroundColor White
Write-Host ""
Write-Host "4. Run the app:" -ForegroundColor Yellow
Write-Host "   flutter run -d chrome" -ForegroundColor White
Write-Host ""
Write-Host "For detailed instructions, see SETUP_GUIDE.md" -ForegroundColor Cyan
Write-Host ""

