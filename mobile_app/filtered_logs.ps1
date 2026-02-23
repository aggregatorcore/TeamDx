# Filtered Logs Watcher - Only Shows App-Related Logs
# Filters out system errors (MIUI, etc.)
Write-Host "=== Mobile App Filtered Logs ===" -ForegroundColor Cyan
Write-Host ""

# Check if adb is available
$adbPaths = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools\adb.exe"
)

$adbFound = $null

# Try to find adb
try {
    $adbCmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($adbCmd) {
        $adbFound = "adb"
    }
} catch {
    # Try paths
}

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
    exit 1
}

Write-Host "✅ Using ADB: $adbFound" -ForegroundColor Green
Write-Host ""
Write-Host "=== Filtered Log Monitoring ===" -ForegroundColor Cyan
Write-Host "  Showing only:" -ForegroundColor Yellow
Write-Host "    - [MOBILE APP] debug logs" -ForegroundColor Gray
Write-Host "    - Flutter errors" -ForegroundColor Gray
Write-Host "    - App errors" -ForegroundColor Gray
Write-Host ""
Write-Host "  Filtering out:" -ForegroundColor Yellow
Write-Host "    - System errors (MIUI, etc.)" -ForegroundColor Gray
Write-Host "    - Unrelated Android logs" -ForegroundColor Gray
Write-Host ""
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Clear and start filtered logcat
try {
    if ($adbFound -eq "adb") {
        adb logcat -c 2>&1 | Out-Null
        adb logcat | Select-String -Pattern "MOBILE APP|flutter|Error|Exception|FATAL|App resumed|reloading|DEBUG|Device registered|WebSocket" | Where-Object { 
            $_ -notmatch "miwallpaper|thememanager|FG_LOG|PackageManager|AppLovinSdk|chromium|Binder|AdvertisingIdClient|NumberFormatException" 
        }
    } else {
        & $adbFound logcat -c 2>&1 | Out-Null
        & $adbFound logcat | Select-String -Pattern "MOBILE APP|flutter|Error|Exception|FATAL|App resumed|reloading|DEBUG|Device registered|WebSocket" | Where-Object { 
            $_ -notmatch "miwallpaper|thememanager|FG_LOG|PackageManager|AppLovinSdk|chromium|Binder|AdvertisingIdClient|NumberFormatException" 
        }
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

