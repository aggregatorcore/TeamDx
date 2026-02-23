# Rebuild Flutter Mobile App with New Configuration
Write-Host "Rebuilding Flutter Mobile App..." -ForegroundColor Cyan
Write-Host ""

# Clean build
Write-Host "Cleaning build..." -ForegroundColor Yellow
flutter clean

# Get dependencies
Write-Host "Getting dependencies..." -ForegroundColor Yellow
flutter pub get

# Verify constants
Write-Host ""
Write-Host "Verifying API configuration..." -ForegroundColor Cyan
$constantsFile = "lib\utils\constants.dart"
$content = Get-Content $constantsFile -Raw
if ($content -match "192\.168\.29\.158:5000") {
    Write-Host "[OK] IP address configured correctly: 192.168.29.158:5000" -ForegroundColor Green
} else {
    Write-Host "[WARNING] IP address might not be configured correctly" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Build cleaned and ready!" -ForegroundColor Green
Write-Host "Now run: flutter run" -ForegroundColor Cyan




