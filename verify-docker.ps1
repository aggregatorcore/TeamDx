# Docker Verification Script
# Run this after Docker Desktop is installed

Write-Host "=== Docker Verification ===" -ForegroundColor Cyan
Write-Host ""

# Check Docker CLI
Write-Host "Checking Docker CLI..." -ForegroundColor Green
$dockerPath = where.exe docker 2>$null
if ($dockerPath) {
    Write-Host "  ✓ Docker CLI found: $dockerPath" -ForegroundColor Green
} else {
    Write-Host "  ✗ Docker CLI not found in PATH" -ForegroundColor Red
    Write-Host "  Checking default location..." -ForegroundColor Yellow
    $defaultPath = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
    if (Test-Path $defaultPath) {
        Write-Host "  ✓ Docker found at: $defaultPath" -ForegroundColor Green
        Write-Host "  ⚠ Adding to PATH..." -ForegroundColor Yellow
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        $dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
        if ($currentPath -notlike "*$dockerBin*") {
            [Environment]::SetEnvironmentVariable("Path", "$currentPath;$dockerBin", "Machine")
            Write-Host "  ✓ Added to System PATH. Please restart PowerShell." -ForegroundColor Green
            exit 0
        }
    } else {
        Write-Host "  ✗ Docker not found. Please install Docker Desktop." -ForegroundColor Red
        exit 1
    }
}

# Test Docker commands
Write-Host ""
Write-Host "Testing Docker commands..." -ForegroundColor Green

try {
    $dockerVersion = docker --version 2>&1
    Write-Host "  ✓ docker --version: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ docker --version failed" -ForegroundColor Red
    exit 1
}

try {
    $composeVersion = docker compose version 2>&1
    Write-Host "  ✓ docker compose version: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ docker compose version failed" -ForegroundColor Red
    exit 1
}

try {
    $dockerInfo = docker info 2>&1 | Select-Object -First 3
    Write-Host "  ✓ docker info: OK" -ForegroundColor Green
} catch {
    Write-Host "  ✗ docker info failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Docker Verification: PASS ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Run verify-tvf-docker.ps1 to test TVF DX compose" -ForegroundColor Cyan


