# Script to delete app/dashboard folder with Administrator permissions
# Run this script as Administrator

Write-Host "=== Deleting app/dashboard folder ===" -ForegroundColor Cyan
Write-Host ""

$folderPath = "E:\TVF_DX\app\dashboard"

if (-not (Test-Path $folderPath)) {
    Write-Host "✅ Folder already deleted!" -ForegroundColor Green
    exit 0
}

Write-Host "Step 1: Taking ownership of folder..." -ForegroundColor Yellow
try {
    $result = takeown /F $folderPath /R /D Y 2>&1
    Write-Host "✅ Ownership taken" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Warning: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 2: Granting full permissions..." -ForegroundColor Yellow
try {
    $username = $env:USERNAME
    $result = icacls $folderPath /grant "${username}:F" /T 2>&1
    Write-Host "✅ Permissions granted" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Warning: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 3: Deleting folder..." -ForegroundColor Yellow
try {
    Remove-Item -Path $folderPath -Recurse -Force -ErrorAction Stop
    Write-Host "✅ Folder deleted successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Trying alternative method..." -ForegroundColor Yellow
    try {
        Get-ChildItem $folderPath -Recurse | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
        Remove-Item $folderPath -Force -ErrorAction Stop
        Write-Host "✅ Folder deleted using alternative method!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Still cannot delete. Please try:" -ForegroundColor Red
        Write-Host "   1. Restart computer" -ForegroundColor Yellow
        Write-Host "   2. Boot in Safe Mode" -ForegroundColor Yellow
        Write-Host "   3. Delete folder manually" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "Step 4: Verifying deletion..." -ForegroundColor Yellow
if (-not (Test-Path $folderPath)) {
    Write-Host "✅ Verification: Folder deleted successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next step: Restart Docker frontend container" -ForegroundColor Cyan
    Write-Host "  docker restart tvf-frontend" -ForegroundColor White
} else {
    Write-Host "❌ Folder still exists!" -ForegroundColor Red
    exit 1
}
