# Run as Administrator
# Docker data F drive (pendrive) se D drive par move karta hai - fast internal drive

$ErrorActionPreference = "Stop"
$dockerLocal = "C:\Users\Acer\AppData\Local\Docker"
$dockerF = "F:\Docker\AppData\Docker"
$dockerD = "D:\Docker\AppData\Docker"

Write-Host "=== Docker: F drive -> D drive move ===" -ForegroundColor Cyan
Write-Host ""

# Admin check
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Run PowerShell as Administrator! (Right-click -> Run as administrator)" -ForegroundColor Red
    exit 1
}

# 1. WSL shutdown
Write-Host "[1/6] WSL shutdown..." -ForegroundColor Yellow
wsl --shutdown 2>$null
Start-Sleep -Seconds 3

# 2. Docker services stop
Write-Host "[2/6] Docker services stop..." -ForegroundColor Yellow
Get-Service -Name "com.docker*" -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue
Get-Service -Name "Docker Desktop*" -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 3. Docker processes stop
Write-Host "[3/6] Docker processes stop..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.Name -match 'Docker|com\.docker' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# 4. D par folder banao
Write-Host "[4/6] D drive par folder bana rahe hain..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $dockerD -Force | Out-Null

# 5. F se D par copy (robocopy - bada data ke liye)
if (-not (Test-Path $dockerF)) {
    Write-Host "ERROR: F par Docker data nahi mila: $dockerF" -ForegroundColor Red
    Write-Host "Pehle Docker F par use kiya tha? Junction check karo." -ForegroundColor Yellow
    exit 1
}

Write-Host "[5/6] F se D par copy ho raha hai (50-60 GB ho sakta hai, thoda time lagega)..." -ForegroundColor Yellow
$rc = 0
& robocopy "$dockerF" "$dockerD" /E /COPY:DAT /R:2 /W:5 /MT:8 /NFL /NDL /NP
$rc = $LASTEXITCODE
# Robocopy exit: 0=nothing, 1=files copied, 2+ = extra; 8+ = failures
if ($rc -ge 8) {
    Write-Host "ERROR: Copy me problem - robocopy exit $rc" -ForegroundColor Red
    exit 1
}
Write-Host "Copy complete." -ForegroundColor Green

# 6. Purana junction hatao (sirf link hatao, F ka data rehne do abhi)
Write-Host "[6/6] Junction update: C -> D ..." -ForegroundColor Yellow
if (Test-Path $dockerLocal) {
    $item = Get-Item $dockerLocal -Force
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        cmd /c rmdir "`"$dockerLocal`""
    } else {
        Write-Host "WARNING: C par Docker folder junction nahi hai - rename karke backup lo, phir junction banao." -ForegroundColor Yellow
        $dockerOld = "C:\Users\Acer\AppData\Local\Docker_old_from_C"
        if (Test-Path $dockerOld) { Remove-Item $dockerOld -Recurse -Force -ErrorAction SilentlyContinue }
        Rename-Item -Path $dockerLocal -NewName "Docker_old_from_C" -Force -ErrorAction Stop
    }
}

cmd /c mklink /J "C:\Users\Acer\AppData\Local\Docker" "D:\Docker\AppData\Docker"

Write-Host ""
Write-Host "Done! Docker ab D drive use karega (fast)." -ForegroundColor Green
Write-Host "  C:\Users\Acer\AppData\Local\Docker -> D:\Docker\AppData\Docker" -ForegroundColor Gray
Write-Host ""
Write-Host "Docker Desktop start karo - ab internal D drive par chalega." -ForegroundColor Cyan
Write-Host ""
Write-Host "Optional: F drive (pendrive) par purana data delete karke space free kar sakte ho:" -ForegroundColor Yellow
Write-Host "  Remove-Item 'F:\Docker\AppData\Docker' -Recurse -Force" -ForegroundColor White
Write-Host "(Sirf tab karo jab Docker D se sahi chal raha ho.)" -ForegroundColor Gray
Write-Host ""
