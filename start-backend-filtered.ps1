# Start Backend Server with Filtered Logs - Only Tag Application & TagConfig
# Usage: .\start-backend-filtered.ps1

Write-Host "🚀 Starting Backend Server with Filtered Logs..." -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""
Write-Host "📋 Showing only:" -ForegroundColor Yellow
Write-Host "   ✅ [TAG APPLICATION] logs" -ForegroundColor Cyan
Write-Host "   ✅ [TagConfig] logs" -ForegroundColor Cyan
Write-Host "   ✅ callbackAt related logs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""

# Change to server directory
Push-Location server

try {
    # Start npm server and filter output in real-time
    npm run server 2>&1 | ForEach-Object -Process {
        $line = $_
        
        # Filter for relevant logs
        if ($line -match "\[TAG APPLICATION\]" -or 
            $line -match "\[TagConfig\]" -or 
            $line -match "callbackAt" -or 
            $line -match "Auto-created" -or 
            $line -match "Found tagConfig" -or
            $line -match "No tagConfig" -or
            $line -match "No attemptTimings" -or
            $line -match "No active workflow" -or
            $line -match "Executing tagConfig" -or
            $line -match "Checking autoAction" -or
            $line -match "Calculated callback" -or
            $line -match "Re-fetched tagApplication") {
            
            # Color code based on content
            if ($line -match "✅|Auto-created|Re-fetched|Found tagConfig") {
                Write-Host $line -ForegroundColor Green
            } elseif ($line -match "⚠️|No tagConfig|No attemptTimings|No active workflow|Error|Failed|❌") {
                Write-Host $line -ForegroundColor Red
            } elseif ($line -match "Executing|Checking|Calculated|\[TAG APPLICATION\]") {
                Write-Host $line -ForegroundColor Cyan
            } else {
                Write-Host $line -ForegroundColor White
            }
        }
    }
} finally {
    Pop-Location
}
