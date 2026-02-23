# Watch Mobile App Logs in Real-Time
# Similar to web app console, shows all logs and errors
Write-Host "=== Mobile App Live Logs Watcher ===" -ForegroundColor Cyan
Write-Host ""

# Check if adb is available
$adbPaths = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools\adb.exe"
)

$adbFound = $null

# First try to find adb in PATH
try {
    $adbCmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($adbCmd) {
        $adbFound = "adb"
    }
} catch {
    # ADB not in PATH, try paths
}

# If not in PATH, try common locations
if (-not $adbFound) {
    foreach ($adbPath in $adbPaths) {
        if (Test-Path $adbPath) {
            $adbFound = $adbPath
            break
        }
    }
}

if (-not $adbFound) {
    Write-Host "❌ ADB not found" -ForegroundColor Red
    Write-Host "   Please install Android SDK or add ADB to PATH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Common locations:" -ForegroundColor Yellow
    Write-Host "   - $env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -ForegroundColor Gray
    Write-Host "   - C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools\adb.exe" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Using ADB: $adbFound" -ForegroundColor Green
Write-Host ""
Write-Host "=== Real-Time Log Monitoring ===" -ForegroundColor Cyan
Write-Host "  Watching for:" -ForegroundColor Yellow
Write-Host "    - [MOBILE APP] tags (our debug logs)" -ForegroundColor Gray
Write-Host "    - Errors (red)" -ForegroundColor Red
Write-Host "    - Warnings (yellow)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting log stream..." -ForegroundColor Green
Write-Host ""

# Clear previous logs and start streaming
try {
    if ($adbFound -eq "adb") {
        adb logcat -c 2>&1 | Out-Null
        adb logcat | Select-String -Pattern "MOBILE APP|flutter|Error|Exception|FATAL"
    } else {
        & $adbFound logcat -c 2>&1 | Out-Null
        & $adbFound logcat | Select-String -Pattern "MOBILE APP|flutter|Error|Exception|FATAL"
    }
} catch {
    Write-Host "❌ Error starting logcat: $_" -ForegroundColor Red
    exit 1
}
