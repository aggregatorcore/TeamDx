# Backend Log Monitoring Script
# This script helps monitor backend logs during Flutter app login test

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend Log Monitoring - Flutter Login Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Write-Host "Checking backend status..." -ForegroundColor Yellow
$backendCheck = netstat -ano | findstr :5000 | findstr LISTENING
if ($backendCheck) {
    Write-Host "✅ Backend is running on port 5000" -ForegroundColor Green
    Write-Host "   $backendCheck" -ForegroundColor Gray
} else {
    Write-Host "❌ Backend is NOT running on port 5000" -ForegroundColor Red
    Write-Host "   Please start the backend server first" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Monitoring Instructions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Keep your BACKEND CONSOLE window visible" -ForegroundColor White
Write-Host "2. Watch for these log entries when login is attempted:" -ForegroundColor White
Write-Host ""
Write-Host "   Expected log format:" -ForegroundColor Yellow
Write-Host "   [AUTH] Login attempt received: {" -ForegroundColor Gray
Write-Host "     email: '...'," -ForegroundColor Gray
Write-Host "     hasPassword: true," -ForegroundColor Gray
Write-Host "     ip: '10.0.2.2'," -ForegroundColor Gray
Write-Host "     userAgent: 'Dart/3.5.0 (dart:io)'," -ForegroundColor Gray
Write-Host "     timestamp: '...'" -ForegroundColor Gray
Write-Host "   }" -ForegroundColor Gray
Write-Host ""
Write-Host "3. After login attempt, check:" -ForegroundColor White
Write-Host "   ✅ If log appears → Request reached backend" -ForegroundColor Green
Write-Host "   ❌ If no log → Request did NOT reach backend" -ForegroundColor Red
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ready for Testing" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key when login attempt is complete to check status..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "Checking backend health after test..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing -TimeoutSec 2
    Write-Host "✅ Backend is still responding" -ForegroundColor Green
    Write-Host "   Status: $($healthCheck.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Backend health check failed" -ForegroundColor Yellow
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Check your BACKEND CONSOLE for:" -ForegroundColor White
Write-Host "  - [AUTH] Login attempt received: log entry" -ForegroundColor Yellow
Write-Host "  - IP address (should be 10.0.2.2 for emulator)" -ForegroundColor Yellow
Write-Host "  - User agent (should contain 'Dart')" -ForegroundColor Yellow
Write-Host ""
Write-Host "Report findings to Ankit for analysis." -ForegroundColor White


