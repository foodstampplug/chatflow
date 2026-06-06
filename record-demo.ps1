# ChatFlow Demo Recorder

$OUT = "$env:USERPROFILE\Desktop\chatflow-demo.mp4"
$BASE = "http://localhost:3000"

Write-Host "`n[ChatFlow] Starting demo recording..." -ForegroundColor Cyan

# 1. Check server
try {
    Invoke-WebRequest "$BASE/api/status" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop | Out-Null
    Write-Host "[ChatFlow] Server is running." -ForegroundColor Green
} catch {
    Write-Host "[ChatFlow] Starting server..." -ForegroundColor Yellow
    Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "C:\Users\shane\chatflow" -NoNewWindow
    Start-Sleep -Seconds 7
}

# 2. Open browser to dashboard
Write-Host "[ChatFlow] Opening browser..." -ForegroundColor Cyan
$browserFound = $false
foreach ($b in @("msedge","chrome","firefox")) {
    $cmd = Get-Command $b -ErrorAction SilentlyContinue
    if ($cmd -ne $null) {
        Start-Process $b "--start-maximized $BASE"
        $browserFound = $true
        break
    }
}
if (-not $browserFound) { Start-Process $BASE }
Start-Sleep -Seconds 4

# 3. Connect Twitch
Write-Host "[ChatFlow] Connecting Twitch..." -ForegroundColor Magenta
foreach ($ch in @("xqc","hasanabi","summit1g","pokimane")) {
    try {
        Invoke-WebRequest "$BASE/api/twitch/connect" -Method POST -ContentType "application/json" -Body "{`"channel`":`"$ch`"}" -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop | Out-Null
        Write-Host "[ChatFlow] Connected: $ch" -ForegroundColor Green
        break
    } catch {
        Write-Host "[ChatFlow] $ch failed, trying next..." -ForegroundColor Yellow
    }
}

# 4. Start recording (55 seconds)
Write-Host "[ChatFlow] Recording screen for 55 seconds - keep browser visible!" -ForegroundColor Yellow
$ffArgs = "-f gdigrab -framerate 30 -i desktop -t 55 -vcodec libx264 -pix_fmt yuv420p -preset ultrafast -crf 20 `"$OUT`""
$ffProc = Start-Process -FilePath "ffmpeg" -ArgumentList $ffArgs -PassThru -NoNewWindow

# 5. Inject messages during recording
function Inject([string]$user, [string]$dname, [string]$msg) {
    $escaped = $msg -replace '"', '\"'
    $body = "{`"username`":`"$user`",`"displayName`":`"$dname`",`"message`":`"$escaped`"}"
    try { Invoke-WebRequest "$BASE/api/x/inject" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 3 | Out-Null } catch {}
}

Start-Sleep -Seconds 5
Inject "Banks" "Banks" "Market Bubble is LIVE - biggest show in finance"
Start-Sleep -Seconds 2
Inject "blknoiz06" "Ansem" "chat lets get this bread today"
Start-Sleep -Seconds 3
Inject "foodstampplug" "foodstampplug" "this chat aggregator goes crazy"
Start-Sleep -Seconds 4
Inject "traderdave" "TraderDave" "BTC breaking out right now"
Start-Sleep -Seconds 2
Inject "cryptomane" "CryptoMane" "who built this overlay? its fire"
Start-Sleep -Seconds 2
Inject "Banks" "Banks" "shoutout everyone watching from all platforms"

# Open overlay view at ~25s mark
Start-Sleep -Seconds 2
Write-Host "[ChatFlow] Opening overlay view..." -ForegroundColor Cyan
foreach ($b in @("msedge","chrome","firefox")) {
    $cmd = Get-Command $b -ErrorAction SilentlyContinue
    if ($cmd -ne $null) {
        Start-Process $b "--start-maximized $BASE/overlay"
        break
    }
}

Start-Sleep -Seconds 3
Inject "moonboi" "MoonBoi" "LFG best stream on the internet"
Start-Sleep -Seconds 2
Inject "whalealert" "WhaleAlert" "just aped in see you at the top"
Start-Sleep -Seconds 2
Inject "Banks" "Banks" "combining all chats so nobody misses a thing"
Start-Sleep -Seconds 2
Inject "blknoiz06" "Ansem" "Twitch Kick YouTube X - all one feed"
Start-Sleep -Seconds 2
Inject "viewer99" "Viewer99" "this overlay is clean as hell"

# 6. Wait for ffmpeg to finish
Write-Host "[ChatFlow] Waiting for recording to complete..." -ForegroundColor Cyan
$ffProc.WaitForExit()

Write-Host "`n[ChatFlow] Done! Video saved to:" -ForegroundColor Green
Write-Host "  $OUT" -ForegroundColor White
Write-Host "Upload to Loom or YouTube, then paste the link in the form." -ForegroundColor Cyan
