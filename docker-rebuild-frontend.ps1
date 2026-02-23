# Rebuild and restart Docker frontend container
Write-Host "=== Rebuilding Docker Frontend ===" -ForegroundColor Cyan
Write-Host ""

# Stop existing containers
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker-compose down frontend

# Remove old frontend container and image (optional - uncomment if needed)
# Write-Host "Removing old frontend image..." -ForegroundColor Yellow
# docker rmi tvf-frontend 2>$null

# Build frontend with new Dockerfile
Write-Host ""
Write-Host "Building frontend container..." -ForegroundColor Yellow
docker-compose build frontend

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Build successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Starting frontend container..." -ForegroundColor Yellow
    docker-compose up -d frontend
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Frontend container started!" -ForegroundColor Green
        Write-Host ""
        Write-Host "View logs with: docker-compose logs -f frontend" -ForegroundColor Cyan
        Write-Host "Or check status: docker-compose ps" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ Failed to start container" -ForegroundColor Red
        Write-Host "Check logs: docker-compose logs frontend" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor Yellow
}
