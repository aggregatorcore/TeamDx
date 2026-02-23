# Filter logs from already running backend server
# This script monitors backend process output and filters it

Write-Host "🔍 Filtering Backend Logs (Real-time)" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""

# Check if backend is running
$backendProcess = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    try {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue
        if ($proc) {
            $proc.CommandLine -like "*server*" -or 
            ($proc.CommandLine -like "*index.js*" -and $proc.CommandLine -like "*server*")
        }
    } catch {
        $false
    }
} | Select-Object -First 1

if (-not $backendProcess) {
    Write-Host "❌ Backend server not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start backend server first:" -ForegroundColor Yellow
    Write-Host "  cd server" -ForegroundColor Gray
    Write-Host "  npm run server" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or use: .\start-backend-filtered.ps1" -ForegroundColor Cyan
    exit
}

Write-Host "✅ Backend server found (PID: $($backendProcess.Id))" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Note: PowerShell cannot directly filter output from another process." -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Solution Options:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 1: Restart backend with filtered output" -ForegroundColor White
Write-Host "  1. Stop current backend (Ctrl+C in backend terminal)" -ForegroundColor Gray
Write-Host "  2. Run: .\start-backend-filtered.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 2: Check backend terminal directly" -ForegroundColor White
Write-Host "  1. Open the terminal where backend is running" -ForegroundColor Gray
Write-Host "  2. Apply 'No Answer' tag to a lead" -ForegroundColor Gray
Write-Host "  3. Look for these patterns:" -ForegroundColor Gray
Write-Host "     - [TAG APPLICATION]" -ForegroundColor Cyan
Write-Host "     - [TagConfig]" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 3: Use backend terminal's search/filter (if available)" -ForegroundColor White
Write-Host "  Most terminals support Ctrl+F to search for specific text" -ForegroundColor Gray
Write-Host "  Search for: 'TagConfig' or 'TAG APPLICATION'" -ForegroundColor Gray
Write-Host ""
