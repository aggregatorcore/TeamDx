# Start Frontend Server with Diagnostics
Write-Host "=== Starting Frontend Server ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "1. Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js not found!" -ForegroundColor Red
    Write-Host "   Install from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check dependencies
Write-Host ""
Write-Host "2. Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "   ⚠️  Dependencies not installed" -ForegroundColor Yellow
    Write-Host "   Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ✅ Dependencies installed" -ForegroundColor Green
}

# Check port
Write-Host ""
Write-Host "3. Checking port 3000..." -ForegroundColor Yellow
$portInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portInUse) {
    $process = Get-Process -Id $portInUse.OwningProcess -ErrorAction SilentlyContinue
    Write-Host "   ⚠️  Port 3000 is already in use" -ForegroundColor Yellow
    Write-Host "   Process: $($process.ProcessName) (PID: $($portInUse.OwningProcess))" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "   Kill process and continue? (y/n)"
    if ($response -eq 'y') {
        Stop-Process -Id $portInUse.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "   ✅ Process killed" -ForegroundColor Green
    } else {
        Write-Host "   Exiting..." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "   ✅ Port 3000 is available" -ForegroundColor Green
}

# Start server
Write-Host ""
Write-Host "4. Starting Next.js development server..." -ForegroundColor Yellow
Write-Host "   This will open in a new window" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Access at: http://localhost:3000" -ForegroundColor Green
Write-Host "   Press Ctrl+C in the server window to stop" -ForegroundColor Yellow
Write-Host ""

# Start in new window so we can see output
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; Write-Host 'Starting Next.js...' -ForegroundColor Cyan; npm run dev"

Write-Host "✅ Server starting in new window..." -ForegroundColor Green
Write-Host ""
Write-Host "Waiting 5 seconds for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check if server is running
$serverRunning = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($serverRunning) {
    Write-Host "✅ Server is running on http://localhost:3000" -ForegroundColor Green
    Write-Host ""
    Write-Host "Opening browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:3000"
} else {
    Write-Host "⚠️  Server may still be starting..." -ForegroundColor Yellow
    Write-Host "   Check the server window for any errors" -ForegroundColor Yellow
    Write-Host "   Or wait a few more seconds and refresh your browser" -ForegroundColor Yellow
}

Write-Host ""








