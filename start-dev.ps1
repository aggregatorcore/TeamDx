# Start Development Servers
Write-Host "Starting Immigration Office Management..." -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    node --version | Out-Null
} catch {
    Write-Host "✗ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Dependencies not found. Installing..." -ForegroundColor Yellow
    npm install
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠ Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "Please create .env file with database credentials." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Starting servers..." -ForegroundColor Green
Write-Host ""
Write-Host "Backend will run on: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend will run on: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host ""

# Start both servers concurrently
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run server"
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"

Write-Host "Servers started in separate windows" -ForegroundColor Green
Write-Host "Open http://localhost:3000 in your browser" -ForegroundColor Cyan

