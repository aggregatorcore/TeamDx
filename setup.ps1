# Immigration Office Management - Setup Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Immigration Office Management Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    $npmVersion = npm --version 2>&1
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
    Write-Host "✓ npm found: $npmVersion" -ForegroundColor Green
    Write-Host ""
    
    # Check if node_modules exists
    if (Test-Path "node_modules") {
        Write-Host "Dependencies already installed." -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Dependencies installed successfully!" -ForegroundColor Green
        } else {
            Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
            exit 1
        }
        Write-Host ""
    }
    
    # Check .env file
    if (Test-Path ".env") {
        Write-Host "✓ .env file exists" -ForegroundColor Green
    } else {
        Write-Host "⚠ .env file not found. Please create it with database credentials." -ForegroundColor Yellow
    }
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Setup Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Update .env file with your PostgreSQL credentials" -ForegroundColor White
    Write-Host "2. Run: npm run db:generate" -ForegroundColor White
    Write-Host "3. Run: npm run db:push" -ForegroundColor White
    Write-Host "4. Run: npm run db:seed" -ForegroundColor White
    Write-Host "5. Start backend: npm run server (in one terminal)" -ForegroundColor White
    Write-Host "6. Start frontend: npm run dev (in another terminal)" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "✗ Node.js is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js first:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://nodejs.org/" -ForegroundColor White
    Write-Host "2. Install the LTS version" -ForegroundColor White
    Write-Host "3. Restart PowerShell/Terminal" -ForegroundColor White
    Write-Host "4. Run this script again" -ForegroundColor White
    Write-Host ""
    exit 1
}

