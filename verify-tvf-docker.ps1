# TVF DX Docker Compose Verification Script

Write-Host "=== TVF DX Docker Compose Verification ===" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERROR: docker-compose.yml not found!" -ForegroundColor Red
    Write-Host "Please run this script from E:\TVF_DX directory" -ForegroundColor Yellow
    exit 1
}

# Check Docker
$dockerCheck = docker --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker not available!" -ForegroundColor Red
    Write-Host "Please install Docker Desktop and run verify-docker.ps1 first" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Cleaning up existing containers..." -ForegroundColor Green
docker compose down -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠ Cleanup had warnings (may be normal if no containers exist)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 2: Building images (no cache)..." -ForegroundColor Green
docker compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Build successful" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Starting services..." -ForegroundColor Green
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Failed to start services!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Services started" -ForegroundColor Green

Write-Host ""
Write-Host "Waiting 10 seconds for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "Step 4: Checking service status..." -ForegroundColor Green
docker compose ps

Write-Host ""
Write-Host "Step 5: Postgres logs (last 200 lines)..." -ForegroundColor Green
Write-Host "---" -ForegroundColor Gray
docker compose logs --no-color --tail=200 postgres

Write-Host ""
Write-Host "Step 6: Backend logs (last 200 lines)..." -ForegroundColor Green
Write-Host "---" -ForegroundColor Gray
docker compose logs --no-color --tail=200 backend

Write-Host ""
Write-Host "Step 7: Frontend logs (last 200 lines)..." -ForegroundColor Green
Write-Host "---" -ForegroundColor Gray
docker compose logs --no-color --tail=200 frontend

Write-Host ""
Write-Host "=== Verification Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Check the output above for:" -ForegroundColor Yellow
Write-Host "  ✓ postgres = Up (healthy)" -ForegroundColor Green
Write-Host "  ✓ backend = Up (healthy) on port 5000" -ForegroundColor Green
Write-Host "  ✓ frontend = Up on port 3000" -ForegroundColor Green
Write-Host "  ✓ Backend logs show 'Selected Prisma schema: postgresql'" -ForegroundColor Green
Write-Host "  ✓ Backend logs show 'Database connection established'" -ForegroundColor Green


