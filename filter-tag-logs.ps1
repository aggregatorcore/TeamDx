# Filtered Backend Logs - Only Tag Application & TagConfig Logs
# Run this script to see only relevant logs

Write-Host "🔍 Filtered Backend Logs - Tag Application & TagConfig Only" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""

# Check if backend is running
$backendProcess = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*server*" -or $_.Path -like "*TVF_DX*server*"
}

if (-not $backendProcess) {
    Write-Host "⚠️  Backend server not found running!" -ForegroundColor Yellow
    Write-Host "Please start backend server first:" -ForegroundColor White
    Write-Host "  cd server" -ForegroundColor Gray
    Write-Host "  npm run server" -ForegroundColor Gray
    Write-Host ""
    exit
}

Write-Host "✅ Backend server is running (PID: $($backendProcess.Id))" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Instructions:" -ForegroundColor Cyan
Write-Host "1. Open the terminal where backend server is running" -ForegroundColor White
Write-Host "2. Apply 'No Answer' tag to a lead" -ForegroundColor White
Write-Host "3. Watch for these filtered logs:" -ForegroundColor White
Write-Host ""

Write-Host "🔍 Looking for these log patterns:" -ForegroundColor Yellow
Write-Host "  [TAG APPLICATION]" -ForegroundColor Cyan
Write-Host "  [TagConfig]" -ForegroundColor Cyan
Write-Host "  [WORKFLOW TRIGGER]" -ForegroundColor Cyan
Write-Host ""

Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""

# If you want to monitor a log file (if backend writes to file)
$logFile = "server\logs\server.log"
if (Test-Path $logFile) {
    Write-Host "📄 Monitoring log file: $logFile" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host ""
    
    Get-Content $logFile -Wait -Tail 50 | Where-Object {
        $_ -match "\[TAG APPLICATION\]" -or
        $_ -match "\[TagConfig\]" -or
        $_ -match "\[WORKFLOW TRIGGER\]" -or
        $_ -match "callbackAt" -or
        $_ -match "Auto-created" -or
        $_ -match "Found tagConfig"
    } | ForEach-Object {
        if ($_ -match "✅") {
            Write-Host $_ -ForegroundColor Green
        } elseif ($_ -match "⚠️|No tagConfig|No attemptTimings|No active workflow") {
            Write-Host $_ -ForegroundColor Red
        } elseif ($_ -match "Executing|Checking|Calculated|Re-fetched") {
            Write-Host $_ -ForegroundColor Cyan
        } else {
            Write-Host $_ -ForegroundColor White
        }
    }
} else {
    Write-Host "📝 Backend logs are shown in the terminal where server is running." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To see filtered logs, manually check the backend terminal and look for:" -ForegroundColor White
    Write-Host ""
    Write-Host "✅ SUCCESS LOGS (Green):" -ForegroundColor Green
    Write-Host "  [TagConfig] ✅ Found tagConfig..." -ForegroundColor Gray
    Write-Host "  [TagConfig] ✅ Auto-created shift-aware callback..." -ForegroundColor Gray
    Write-Host "  [TAG APPLICATION] Re-fetched tagApplication: { callbackAt: ... }" -ForegroundColor Gray
    Write-Host ""
    Write-Host "❌ ERROR LOGS (Red):" -ForegroundColor Red
    Write-Host "  [TagConfig] No tagConfig found..." -ForegroundColor Gray
    Write-Host "  [TagConfig] ⚠️ No attemptTimings found..." -ForegroundColor Gray
    Write-Host "  [TagConfig] No active workflow found" -ForegroundColor Gray
    Write-Host ""
    Write-Host "ℹ️  INFO LOGS (Cyan):" -ForegroundColor Cyan
    Write-Host "  [TAG APPLICATION] Executing tagConfig behaviors..." -ForegroundColor Gray
    Write-Host "  [TagConfig] Checking autoAction..." -ForegroundColor Gray
    Write-Host "  [TagConfig] Calculated callback time..." -ForegroundColor Gray
    Write-Host ""
}
