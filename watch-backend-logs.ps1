# Real-time Backend Log Monitoring with Filtering
# This script helps you monitor backend logs in real-time

param(
    [string]$LogPattern = "TAG APPLICATION|TagConfig|callbackAt|Auto-created|Found tagConfig|No tagConfig|No attemptTimings"
)

Write-Host "🔍 Backend Log Monitor - Filtered View" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""

# Check if backend process exists
$backendProcess = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    try {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue
        if ($proc) {
            $proc.CommandLine -like "*server*" -or $proc.CommandLine -like "*index.js*"
        }
    } catch {
        $false
    }
} | Select-Object -First 1

if (-not $backendProcess) {
    Write-Host "⚠️  Backend server process not found!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please start backend server in another terminal:" -ForegroundColor White
    Write-Host "  cd server" -ForegroundColor Gray
    Write-Host "  npm run server" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Yellow
    exit
}

Write-Host "✅ Backend server found (PID: $($backendProcess.Id))" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Filter Pattern: $LogPattern" -ForegroundColor Cyan
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Instructions:" -ForegroundColor Yellow
Write-Host "1. Keep this window open" -ForegroundColor White
Write-Host "2. Apply 'No Answer' tag to a lead in the browser" -ForegroundColor White
Write-Host "3. Watch for filtered logs below" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Yellow
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""

# Since we can't directly read stdout from another process in PowerShell easily,
# We'll provide instructions and a way to check if logs are being generated

Write-Host "📝 Note: Backend logs appear in the terminal where you started the server." -ForegroundColor Yellow
Write-Host ""
Write-Host "To see filtered logs:" -ForegroundColor Cyan
Write-Host "1. Open the terminal where backend is running" -ForegroundColor White
Write-Host "2. Apply 'No Answer' tag to a lead" -ForegroundColor White
Write-Host "3. Look for these patterns in that terminal:" -ForegroundColor White
Write-Host ""

# Show what to look for
$patterns = @(
    @{ Pattern = "\[TAG APPLICATION\] Executing"; Color = "Cyan" },
    @{ Pattern = "\[TagConfig\] ✅ Found tagConfig"; Color = "Green" },
    @{ Pattern = "\[TagConfig\] Checking autoAction"; Color = "Cyan" },
    @{ Pattern = "\[TagConfig\] ✅ Auto-created"; Color = "Green" },
    @{ Pattern = "\[TAG APPLICATION\] Re-fetched"; Color = "Green" },
    @{ Pattern = "\[TagConfig\] No tagConfig found"; Color = "Red" },
    @{ Pattern = "\[TagConfig\] ⚠️ No attemptTimings"; Color = "Red" },
    @{ Pattern = "\[TagConfig\] No active workflow"; Color = "Red" }
)

foreach ($p in $patterns) {
    Write-Host "  $($p.Pattern)" -ForegroundColor $p.Color
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""
Write-Host "🔄 Monitoring backend process..." -ForegroundColor Cyan
Write-Host "   (Check the backend terminal for actual logs)" -ForegroundColor Gray
Write-Host ""

# Keep script running and check process status
while ($true) {
    $proc = Get-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue
    if (-not $proc) {
        Write-Host "⚠️  Backend process stopped!" -ForegroundColor Red
        break
    }
    Start-Sleep -Seconds 2
}
