# Development Mode with Live Logs
# Runs app in debug mode AND shows logs in separate window
Write-Host "=== Mobile App Development with Live Logs ===" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting in 2 windows:" -ForegroundColor Yellow
Write-Host "  1. Flutter Debug Mode (hot reload)" -ForegroundColor Cyan
Write-Host "  2. Live Logs Watcher (errors & debug)" -ForegroundColor Cyan
Write-Host ""

# Start logs watcher in new window
Write-Host "Opening logs window..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; .\watch_logs.ps1" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start Flutter in current window
Write-Host "Starting Flutter debug mode..." -ForegroundColor Yellow
Write-Host ""
Set-Location $scriptPath
.\live_dev.ps1

