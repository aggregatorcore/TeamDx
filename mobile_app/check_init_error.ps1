# Check Initialization Error - Mobile App
Write-Host "=== Checking Initialization Errors ===" -ForegroundColor Cyan
Write-Host ""

# Check if adb is available
$adbPaths = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools\adb.exe"
)

$adbFound = $null
foreach ($adbPath in $adbPaths) {
    if (Test-Path $adbPath) {
        $adbFound = $adbPath
        break
    }
}

if (-not $adbFound) {
    try {
        $adbCmd = Get-Command adb -ErrorAction SilentlyContinue
        if ($adbCmd) {
            $adbFound = "adb"
        }
    } catch {
        # Continue
    }
}

if (-not $adbFound) {
    Write-Host "❌ ADB not found" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Using ADB: $adbFound" -ForegroundColor Green
Write-Host ""
Write-Host "=== Checking for Initialization Errors ===" -ForegroundColor Cyan
Write-Host "  Looking for:" -ForegroundColor Yellow
Write-Host "    - Initialization Failed" -ForegroundColor Red
Write-Host "    - Phone permissions not granted" -ForegroundColor Red
Write-Host "    - Native call state listener timeout" -ForegroundColor Red
Write-Host "    - Error starting call state listener" -ForegroundColor Red
Write-Host "    - Permission request timeout" -ForegroundColor Red
Write-Host ""
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Clear and start filtered logcat
try {
    if ($adbFound -eq "adb") {
        adb logcat -c 2>&1 | Out-Null
        adb logcat | Select-String -Pattern "Initialization Failed|Phone permissions|call state listener|Permission|Error starting|MOBILE APP.*Error|Exception" | Where-Object { $_ -notmatch "miwallpaper|thememanager|FG_LOG|PackageManager" }
    } else {
        & $adbFound logcat -c 2>&1 | Out-Null
        & $adbFound logcat | Select-String -Pattern "Initialization Failed|Phone permissions|call state listener|Permission|Error starting|MOBILE APP.*Error|Exception" | Where-Object { $_ -notmatch "miwallpaper|thememanager|FG_LOG|PackageManager" }
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

