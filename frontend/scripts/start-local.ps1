$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$localUrl = "http://localhost:3000"

Set-Location -LiteralPath $projectRoot

function Test-LocalPreview {
    try {
        $response = Invoke-WebRequest -Uri $localUrl -Method Head -TimeoutSec 1 -UseBasicParsing
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    }
    catch {
        return $false
    }
}

if (Test-LocalPreview) {
    Write-Host "Portfolio preview is already running." -ForegroundColor Green
    Start-Process $localUrl
    exit 0
}

Write-Host "Starting the portfolio at $localUrl ..." -ForegroundColor Cyan
Write-Host "Keep this window open while you work. Press Ctrl+C to stop." -ForegroundColor DarkGray

$browserJob = Start-Job -ArgumentList $localUrl -ScriptBlock {
    param($url)

    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 1 -UseBasicParsing
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Start-Process $url
                return
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }
}

try {
    & npm.cmd run dev
}
finally {
    Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
    Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
}

