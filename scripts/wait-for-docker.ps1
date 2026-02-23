# Docker Desktop ready hone tak wait karo - rukna mat, jab tak working na ho
# Run: .\scripts\wait-for-docker.ps1

$maxAttempts = 60   # 60 * 10 sec = 10 min max
$attempt = 0

Write-Host "Docker Desktop ready hone ka wait kar rahe hain... (har 10 sec check)" -ForegroundColor Cyan
Write-Host ""

do {
    $attempt++
    Write-Host "[$attempt] Checking Docker... " -NoNewline
    
    try {
        $result = & docker ps 2>&1
        $ok = ($LASTEXITCODE -eq 0)
    } catch {
        $ok = $false
    }
    
    if ($ok) {
        Write-Host "OK - Docker ab working hai." -ForegroundColor Green
        Write-Host ""
        Write-Host "Ab ye chala sakte ho:" -ForegroundColor Green
        Write-Host "  cd e:\TVF_DX; docker-compose -f docker-compose.dev.yml up -d" -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "abhi ready nahi, 10 sec baad phir check." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
} while ($attempt -lt $maxAttempts)

Write-Host ""
Write-Host "Timeout: 10 min ke baad bhi Docker ready nahi hua. Docker Desktop ko tray se check karo." -ForegroundColor Red
exit 1
