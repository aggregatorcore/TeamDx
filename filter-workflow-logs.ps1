# Filter Workflow Logs Script
# Usage: .\filter-workflow-logs.ps1

Write-Host "Starting server with workflow logs filter..." -ForegroundColor Green
Write-Host "Only showing: [LEAD TAG], [WORKFLOW], [ACTION EXECUTOR] logs" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Gray

npm run server 2>&1 | ForEach-Object {
    $line = $_
    if ($line -match '\[LEAD TAG\]|\[WORKFLOW|\[ACTION EXECUTOR\]|\[CALLBACK\]|callbackAt|Triggered workflow|matching trigger nodes') {
        Write-Host $line
    }
}
