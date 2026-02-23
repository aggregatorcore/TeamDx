# Quick Start Script - Complete Development Setup
# Usage: .\scripts\quick-start.ps1

Write-Host "=== TVF DX - Quick Start ===" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "1. Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host "   Install from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "   ✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ npm is not installed!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check if .env exists
Write-Host "2. Checking environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "   ⚠️  .env file not found" -ForegroundColor Yellow
    Write-Host "   Creating .env from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "   ✅ .env file created" -ForegroundColor Green
        Write-Host "   ⚠️  Please update .env with your configuration" -ForegroundColor Yellow
    } else {
        Write-Host "   ❌ .env.example not found" -ForegroundColor Red
        Write-Host "   Please create .env manually" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✅ .env file exists" -ForegroundColor Green
}

Write-Host ""

# Check dependencies
Write-Host "3. Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "   ⚠️  Dependencies not installed" -ForegroundColor Yellow
    Write-Host "   Installing dependencies (this may take a while)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "   ✅ Dependencies installed" -ForegroundColor Green
}

Write-Host ""

# Generate Prisma client
Write-Host "4. Setting up database..." -ForegroundColor Yellow
try {
    npm run db:generate
    Write-Host "   ✅ Prisma client generated" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Failed to generate Prisma client" -ForegroundColor Yellow
}

# Check if database exists (SQLite)
if (Test-Path "prisma/dev.db") {
    Write-Host "   ✅ Database file exists" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Database not initialized" -ForegroundColor Yellow
    Write-Host "   Run 'npm run db:push' to initialize database" -ForegroundColor Yellow
}

Write-Host ""

# Check ports
Write-Host "5. Checking port availability..." -ForegroundColor Yellow
$frontendPort = 3000
$backendPort = 5000

$frontendInUse = Get-NetTCPConnection -LocalPort $frontendPort -ErrorAction SilentlyContinue
$backendInUse = Get-NetTCPConnection -LocalPort $backendPort -ErrorAction SilentlyContinue

if ($frontendInUse) {
    Write-Host "   ⚠️  Port $frontendPort (Frontend) is in use" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Port $frontendPort (Frontend) is available" -ForegroundColor Green
}

if ($backendInUse) {
    Write-Host "   ⚠️  Port $backendPort (Backend) is in use" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Port $backendPort (Backend) is available" -ForegroundColor Green
}

Write-Host ""

# Summary
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Update .env file with your configuration" -ForegroundColor White
Write-Host "  2. Initialize database: npm run db:push" -ForegroundColor White
Write-Host "  3. Seed database (optional): npm run db:seed" -ForegroundColor White
Write-Host "  4. Start servers: .\start-dev.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Access points:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor Cyan
Write-Host ""








