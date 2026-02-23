# Start Docker Development Environment with Hot Reload
Write-Host "🐳 Starting Docker Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker ps | Out-Null
} catch {
    Write-Host "✗ Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠ Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating default .env file..." -ForegroundColor Yellow
    
    @"
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=5432
JWT_SECRET=immigration-office-secret-key-2024
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_API_URL=http://localhost:5000
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/immigration_db?schema=public
"@ | Out-File -FilePath ".env" -Encoding utf8
    
    Write-Host "✓ Default .env file created" -ForegroundColor Green
    Write-Host ""
}

# Create PostgreSQL data directory on F drive
if (-not (Test-Path "F:\Docker\data\postgres")) {
    Write-Host "Creating PostgreSQL data directory on F drive..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "F:\Docker\data\postgres" -Force | Out-Null
    Write-Host "✓ PostgreSQL data directory created" -ForegroundColor Green
    Write-Host ""
}

Write-Host "🚀 Starting services with hot reload..." -ForegroundColor Green
Write-Host ""
Write-Host "Services will be available at:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor White
Write-Host ""
Write-Host "📝 Hot Reload Features:" -ForegroundColor Cyan
Write-Host "  ✓ Backend: Auto-restart on code changes" -ForegroundColor Green
Write-Host "  ✓ Frontend: Fast Refresh enabled" -ForegroundColor Green
Write-Host "  ✓ Database: Persistent on F drive" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Start Docker Compose
docker-compose -f docker-compose.dev.yml up --build
