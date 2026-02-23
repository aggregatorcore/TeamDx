# Flutter Installation Script for Windows
# Run this script as Administrator

Write-Host "🚀 Flutter Installation Script" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  This script requires Administrator privileges" -ForegroundColor Yellow
    Write-Host "Please run PowerShell as Administrator and try again" -ForegroundColor Yellow
    Write-Host "`nRight-click PowerShell → Run as Administrator" -ForegroundColor Cyan
    pause
    exit 1
}

# Flutter installation directory
$flutterPath = "C:\src\flutter"
$flutterZip = "$env:TEMP\flutter_windows.zip"
$flutterUrl = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.0-stable.zip"

Write-Host "`n📥 Step 1: Downloading Flutter SDK..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Gray

try {
    # Create C:\src directory if it doesn't exist
    if (-not (Test-Path "C:\src")) {
        New-Item -ItemType Directory -Path "C:\src" -Force | Out-Null
    }

    # Download Flutter
    Invoke-WebRequest -Uri $flutterUrl -OutFile $flutterZip -UseBasicParsing
    Write-Host "✅ Download complete!" -ForegroundColor Green
} catch {
    Write-Host "❌ Download failed: $_" -ForegroundColor Red
    Write-Host "`nTrying alternative method..." -ForegroundColor Yellow
    
    # Alternative: Use winget if available
    try {
        winget install --id=Google.Flutter -e
        Write-Host "✅ Flutter installed via winget!" -ForegroundColor Green
        $flutterPath = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Google.Flutter_*\flutter"
        if (Test-Path $flutterPath) {
            $flutterPath = (Get-ChildItem $flutterPath -Directory | Select-Object -First 1).FullName
        }
    } catch {
        Write-Host "❌ Installation failed. Please install manually:" -ForegroundColor Red
        Write-Host "1. Download from: https://docs.flutter.dev/get-started/install/windows" -ForegroundColor Yellow
        Write-Host "2. Extract to C:\src\flutter" -ForegroundColor Yellow
        Write-Host "3. Add C:\src\flutter\bin to PATH" -ForegroundColor Yellow
        exit 1
    }
}

# Extract if downloaded
if (Test-Path $flutterZip) {
    Write-Host "`n📦 Step 2: Extracting Flutter..." -ForegroundColor Yellow
    
    # Remove old installation if exists
    if (Test-Path $flutterPath) {
        Remove-Item -Path $flutterPath -Recurse -Force
    }
    
    # Extract
    Expand-Archive -Path $flutterZip -DestinationPath "C:\src" -Force
    Remove-Item $flutterZip -Force
    
    Write-Host "✅ Extraction complete!" -ForegroundColor Green
}

# Add to PATH
Write-Host "`n🔧 Step 3: Adding Flutter to PATH..." -ForegroundColor Yellow

$flutterBinPath = "$flutterPath\bin"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")

if ($currentPath -notlike "*$flutterBinPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$flutterBinPath", "Machine")
    Write-Host "✅ Added to PATH!" -ForegroundColor Green
    Write-Host "⚠️  Please restart your terminal/PowerShell for PATH changes to take effect" -ForegroundColor Yellow
} else {
    Write-Host "✅ Already in PATH!" -ForegroundColor Green
}

# Verify installation
Write-Host "`n✅ Step 4: Verifying installation..." -ForegroundColor Yellow

# Refresh PATH for current session
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

try {
    $flutterVersion = & "$flutterBinPath\flutter.bat" --version
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Flutter installed successfully!" -ForegroundColor Green
        Write-Host $flutterVersion
    } else {
        Write-Host "⚠️  Flutter installed but verification failed. Please restart terminal." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Please restart your terminal and run: flutter --version" -ForegroundColor Yellow
}

Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Restart your terminal/PowerShell" -ForegroundColor White
Write-Host "2. Run: flutter doctor" -ForegroundColor White
Write-Host "3. Install Android Studio (if needed)" -ForegroundColor White
Write-Host "4. Run: flutter doctor --android-licenses" -ForegroundColor White
Write-Host "5. Navigate to mobile_app and run: flutter pub get" -ForegroundColor White

Write-Host "`n✨ Installation complete!" -ForegroundColor Green

