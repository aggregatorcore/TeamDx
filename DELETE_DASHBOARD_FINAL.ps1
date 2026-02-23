# Final script to delete app/dashboard folder
# Run this AFTER stopping Docker containers

Write-Host "=== Deleting app/dashboard folder (Final Method) ===" -ForegroundColor Cyan
Write-Host ""

$folderPath = "E:\TVF_DX\app\dashboard"

if (-not (Test-Path $folderPath)) {
    Write-Host "✅ Folder already deleted!" -ForegroundColor Green
    exit 0
}

Write-Host "IMPORTANT: Make sure Docker containers are stopped!" -ForegroundColor Yellow
Write-Host "Run: docker-compose down" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "Have you stopped Docker? (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Please stop Docker first: docker-compose down" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Waiting 5 seconds for locks to release..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Method 1: Standard deletion..." -ForegroundColor Yellow
try {
    Remove-Item -Path $folderPath -Recurse -Force -ErrorAction Stop
    Write-Host "✅ Folder deleted successfully!" -ForegroundColor Green
    exit 0
}
catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Method 2: Delete files individually..." -ForegroundColor Yellow
try {
    Get-ChildItem $folderPath -Recurse -Force | ForEach-Object {
        Remove-Item $_.FullName -Force -Recurse -ErrorAction SilentlyContinue
    }
    Remove-Item $folderPath -Force -ErrorAction Stop
    Write-Host "✅ Folder deleted using method 2!" -ForegroundColor Green
    exit 0
}
catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Method 3: Using robocopy to empty folder..." -ForegroundColor Yellow
try {
    $emptyDir = Join-Path $env:TEMP "dashboard_empty_$(Get-Random)"
    New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
    robocopy $emptyDir $folderPath /MIR /R:0 /W:0 /NFL /NDL /NJH /NJS | Out-Null
    Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
    Remove-Item $folderPath -Force -ErrorAction Stop
    Write-Host "✅ Folder deleted using robocopy method!" -ForegroundColor Green
    exit 0
}
catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "❌ All methods failed!" -ForegroundColor Red
Write-Host ""
Write-Host "Try these options:" -ForegroundColor Yellow
Write-Host "  1. Restart computer, then delete manually" -ForegroundColor White
Write-Host "  2. Boot in Safe Mode, then delete" -ForegroundColor White
Write-Host "  3. Use Unlocker tool: https://www.emptyloop.com/unlocker/" -ForegroundColor White
Write-Host "  4. Check if any process is using the folder:" -ForegroundColor White
Write-Host "     Get-Process | Where-Object {`$_.Path -like '*dashboard*'}" -ForegroundColor Gray
exit 1
