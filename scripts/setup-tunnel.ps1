# Setup Tunnel for Development
# Supports ngrok, cloudflared, and localtunnel
# Usage: .\scripts\setup-tunnel.ps1 [ngrok|cloudflared|localtunnel] [frontend|backend]

param(
    [Parameter(Position=0)]
    [ValidateSet('ngrok', 'cloudflared', 'localtunnel')]
    [string]$Tool = 'ngrok',
    
    [Parameter(Position=1)]
    [ValidateSet('frontend', 'backend')]
    [string]$Service = 'frontend'
)

$frontendPort = 3000
$backendPort = 5000
$port = if ($Service -eq 'frontend') { $frontendPort } else { $backendPort }

Write-Host "=== Setting up $Tool tunnel for $Service (port $port) ===" -ForegroundColor Cyan
Write-Host ""

# Check if service is running
Write-Host "Checking if service is running on port $port..." -ForegroundColor Yellow
try {
    $connection = Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
    if (-not $connection) {
        Write-Host "⚠️  No service detected on port $port" -ForegroundColor Red
        Write-Host "Please start the $Service server first:" -ForegroundColor Yellow
        if ($Service -eq 'frontend') {
            Write-Host "  npm run dev" -ForegroundColor White
        } else {
            Write-Host "  npm run server" -ForegroundColor White
        }
        exit 1
    }
    Write-Host "✅ Service is running on port $port" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not verify service on port $port" -ForegroundColor Yellow
    Write-Host "Continuing anyway..." -ForegroundColor Yellow
}

Write-Host ""

switch ($Tool) {
    'ngrok' {
        Write-Host "Starting ngrok tunnel..." -ForegroundColor Yellow
        
        # Check if ngrok is installed
        try {
            $ngrokVersion = ngrok version 2>&1
            Write-Host "✅ ngrok is installed" -ForegroundColor Green
        } catch {
            Write-Host "❌ ngrok is not installed" -ForegroundColor Red
            Write-Host "Install from: https://ngrok.com/download" -ForegroundColor Yellow
            Write-Host "Or using Chocolatey: choco install ngrok" -ForegroundColor Yellow
            exit 1
        }
        
        # Check if authtoken is configured
        $ngrokConfig = "$env:USERPROFILE\.ngrok2\ngrok.yml"
        if (-not (Test-Path $ngrokConfig)) {
            Write-Host "⚠️  ngrok authtoken not configured" -ForegroundColor Yellow
            Write-Host "Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Yellow
            Write-Host "Then run: ngrok config add-authtoken YOUR_TOKEN" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Starting without authtoken (limited functionality)..." -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "Tunnel URL will be displayed below. Copy it and update your .env file:" -ForegroundColor Cyan
        Write-Host "  NEXT_PUBLIC_API_URL=`"https://your-tunnel-url.ngrok.io`"" -ForegroundColor White
        Write-Host "  FRONTEND_URL=`"https://your-tunnel-url.ngrok.io`"" -ForegroundColor White
        Write-Host "  ALLOWED_ORIGINS=`"http://localhost:3000,https://your-tunnel-url.ngrok.io`"" -ForegroundColor White
        Write-Host ""
        Write-Host "Starting ngrok..." -ForegroundColor Green
        Write-Host ""
        
        ngrok http $port
    }
    
    'cloudflared' {
        Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Yellow
        
        # Check if cloudflared is installed
        try {
            $cloudflaredVersion = cloudflared --version 2>&1
            Write-Host "✅ cloudflared is installed" -ForegroundColor Green
        } catch {
            Write-Host "❌ cloudflared is not installed" -ForegroundColor Red
            Write-Host "Install from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" -ForegroundColor Yellow
            exit 1
        }
        
        Write-Host ""
        Write-Host "Tunnel URL will be displayed below. Copy it and update your .env file:" -ForegroundColor Cyan
        Write-Host "  NEXT_PUBLIC_API_URL=`"https://your-tunnel-url.trycloudflare.com`"" -ForegroundColor White
        Write-Host "  FRONTEND_URL=`"https://your-tunnel-url.trycloudflare.com`"" -ForegroundColor White
        Write-Host "  ALLOWED_ORIGINS=`"http://localhost:3000,https://your-tunnel-url.trycloudflare.com`"" -ForegroundColor White
        Write-Host ""
        Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Green
        Write-Host ""
        
        cloudflared tunnel --url http://localhost:$port
    }
    
    'localtunnel' {
        Write-Host "Starting localtunnel..." -ForegroundColor Yellow
        
        # Check if localtunnel is installed
        try {
            $ltVersion = lt --version 2>&1
            Write-Host "✅ localtunnel is installed" -ForegroundColor Green
        } catch {
            Write-Host "❌ localtunnel is not installed" -ForegroundColor Red
            Write-Host "Installing localtunnel..." -ForegroundColor Yellow
            npm install -g localtunnel
        }
        
        Write-Host ""
        Write-Host "Tunnel URL will be displayed below. Copy it and update your .env file:" -ForegroundColor Cyan
        Write-Host "  NEXT_PUBLIC_API_URL=`"https://your-subdomain.loca.lt`"" -ForegroundColor White
        Write-Host "  FRONTEND_URL=`"https://your-subdomain.loca.lt`"" -ForegroundColor White
        Write-Host "  ALLOWED_ORIGINS=`"http://localhost:3000,https://your-subdomain.loca.lt`"" -ForegroundColor White
        Write-Host ""
        Write-Host "Starting localtunnel..." -ForegroundColor Green
        Write-Host ""
        
        $subdomain = if ($Service -eq 'frontend') { 'tvf-frontend' } else { 'tvf-backend' }
        lt --port $port --subdomain $subdomain
    }
}








