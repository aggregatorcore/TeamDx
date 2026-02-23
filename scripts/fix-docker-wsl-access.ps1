# Run as Administrator - WSL E_ACCESSDENIED fix (Docker on D drive)
# Fixes: RegisterDistro/MountDisk/HCS/E_ACCESSDENIED for ext4.vhdx

$ErrorActionPreference = "Stop"
$dockerWsl = "D:\Docker\AppData\Docker\wsl"

Write-Host "=== Docker WSL Access Fix (E_ACCESSDENIED) ===" -ForegroundColor Cyan
Write-Host ""

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Run PowerShell as Administrator!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $dockerWsl)) {
    Write-Host "Path not found: $dockerWsl" -ForegroundColor Red
    Write-Host "Checking junction target..." -ForegroundColor Yellow
    $junctionPath = "C:\Users\Acer\AppData\Local\Docker"
    if (Test-Path $junctionPath) {
        $target = (Get-Item $junctionPath).Target
        Write-Host "Junction points to: $target" -ForegroundColor Gray
        $dockerWsl = Join-Path $target "wsl"
    }
}

Write-Host "[1] WSL shutdown..." -ForegroundColor Yellow
wsl --shutdown 2>$null
Start-Sleep -Seconds 5

Write-Host "[2] Docker processes stop..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.Name -match 'Docker|com\.docker' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

Write-Host "[3] Permissions set on D:\Docker\AppData\Docker (WSL needs access)..." -ForegroundColor Yellow
$dockerRoot = "D:\Docker\AppData\Docker"
if (Test-Path $dockerRoot) {
    icacls "$dockerRoot" /grant "${env:USERNAME}:(OI)(CI)F" /T /Q 2>$null
    icacls "$dockerRoot" /grant "SYSTEM:(OI)(CI)F" /T /Q 2>$null
    icacls "$dockerRoot" /grant "Administrators:(OI)(CI)F" /T /Q 2>$null
    Write-Host "    Done." -ForegroundColor Green
} else {
    Write-Host "    Folder not found - skip." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Ab Docker Desktop ko **Run as Administrator** se start karo:" -ForegroundColor Cyan
Write-Host "  Right-click Docker Desktop -> Run as administrator" -ForegroundColor White
Write-Host ""
Write-Host "Agar phir bhi error aaye to:" -ForegroundColor Yellow
Write-Host "  1. Windows restart karo, phir Docker Desktop (as Admin) start karo." -ForegroundColor White
Write-Host "  2. Antivirus me D:\Docker exclude/add trust karo." -ForegroundColor White
Write-Host ""
