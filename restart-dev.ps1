# Restart Next.js Dev Server Properly
Write-Host "=== Restarting Next.js Dev Server ===" -ForegroundColor Cyan
Write-Host ""

# Stop all Node processes
Write-Host "Stopping Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Clear cache
Write-Host "Clearing .next cache..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Cache cleared" -ForegroundColor Green
}

# Start dev server
Write-Host ""
Write-Host "Starting dev server..." -ForegroundColor Yellow
Write-Host "Wait 60-90 seconds for compilation" -ForegroundColor White
Write-Host ""
npm run dev
