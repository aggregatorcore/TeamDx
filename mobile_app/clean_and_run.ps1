# Full clean and run on Android emulator
# Close Android Studio / other Gradle processes before running if you get "file in use" errors.

Set-Location $PSScriptRoot

Write-Host "Cleaning Flutter..." -ForegroundColor Cyan
flutter clean

Write-Host "Removing Android build caches..." -ForegroundColor Cyan
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android\.gradle -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android\app\build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android\build -ErrorAction SilentlyContinue

Write-Host "Getting dependencies..." -ForegroundColor Cyan
flutter pub get

Write-Host "Running on emulator..." -ForegroundColor Green
flutter run -d emulator-5554
