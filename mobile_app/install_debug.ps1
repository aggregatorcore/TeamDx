# Install Debug APK on Connected Device
Write-Host "=== Installing Debug APK ===" -ForegroundColor Cyan
Write-Host ""

$apkPath = "build\app\outputs\flutter-apk\app-debug.apk"

if (-not (Test-Path $apkPath)) {
    Write-Host "❌ APK not found: $apkPath" -ForegroundColor Red
    Write-Host "   Please build the app first: flutter build apk --debug" -ForegroundColor Yellow
    exit 1
}

Write-Host "APK found: $apkPath" -ForegroundColor Green
Write-Host ""

# Try to find adb
$adbPaths = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools\adb.exe",
    "adb"  # Try PATH
)

$adbFound = $false
foreach ($adbPath in $adbPaths) {
    try {
        if ($adbPath -eq "adb") {
            $adbCmd = Get-Command adb -ErrorAction SilentlyContinue
            if ($adbCmd) {
                Write-Host "Using ADB from PATH..." -ForegroundColor Gray
                adb install -r $apkPath
                if ($LASTEXITCODE -eq 0) {
                    $adbFound = $true
                    break
                }
            }
        } elseif (Test-Path $adbPath) {
            Write-Host "Using ADB: $adbPath" -ForegroundColor Gray
            & $adbPath install -r $apkPath
            if ($LASTEXITCODE -eq 0) {
                $adbFound = $true
                break
            }
        }
    } catch {
        continue
    }
}

if (-not $adbFound) {
    Write-Host "❌ ADB not found. Trying flutter install..." -ForegroundColor Yellow
    Write-Host "   Note: Flutter install may look for release APK" -ForegroundColor Yellow
    
    # Get device ID
    $deviceInfo = flutter devices | Select-String -Pattern "•" | Select-String -Pattern "mobile" | Select-Object -First 1
    if ($deviceInfo -match "•\s+(\S+)") {
        $deviceId = $matches[1]
        Write-Host "   Using device: $deviceId" -ForegroundColor Gray
        flutter install -d $deviceId
    } else {
        flutter install
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "⚠️  Installation failed. Please:" -ForegroundColor Yellow
        Write-Host "   1. Uninstall app from device manually" -ForegroundColor Yellow
        Write-Host "   2. Run: .\force_update.ps1" -ForegroundColor Yellow
        exit 1
    }
}

if ($LASTEXITCODE -eq 0 -or $adbFound) {
    Write-Host ""
    Write-Host "✅ App installed successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Installation failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Cyan

