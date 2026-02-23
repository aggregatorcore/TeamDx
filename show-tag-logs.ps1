# Simple Filtered Log Viewer for Tag Application
# Run: .\show-tag-logs.ps1

Write-Host "🔍 Tag Application Logs Filter" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""

Write-Host "📋 IMPORTANT: Backend logs appear in the terminal where you started the server!" -ForegroundColor Yellow
Write-Host ""
Write-Host "To see filtered logs:" -ForegroundColor White
Write-Host "1. Open the terminal where backend is running (cd server && npm run server)" -ForegroundColor Gray
Write-Host "2. Apply 'No Answer' tag to a lead" -ForegroundColor Gray
Write-Host "3. Look for these logs in that terminal:" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ SUCCESS (should see these):" -ForegroundColor Green
Write-Host "  [TAG APPLICATION] Executing tagConfig behaviors..." -ForegroundColor White
Write-Host "  [TagConfig] ✅ Found tagConfig for tag..." -ForegroundColor White
Write-Host "  [TagConfig] Checking autoAction: { autoAction: 'CALLBACK' }" -ForegroundColor White
Write-Host "  [TagConfig] ✅ Auto-created shift-aware callback..." -ForegroundColor White
Write-Host "  [TAG APPLICATION] Re-fetched tagApplication: { callbackAt: '...' }" -ForegroundColor White
Write-Host ""

Write-Host "❌ ERRORS (if you see these, there's a problem):" -ForegroundColor Red
Write-Host "  [TagConfig] No tagConfig found..." -ForegroundColor White
Write-Host "  [TagConfig] ⚠️ No attemptTimings found..." -ForegroundColor White
Write-Host "  [TagConfig] No active workflow found" -ForegroundColor White
Write-Host ""

Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Quick Check: Is backend running?" -ForegroundColor Cyan
$backendRunning = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    try {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue
        $proc.CommandLine -like "*server*"
    } catch { $false }
}

if ($backendRunning) {
    Write-Host "✅ Backend is running (PID: $($backendRunning.Id))" -ForegroundColor Green
} else {
    Write-Host "❌ Backend is NOT running!" -ForegroundColor Red
    Write-Host "   Start it with: cd server && npm run server" -ForegroundColor Yellow
}
