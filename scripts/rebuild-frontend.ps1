# Rebuild frontend container so code changes (e.g. Create Lead button) reflect
# Run from project root: .\scripts\rebuild-frontend.ps1

Set-Location $PSScriptRoot\..

Write-Host "Rebuilding frontend container (code changes will reflect)..." -ForegroundColor Cyan
docker-compose -f docker-compose.dev.yml up -d --build frontend

if ($LASTEXITCODE -eq 0) {
    Write-Host "Done. Open http://localhost:3000/leads or http://localhost:3000/dashboard/leads - Create Lead button should appear." -ForegroundColor Green
} else {
    Write-Host "Build failed. Check the output above." -ForegroundColor Red
}
