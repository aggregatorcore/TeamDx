# Run this script as Administrator (Right-click PowerShell -> Run as Administrator)
# This moves Docker's AppData to F drive so C drive gets space
# Fixes: "There is not enough space on the disk" for init.log

$ErrorActionPreference = "Stop"
$dockerLocal = "C:\Users\Acer\AppData\Local\Docker"
$dockerF = "F:\Docker\AppData\Docker"

Write-Host "=== Move Docker AppData to F Drive ===" -ForegroundColor Cyan
Write-Host ""

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Please run PowerShell as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell -> Run as administrator" -ForegroundColor Yellow
    exit 1
}

# 1. Shut down WSL (releases lock on Docker vhdx files)
Write-Host "Shutting down WSL..." -ForegroundColor Yellow
wsl --shutdown 2>$null
Start-Sleep -Seconds 3

# 2. Stop Docker Windows services
Write-Host "Stopping Docker services..." -ForegroundColor Yellow
Get-Service -Name "com.docker*" -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue
Get-Service -Name "Docker Desktop*" -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 3. Stop Docker processes
Write-Host "Stopping Docker processes..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.Name -match 'Docker|com\.docker' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# 4. Take ownership of Docker folder (required when access denied)
Write-Host "Taking ownership of Docker folder..." -ForegroundColor Yellow
if (Test-Path $dockerLocal) {
    takeown /F $dockerLocal /R /A /D Y 2>$null
    icacls $dockerLocal /grant "${env:USERNAME}:(F)" /T /Q 2>$null
    Start-Sleep -Seconds 2
}

# 5. Rename existing Docker folder on C
if (Test-Path $dockerLocal) {
    $dockerOld = "C:\Users\Acer\AppData\Local\Docker_old"
    if (Test-Path $dockerOld) {
        Write-Host "Removing old Docker_old folder..." -ForegroundColor Yellow
        takeown /F $dockerOld /R /A /D Y 2>$null
        icacls $dockerOld /grant "${env:USERNAME}:(F)" /T /Q 2>$null
        Remove-Item $dockerOld -Recurse -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    Write-Host "Renaming Docker to Docker_old on C drive..." -ForegroundColor Yellow
    try {
        Rename-Item -Path $dockerLocal -NewName "Docker_old" -Force
    } catch {
        Write-Host "Rename still failed. Trying via cmd rd/mklink..." -ForegroundColor Yellow
        # Last resort: use cmd to create junction over empty folder (if we had copied to F)
        Write-Host ""
        Write-Host "If you still see 'Access denied':" -ForegroundColor Red
        Write-Host "  1. Restart your PC (so WSL and services release the folder)." -ForegroundColor White
        Write-Host "  2. After restart, run this script again as Administrator BEFORE opening Docker." -ForegroundColor White
        Write-Host ""
        throw $_
    }
}

# Create F drive folder
Write-Host "Creating F:\Docker\AppData\Docker..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $dockerF -Force | Out-Null

# Create junction (C:\...\Docker -> F:\...\Docker)
Write-Host "Creating junction (Docker will use F drive)..." -ForegroundColor Yellow
cmd /c mklink /J "C:\Users\Acer\AppData\Local\Docker" "F:\Docker\AppData\Docker"

Write-Host ""
Write-Host "Done! Docker will now use F drive." -ForegroundColor Green
Write-Host "Start Docker Desktop - it will write logs and data to F drive." -ForegroundColor Green
Write-Host ""
Write-Host "To free ~57 GB on C drive later, delete:" -ForegroundColor Cyan
Write-Host "  C:\Users\Acer\AppData\Local\Docker_old" -ForegroundColor White
Write-Host "(After confirming Docker works fine from F drive)" -ForegroundColor Gray
Write-Host ""
