# Check if ports are available
# Usage: .\scripts\check-ports.ps1

Write-Host "=== Checking Port Availability ===" -ForegroundColor Cyan
Write-Host ""

function Test-Port {
    param([int]$Port, [string]$Service)
    
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connection) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            $processName = if ($process) { $process.ProcessName } else { "Unknown" }
            Write-Host "❌ Port $Port ($Service) is IN USE" -ForegroundColor Red
            Write-Host "   Process: $processName (PID: $($connection.OwningProcess))" -ForegroundColor Yellow
            Write-Host "   To kill: taskkill /PID $($connection.OwningProcess) /F" -ForegroundColor Gray
            return $false
        } else {
            Write-Host "✅ Port $Port ($Service) is AVAILABLE" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "✅ Port $Port ($Service) is AVAILABLE" -ForegroundColor Green
        return $true
    }
}

$frontendAvailable = Test-Port -Port 3000 -Service "Frontend (Next.js)"
Write-Host ""
$backendAvailable = Test-Port -Port 5000 -Service "Backend (Express)"
Write-Host ""

if (-not $frontendAvailable -or -not $backendAvailable) {
    Write-Host "⚠️  Some ports are in use. Free them before starting servers." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Quick fix - Kill all Node processes:" -ForegroundColor Cyan
    Write-Host "  Get-Process node | Stop-Process -Force" -ForegroundColor White
} else {
    Write-Host "✅ All ports are available. You can start the servers." -ForegroundColor Green
}

Write-Host ""








