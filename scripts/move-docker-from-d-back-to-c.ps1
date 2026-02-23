# Run as Administrator
# Docker data D se C par wapas move - WSL E_ACCESSDENIED fix
# WSL/HCS sirf C: par vhdx allow karta hai; D par junction se E_ACCESSDENIED aata hai

$ErrorActionPreference = "Stop"
$dockerLocal = "C:\Users\Acer\AppData\Local\Docker"
$dockerD = "D:\Docker\AppData\Docker"
$minFreeGB = 55

Write-Host "=== Docker: D -> C (WSL E_ACCESSDENIED fix) ===" -ForegroundColor Cyan
Write-Host ""

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Run PowerShell as Administrator!" -ForegroundColor Red
    exit 1
}

# C drive free space
$vol = Get-Volume -DriveLetter C -ErrorAction SilentlyContinue
if (-not $vol) { Write-Host "C drive not found." -ForegroundColor Red; exit 1 }
$freeGB = [math]::Round($vol.SizeRemaining / 1GB, 2)
Write-Host "C drive free: $freeGB GB (need ~$minFreeGB GB)" -ForegroundColor Gray
if ($freeGB -lt $minFreeGB) {
    Write-Host "ERROR: C par kam space. Kam se kam $minFreeGB GB chahiye." -ForegroundColor Red
    exit 1
}

# 1. WSL + Docker stop
Write-Host "[1/5] WSL shutdown..." -ForegroundColor Yellow
wsl --shutdown 2>$null
Start-Sleep -Seconds 5

Write-Host "[2/5] Docker processes stop..." -ForegroundColor Yellow
Get-Service -Name "com.docker*" -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue
Get-Process | Where-Object { $_.Name -match 'Docker|com\.docker' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# 3. Junction hatao (sirf link, D ka data rehta hai)
Write-Host "[3/5] Junction remove (C -> D)..." -ForegroundColor Yellow
if (Test-Path $dockerLocal) {
    $item = Get-Item $dockerLocal -Force -ErrorAction SilentlyContinue
    if ($item -and ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        cmd /c rmdir "`"$dockerLocal`""
        Write-Host "    Junction removed." -ForegroundColor Green
    } else {
        Write-Host "    C par Docker real folder hai (junction nahi). Ab copy se overwrite hoga." -ForegroundColor Yellow
        # C par pehle se data hai to D se copy karke merge/skip - safer: delete C content and copy D
        Remove-Item "$dockerLocal\*" -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 4. C par real folder banao, D se copy
New-Item -ItemType Directory -Path $dockerLocal -Force | Out-Null

Write-Host "[4/5] D se C par copy (50-60 GB, 10-20 min lag sakta hai)..." -ForegroundColor Yellow
if (-not (Test-Path $dockerD)) {
    Write-Host "ERROR: D par Docker data nahi mila: $dockerD" -ForegroundColor Red
    exit 1
}

& robocopy "$dockerD" "$dockerLocal" /E /COPY:DAT /R:2 /W:5 /MT:8 /NFL /NDL /NP
$rc = $LASTEXITCODE
if ($rc -ge 8) {
    Write-Host "ERROR: Copy failed - robocopy exit $rc" -ForegroundColor Red
    exit 1
}
Write-Host "    Copy complete." -ForegroundColor Green

# 5. Permissions (WSL access ke liye)
Write-Host "[5/5] Permissions set..." -ForegroundColor Yellow
icacls "$dockerLocal" /grant "${env:USERNAME}:(OI)(CI)F" /T /Q 2>$null
icacls "$dockerLocal" /grant "SYSTEM:(OI)(CI)F" /T /Q 2>$null
Write-Host "    Done." -ForegroundColor Green

Write-Host ""
Write-Host "Done! Docker ab C drive par (WSL vhdx bhi C par)." -ForegroundColor Green
Write-Host "  C:\Users\Acer\AppData\Local\Docker = real folder (no junction)" -ForegroundColor Gray
Write-Host ""
Write-Host "Docker Desktop start karo - E_ACCESSDENIED nahi aana chahiye." -ForegroundColor Cyan
Write-Host ""
Write-Host "Optional: D par purana data delete karke space free:" -ForegroundColor Yellow
Write-Host "  Remove-Item 'D:\Docker\AppData\Docker' -Recurse -Force" -ForegroundColor White
Write-Host "(Sirf jab confirm ho Docker C se sahi chal raha ho.)" -ForegroundColor Gray
Write-Host ""
