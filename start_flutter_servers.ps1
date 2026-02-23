# Start Both Servers for Flutter App
# This script starts the backend server and Flutter app

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Servers for Flutter App" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCheck) {
    Write-Host "[OK] Node.js found" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if Flutter is installed
$flutterCheck = Get-Command flutter -ErrorAction SilentlyContinue
if ($flutterCheck) {
    Write-Host "[OK] Flutter found" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Flutter is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Flutter first" -ForegroundColor Yellow
    exit 1
}

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
    npm install
}

# Check if Flutter dependencies are installed
if (-not (Test-Path "mobile_app/pubspec.lock")) {
    Write-Host "Installing Flutter dependencies..." -ForegroundColor Yellow
    Push-Location mobile_app
    flutter pub get
    Pop-Location
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "[WARNING] .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating default .env file..." -ForegroundColor Yellow
    $lines = @(
        'DATABASE_URL="file:./dev.db"',
        'JWT_SECRET="immigration-office-secret-key-2024"',
        'JWT_EXPIRES_IN="7d"',
        'PORT=5000',
        'NEXT_PUBLIC_API_URL="http://localhost:5000"'
    )
    $lines | Out-File -FilePath ".env" -Encoding utf8
    Write-Host "[OK] .env file created" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting servers..." -ForegroundColor Green
Write-Host ""
Write-Host "Backend Server will run on: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Flutter App will run on: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C in each window to stop the servers" -ForegroundColor Yellow
Write-Host ""

# Start backend server in a new window
Write-Host "Starting Backend Server..." -ForegroundColor Yellow
$backendCmd = "cd '$PWD'; Write-Host 'Backend Server (Port 5000)' -ForegroundColor Cyan; Write-Host '================================' -ForegroundColor Cyan; npm run server"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start Flutter app in a new window
Write-Host "Starting Flutter App..." -ForegroundColor Yellow
$flutterPath = Join-Path $PWD "mobile_app"
$flutterCmd = "cd '$flutterPath'; Write-Host 'Flutter App (Port 8080)' -ForegroundColor Cyan; Write-Host '================================' -ForegroundColor Cyan; flutter run -d web-server --web-port=8080"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $flutterCmd

Write-Host ""
Write-Host "[OK] Both servers started in separate windows" -ForegroundColor Green
Write-Host ""
Write-Host "Backend API: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Flutter App: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now access the Flutter app in your browser!" -ForegroundColor Green
