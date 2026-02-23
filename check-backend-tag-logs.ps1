# Script to monitor backend logs for tag application
# Run this in a separate terminal while backend is running

Write-Host "🔍 Monitoring backend logs for tag application..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Yellow
Write-Host ""

# Note: This script assumes backend is running in another terminal
# You need to manually check that terminal for logs

Write-Host "To see backend logs:" -ForegroundColor Green
Write-Host "1. Open the terminal where you started the backend server" -ForegroundColor White
Write-Host "2. Look for logs starting with [TAG APPLICATION] or [TagConfig]" -ForegroundColor White
Write-Host "3. Apply 'No Answer' tag to a lead and watch the logs" -ForegroundColor White
Write-Host ""

Write-Host "Expected logs when applying 'No Answer' tag:" -ForegroundColor Cyan
Write-Host "  [TAG APPLICATION] Executing tagConfig behaviors..." -ForegroundColor Gray
Write-Host "  [TagConfig] ✅ Found tagConfig..." -ForegroundColor Gray
Write-Host "  [TagConfig] Checking autoAction..." -ForegroundColor Gray
Write-Host "  [TagConfig] ✅ Auto-created shift-aware callback..." -ForegroundColor Gray
Write-Host "  [TAG APPLICATION] Re-fetched tagApplication: { callbackAt: ... }" -ForegroundColor Gray
Write-Host ""

Write-Host "If you see errors like:" -ForegroundColor Yellow
Write-Host "  [TagConfig] No tagConfig found" -ForegroundColor Red
Write-Host "  [TagConfig] ⚠️ No attemptTimings found" -ForegroundColor Red
Write-Host "  [TagConfig] No active workflow found" -ForegroundColor Red
Write-Host ""
Write-Host "Then there's a configuration issue that needs to be fixed." -ForegroundColor Yellow
