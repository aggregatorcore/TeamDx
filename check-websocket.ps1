# WebSocket Connection Checker Script
# Checks if backend server is running and WebSocket is accessible

Write-Host "`n=== WebSocket Connection Checker ===" -ForegroundColor Cyan
Write-Host ""

# Check if backend server is running
Write-Host "1. Checking backend server..." -ForegroundColor Yellow
$backendProcess = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { 
    $_.Path -like "*node*" 
}

if ($backendProcess) {
    Write-Host "   ✅ Node.js processes found: $($backendProcess.Count)" -ForegroundColor Green
} else {
    Write-Host "   ❌ No Node.js processes found" -ForegroundColor Red
    Write-Host "   💡 Start backend: npm run server" -ForegroundColor Yellow
}

# Test port 5000
Write-Host "`n2. Testing port 5000..." -ForegroundColor Yellow
try {
    $portTest = Test-NetConnection -ComputerName localhost -Port 5000 -WarningAction SilentlyContinue -InformationLevel Quiet
    if ($portTest) {
        Write-Host "   ✅ Port 5000 is accessible" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Port 5000 is not accessible" -ForegroundColor Red
        Write-Host "   💡 Backend server might not be running" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error testing port: $_" -ForegroundColor Red
}

# Check .env file
Write-Host "`n3. Checking .env configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "NEXT_PUBLIC_API_URL.*localhost:5000") {
        Write-Host "   ✅ NEXT_PUBLIC_API_URL configured correctly" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  NEXT_PUBLIC_API_URL might be incorrect" -ForegroundColor Yellow
        Write-Host "   💡 Should be: NEXT_PUBLIC_API_URL=http://localhost:5000" -ForegroundColor Yellow
    }
    
    if ($envContent -match "PORT=5000") {
        Write-Host "   ✅ PORT configured correctly" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  PORT might be incorrect" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ .env file not found" -ForegroundColor Red
    Write-Host "   💡 Create .env file with required variables" -ForegroundColor Yellow
}

# Check if port 5000 is in use
Write-Host "`n4. Checking port 5000 usage..." -ForegroundColor Yellow
$portInUse = netstat -ano | findstr ":5000"
if ($portInUse) {
    Write-Host "   ✅ Port 5000 is in use (backend likely running)" -ForegroundColor Green
    Write-Host "   Details:" -ForegroundColor Cyan
    $portInUse | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "   ❌ Port 5000 is not in use" -ForegroundColor Red
    Write-Host "   💡 Backend server is not running" -ForegroundColor Yellow
}

# Test HTTP endpoint
Write-Host "`n5. Testing HTTP endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend HTTP server is responding" -ForegroundColor Green
        $healthData = $response.Content | ConvertFrom-Json
        Write-Host "   Status: $($healthData.status)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   ❌ Backend HTTP server not responding" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   💡 Start backend: npm run server" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To fix WebSocket connection:" -ForegroundColor Yellow
Write-Host "1. Ensure backend is running: npm run server" -ForegroundColor White
Write-Host "2. Check .env has: NEXT_PUBLIC_API_URL=http://localhost:5000" -ForegroundColor White
Write-Host "3. Verify port 5000 is accessible" -ForegroundColor White
Write-Host "4. Check browser console for detailed errors" -ForegroundColor White
Write-Host ""
