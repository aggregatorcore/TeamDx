# Filter Backend Logs for Tag Application
# Usage: .\filter-backend-logs.ps1

param(
    [string]$LogFile = "server\logs\server.log"
)

Write-Host "🔍 Filtering Backend Logs for Tag Application..." -ForegroundColor Cyan
Write-Host ""

if (Test-Path $LogFile) {
    Write-Host "📄 Reading log file: $LogFile" -ForegroundColor Green
    Write-Host ""
    
    Get-Content $LogFile -Tail 100 | Where-Object {
        $_ -match "\[TAG APPLICATION\]" -or
        $_ -match "\[TagConfig\]" -or
        $_ -match "callbackAt" -or
        $_ -match "Auto-created" -or
        $_ -match "Found tagConfig" -or
        $_ -match "No tagConfig" -or
        $_ -match "No attemptTimings" -or
        $_ -match "No active workflow"
    } | ForEach-Object {
        if ($_ -match "✅|Auto-created|Re-fetched") {
            Write-Host $_ -ForegroundColor Green
        } elseif ($_ -match "⚠️|No tagConfig|No attemptTimings|No active workflow|Error") {
            Write-Host $_ -ForegroundColor Red
        } elseif ($_ -match "Executing|Checking|Calculated") {
            Write-Host $_ -ForegroundColor Cyan
        } else {
            Write-Host $_ -ForegroundColor White
        }
    }
} else {
    Write-Host "⚠️  Log file not found: $LogFile" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Backend logs are shown in the terminal where server is running." -ForegroundColor White
    Write-Host ""
    Write-Host "To see filtered logs:" -ForegroundColor Cyan
    Write-Host "1. Open the backend terminal" -ForegroundColor White
    Write-Host "2. Apply 'No Answer' tag to a lead" -ForegroundColor White
    Write-Host "3. Look for logs starting with:" -ForegroundColor White
    Write-Host "   - [TAG APPLICATION]" -ForegroundColor Cyan
    Write-Host "   - [TagConfig]" -ForegroundColor Cyan
    Write-Host ""
}
