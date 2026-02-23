# Docker Desktop & WSL2 Installation Script for Windows
# Run this script as Administrator
# After running, reboot is required

Write-Host "=== Docker Desktop & WSL2 Installation Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Enabling WSL2 features..." -ForegroundColor Green

# Enable WSL feature
Write-Host "  - Enabling Windows Subsystem for Linux..." -ForegroundColor Gray
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Enable Virtual Machine Platform
Write-Host "  - Enabling Virtual Machine Platform..." -ForegroundColor Gray
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Write-Host ""
Write-Host "Step 2: Installing WSL2..." -ForegroundColor Green
wsl --install

Write-Host ""
Write-Host "Step 3: Setting WSL2 as default..." -ForegroundColor Green
wsl --set-default-version 2

Write-Host ""
Write-Host "=== IMPORTANT: REBOOT REQUIRED ===" -ForegroundColor Yellow
Write-Host "Please restart your computer now." -ForegroundColor Yellow
Write-Host "After reboot, install Docker Desktop from:" -ForegroundColor Yellow
Write-Host "  https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
Write-Host ""
Write-Host "After Docker Desktop installation, run verify-docker.ps1" -ForegroundColor Green


