# Docker WebSocket Connection Diagnostic Script
# Checks Docker containers and WebSocket connectivity

Write-Host "`n=== Docker WebSocket Diagnostic ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "1. Docker Status:" -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "   ✅ Docker is installed: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Docker is not installed or not running" -ForegroundColor Red
    Write-Host "   💡 Install Docker Desktop or start Docker service" -ForegroundColor Yellow
    exit 1
}

# Check if docker-compose is available
try {
    $composeVersion = docker-compose --version 2>&1
    Write-Host "   ✅ Docker Compose is available: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Docker Compose not found, using 'docker compose' command" -ForegroundColor Yellow
}

# Check container status
Write-Host "`n2. Container Status:" -ForegroundColor Yellow
try {
    $containers = docker ps --format "{{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1
    $tvfContainers = $containers | Select-String "tvf-"
    
    if ($tvfContainers) {
        Write-Host "   ✅ TVF containers found:" -ForegroundColor Green
        $tvfContainers | ForEach-Object {
            Write-Host "   $_" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   ❌ No TVF containers running" -ForegroundColor Red
        Write-Host "   💡 Start containers: docker-compose up -d" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error checking containers: $_" -ForegroundColor Red
}

# Check backend container specifically
Write-Host "`n3. Backend Container:" -ForegroundColor Yellow
try {
    $backendStatus = docker ps --filter "name=tvf-backend" --format "{{.Status}}" 2>&1
    if ($backendStatus) {
        Write-Host "   ✅ Backend container is running: $backendStatus" -ForegroundColor Green
        
        # Check backend logs for WebSocket
        Write-Host "`n4. Backend WebSocket Status:" -ForegroundColor Yellow
        $backendLogs = docker logs tvf-backend --tail 30 2>&1
        $wsInit = $backendLogs | Select-String -Pattern "websocket|socket|ws|DX events channel" -CaseSensitive:$false
        
        if ($wsInit) {
            Write-Host "   ✅ WebSocket initialization found in logs:" -ForegroundColor Green
            $wsInit | Select-Object -First 3 | ForEach-Object {
                Write-Host "   $_" -ForegroundColor Cyan
            }
        } else {
            Write-Host "   ⚠️  WebSocket initialization not found in recent logs" -ForegroundColor Yellow
            Write-Host "   💡 Check full logs: docker logs tvf-backend" -ForegroundColor Yellow
        }
        
        # Check for errors
        $errors = $backendLogs | Select-String -Pattern "error|Error|ERROR|failed|Failed" -CaseSensitive:$false
        if ($errors) {
            Write-Host "`n   ⚠️  Errors found in backend logs:" -ForegroundColor Yellow
            $errors | Select-Object -First 3 | ForEach-Object {
                Write-Host "   $_" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "   ❌ Backend container is not running" -ForegroundColor Red
        Write-Host "   💡 Start backend: docker-compose up -d backend" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error checking backend: $_" -ForegroundColor Red
}

# Test HTTP endpoint
Write-Host "`n5. HTTP Endpoint Test:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend HTTP server is responding" -ForegroundColor Green
        try {
            $healthData = $response.Content | ConvertFrom-Json
            Write-Host "   Status: $($healthData.status)" -ForegroundColor Cyan
            Write-Host "   Database: $($healthData.database)" -ForegroundColor Cyan
        } catch {
            Write-Host "   Response: $($response.Content)" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "   ❌ Backend HTTP server not responding" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   💡 Check if backend container is running" -ForegroundColor Yellow
}

# Check port mapping
Write-Host "`n6. Port Mapping:" -ForegroundColor Yellow
try {
    $backendPorts = docker port tvf-backend 2>&1
    if ($backendPorts -match "5000") {
        Write-Host "   ✅ Port 5000 is mapped:" -ForegroundColor Green
        Write-Host "   $backendPorts" -ForegroundColor Cyan
    } else {
        Write-Host "   ❌ Port 5000 not mapped" -ForegroundColor Red
        Write-Host "   💡 Check docker-compose.yml ports configuration" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Could not check port mapping" -ForegroundColor Yellow
}

# Check environment variables
Write-Host "`n7. Environment Variables:" -ForegroundColor Yellow
try {
    $backendEnv = docker exec tvf-backend env 2>&1 | Select-String "FRONTEND_URL"
    if ($backendEnv) {
        Write-Host "   ✅ Backend FRONTEND_URL:" -ForegroundColor Green
        Write-Host "   $backendEnv" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  FRONTEND_URL not set in backend" -ForegroundColor Yellow
    }
    
    $frontendEnv = docker exec tvf-frontend env 2>&1 | Select-String "NEXT_PUBLIC_API_URL"
    if ($frontendEnv) {
        Write-Host "   ✅ Frontend NEXT_PUBLIC_API_URL:" -ForegroundColor Green
        Write-Host "   $frontendEnv" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  NEXT_PUBLIC_API_URL not set in frontend" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Could not check environment variables" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To fix WebSocket connection in Docker:" -ForegroundColor Yellow
Write-Host "1. Ensure containers are running: docker-compose ps" -ForegroundColor White
Write-Host "2. Check backend logs: docker logs tvf-backend" -ForegroundColor White
Write-Host "3. Verify WebSocket initialized: Look for '[ws] DX events channel initialized'" -ForegroundColor White
Write-Host "4. Test HTTP endpoint: curl http://localhost:5000/health" -ForegroundColor White
Write-Host "5. Check browser console for connection errors" -ForegroundColor White
Write-Host "6. Restart if needed: docker-compose restart backend" -ForegroundColor White
Write-Host ""
