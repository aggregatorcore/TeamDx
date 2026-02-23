# Force Rebuild and Reinstall Flutter App
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Force Rebuild Flutter App" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Uninstall app from device
Write-Host "[1/5] Uninstalling app from device..." -ForegroundColor Yellow
flutter uninstall
Start-Sleep -Seconds 2

# Step 2: Clean build
Write-Host "[2/5] Cleaning build cache..." -ForegroundColor Yellow
flutter clean
Start-Sleep -Seconds 2

# Step 3: Get dependencies
Write-Host "[3/5] Getting dependencies..." -ForegroundColor Yellow
flutter pub get
Start-Sleep -Seconds 2

# Step 4: Verify constants
Write-Host "[4/5] Verifying API configuration..." -ForegroundColor Yellow
$constantsFile = "lib\utils\constants.dart"
$content = Get-Content $constantsFile -Raw
if ($content -match "192\.168\.29\.158:5000") {
    Write-Host "  [OK] IP address: 192.168.29.158:5000" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] IP address not found!" -ForegroundColor Red
    exit 1
}

# Step 5: Build and install
Write-Host "[5/5] Building and installing app..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting app installation..." -ForegroundColor Cyan
Write-Host "This will rebuild with new IP address configuration" -ForegroundColor Cyan
Write-Host ""

flutter run




















