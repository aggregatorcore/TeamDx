# Wait for Device Authorization and Install
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Waiting for Device Authorization..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

Write-Host "📱 Please authorize USB debugging on your phone:" -ForegroundColor Yellow
Write-Host "   1. Check your phone screen" -ForegroundColor Cyan
Write-Host "   2. Tap 'Allow' on the USB debugging dialog" -ForegroundColor Cyan
Write-Host "   3. Check 'Always allow from this computer' (optional)" -ForegroundColor Cyan
Write-Host ""

$maxAttempts = 10
$attempt = 0
$deviceFound = $false

while ($attempt -lt $maxAttempts -and -not $deviceFound) {
    $attempt++
    Write-Host "[Attempt $attempt/$maxAttempts] Checking for authorized device..." -ForegroundColor Yellow
    
    $devices = flutter devices 2>&1 | Out-String
    
    if ($devices -match "9b010059305331323800e26c455b3c" -and $devices -notmatch "not authorized") {
        Write-Host "✅ Device authorized! Installing app..." -ForegroundColor Green
        $deviceFound = $true
        
        Write-Host ""
        Write-Host "Building and installing..." -ForegroundColor Cyan
        flutter run -d 9b010059305331323800e26c455b3c
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ App installed and launched successfully!" -ForegroundColor Green
        }
    } else {
        Write-Host "⏳ Waiting for authorization..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}

if (-not $deviceFound) {
    Write-Host ""
    Write-Host "❌ Device not authorized after $maxAttempts attempts" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "  1. Unplug and replug USB cable" -ForegroundColor Cyan
    Write-Host "  2. Check phone for authorization dialog" -ForegroundColor Cyan
    Write-Host "  3. Run this script again: .\wait_and_install.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or manually authorize and run: flutter run" -ForegroundColor Yellow
}

