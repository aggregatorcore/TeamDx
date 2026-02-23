# Restart Backend and Frontend Servers
Write-Host "=== Restarting Servers ===" -ForegroundColor Cyan
Write-Host ""

# Function to kill process on port
function Stop-ProcessOnPort {
    param([int]$Port)
    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($process) {
        Write-Host "Stopping process on port $Port (PID: $process)..." -ForegroundColor Yellow
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# Stop existing servers
Write-Host "1. Stopping existing servers..." -ForegroundColor Yellow
Stop-ProcessOnPort -Port 5000  # Backend
Stop-ProcessOnPort -Port 3000  # Frontend

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "2. Starting Backend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run server" -WindowStyle Normal

Start-Sleep -Seconds 5

Write-Host "3. Starting Frontend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✅ Servers restarted!" -ForegroundColor Green
Write-Host "   Backend: http://localhost:5000" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Waiting 10 seconds for servers to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Verify servers
Write-Host ""
Write-Host "4. Verifying servers..." -ForegroundColor Yellow

try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/mobile/test" -TimeoutSec 5 -UseBasicParsing
    if ($backendResponse.StatusCode -eq 200) {
        Write-Host "   ✅ Backend is running" -ForegroundColor Green
        $data = $backendResponse.Content | ConvertFrom-Json
        if ($data.hasAutoRegistration) {
            Write-Host "   ✅ Backend has new code (Auto-registration enabled)" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "   ⚠️  Backend not responding yet (may need more time)" -ForegroundColor Yellow
}

try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -UseBasicParsing
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "   ✅ Frontend is running" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  Frontend not responding yet (may need more time)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Restart Complete ===" -ForegroundColor Cyan

