# Run as Administrator
# Docker D par hi rahega - C par sirf symlink (pointer). Junction ki jagah symlink + D par ownership/permissions fix.

$ErrorActionPreference = "Stop"
$dockerLocal = "C:\Users\Acer\AppData\Local\Docker"
$dockerD = "D:\Docker\AppData\Docker"

Write-Host "=== Docker D par chalane ke liye: Symlink + D permissions ===" -ForegroundColor Cyan
Write-Host "  (Data D par hi, C par sirf link; WSL ko D access dene ke liye fix)" -ForegroundColor Gray
Write-Host ""

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Run PowerShell as Administrator!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $dockerD)) {
    Write-Host "ERROR: D par Docker data nahi mila: $dockerD" -ForegroundColor Red
    Write-Host "Pehle Docker data D par copy karo (move-docker-from-f-to-d.ps1 ya move-docker-from-d-back-to-c se copy)." -ForegroundColor Yellow
    exit 1
}

# 1. WSL + Docker stop
Write-Host "[1/6] WSL shutdown..." -ForegroundColor Yellow
wsl --shutdown 2>$null
Start-Sleep -Seconds 5

Write-Host "[2/6] Docker processes stop..." -ForegroundColor Yellow
Get-Service -Name "com.docker*" -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.Name -match 'Docker|com\.docker' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# 2. C par jo hai (junction/symlink) hatao
Write-Host "[3/6] C par purana link (junction/symlink) hata rahe hain..." -ForegroundColor Yellow
if (Test-Path $dockerLocal) {
    $item = Get-Item $dockerLocal -Force -ErrorAction SilentlyContinue
    if ($item -and ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        cmd /c rmdir "`"$dockerLocal`""
        Write-Host "    Removed." -ForegroundColor Green
    } else {
        Write-Host "    C par real folder hai - rename karke backup lo (D par data use hoga)." -ForegroundColor Yellow
        $backup = "C:\Users\Acer\AppData\Local\Docker_backup_" + (Get-Date -Format "yyyyMMdd_HHmm")
        Rename-Item -Path $dockerLocal -NewName (Split-Path $backup -Leaf) -Force -ErrorAction SilentlyContinue
    }
}

# 3. C par symlink /D banao -> D (junction /J ki jagah symlink - WSL ke liye better)
Write-Host "[4/6] C par symlink bana rahe hain (C -> D), data D par hi rahega..." -ForegroundColor Yellow
cmd /c "mklink /D `"$dockerLocal`" `"$dockerD`""
if (-not (Test-Path $dockerLocal)) {
    Write-Host "ERROR: Symlink create nahi hua." -ForegroundColor Red
    exit 1
}
Write-Host "    Symlink: $dockerLocal -> $dockerD" -ForegroundColor Green

# 4. D par ownership + full permissions (WSL/HCS ko access chahiye)
Write-Host "[5/6] D par ownership aur permissions set (WSL ko access dene ke liye)..." -ForegroundColor Yellow
takeown /F "$dockerD" /R /A /D Y 2>$null
icacls "$dockerD" /grant "${env:USERNAME}:(OI)(CI)F" /T /Q 2>$null
icacls "$dockerD" /grant "SYSTEM:(OI)(CI)F" /T /Q 2>$null
icacls "$dockerD" /grant "Administrators:(OI)(CI)F" /T /Q 2>$null
# vhdx file par bhi explicitly
$vhdxPath = "$dockerD\wsl\main\ext4.vhdx"
if (Test-Path $vhdxPath) {
    takeown /F "$vhdxPath" /A 2>$null
    icacls "$vhdxPath" /grant "${env:USERNAME}:F" 2>$null
    icacls "$vhdxPath" /grant "SYSTEM:F" 2>$null
    icacls "$vhdxPath" /grant "Administrators:F" 2>$null
    Write-Host "    ext4.vhdx permissions set." -ForegroundColor Green
}
Write-Host "    Done." -ForegroundColor Green

Write-Host "[6/6] Ready." -ForegroundColor Green
Write-Host ""
Write-Host "Docker data D par hi hai. C par sirf symlink (pointer)." -ForegroundColor Cyan
Write-Host ""
Write-Host "Ab Docker Desktop **Run as Administrator** se start karo:" -ForegroundColor Yellow
Write-Host "  Start menu -> Docker Desktop -> Right-click -> Run as administrator" -ForegroundColor White
Write-Host ""
Write-Host "Agar phir bhi E_ACCESSDENIED aaye to Windows/WSL ki limitation ho sakti hai (vhdx sirf C par allow)." -ForegroundColor Gray
Write-Host "  Tab option: move-docker-from-d-back-to-c.ps1 (D se C par wapas, C par ~55 GB chahiye)." -ForegroundColor Gray
Write-Host ""
