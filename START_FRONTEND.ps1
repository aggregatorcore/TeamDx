# Start Frontend Server Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Frontend Server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found!" -ForegroundColor Red
    Write-Host "Please run this script from project root (E:\TVF_DX)" -ForegroundColor Yellow
    exit 1
}

# Check dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Check .env file
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating .env file with default values..." -ForegroundColor Yellow
    @"
DATABASE_URL="file:./dev.db"
JWT_SECRET="immigration-office-secret-key-2024"
JWT_EXPIRES_IN="7d"
PORT=5000
NEXT_PUBLIC_API_URL="http://localhost:5000"
"@ | Out-File -FilePath ".env" -Encoding utf8
    Write-Host "✅ .env file created" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Starting Next.js development server..." -ForegroundColor Green
Write-Host "This will start on: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the server
npm run dev

