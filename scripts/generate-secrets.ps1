# Generate Secure Secrets for Production
# Usage: .\scripts\generate-secrets.ps1

Write-Host "=== Generating Secure Secrets ===" -ForegroundColor Cyan
Write-Host ""

# Generate JWT Secret (32 bytes = 64 hex characters)
$jwtSecret = -join ((48..57) + (65..70) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "JWT_SECRET:" -ForegroundColor Yellow
Write-Host $jwtSecret -ForegroundColor Green
Write-Host ""

# Generate Database Password (16 characters)
$dbPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | ForEach-Object {[char]$_})
Write-Host "DATABASE_PASSWORD:" -ForegroundColor Yellow
Write-Host $dbPassword -ForegroundColor Green
Write-Host ""

# Generate Session Secret (32 bytes)
$sessionSecret = -join ((48..57) + (65..70) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "SESSION_SECRET:" -ForegroundColor Yellow
Write-Host $sessionSecret -ForegroundColor Green
Write-Host ""

Write-Host "=== Copy these to your .env file ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "JWT_SECRET=`"$jwtSecret`"" -ForegroundColor White
Write-Host "DATABASE_PASSWORD=`"$dbPassword`"" -ForegroundColor White
Write-Host "SESSION_SECRET=`"$sessionSecret`"" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Keep these secrets secure and never commit them to git!" -ForegroundColor Red








