# Monitor backend logs for tag application events
# This script watches for tag application logs to verify executeTagConfigBehaviors is being called

Write-Host "`n🔍 Monitoring Backend Logs for Tag Applications..." -ForegroundColor Cyan
Write-Host "   Looking for: [TAG APPLICATION], [TagConfig], executeTagConfigBehaviors`n" -ForegroundColor Gray

# Check if backend is running
$backendProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*server*" -or $_.Path -like "*server*" }

if (-not $backendProcess) {
    Write-Host "⚠️  Backend server doesn't appear to be running!" -ForegroundColor Yellow
    Write-Host "   Please start the backend server first: cd server && npm run dev`n" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Backend server is running`n" -ForegroundColor Green
Write-Host "📋 Instructions:" -ForegroundColor Cyan
Write-Host "   1. Apply a 'No Answer' tag to any lead" -ForegroundColor White
Write-Host "   2. Watch this console for backend logs" -ForegroundColor White
Write-Host "   3. You should see:" -ForegroundColor White
Write-Host "      - [TAG APPLICATION] Executing tagConfig behaviors..." -ForegroundColor Gray
Write-Host "      - [TagConfig] Checking autoAction..." -ForegroundColor Gray
Write-Host "      - [TagConfig] ✅ Auto-created shift-aware callback..." -ForegroundColor Gray
Write-Host "`n   Press Ctrl+C to stop monitoring`n" -ForegroundColor Yellow

# Note: This is a placeholder - actual log monitoring would require
# tailing the backend process output or checking log files
Write-Host "💡 Tip: Check the backend terminal window for detailed logs`n" -ForegroundColor Cyan
