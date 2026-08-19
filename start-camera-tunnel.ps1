[CmdletBinding()]
param(
    [string]$LocalOrigin = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolsDirectory = Join-Path $projectRoot ".tools\cloudflared"
$cloudflaredPath = Join-Path $toolsDirectory "cloudflared.exe"
$downloadPath = Join-Path $toolsDirectory "cloudflared.download"
$frontendDirectory = Join-Path $projectRoot "frontend"
$tunnelUrlPath = Join-Path $frontendDirectory ".camera-tunnel-url"
$standardOutputPath = Join-Path $toolsDirectory "tunnel.stdout.log"
$standardErrorPath = Join-Path $toolsDirectory "tunnel.stderr.log"
$downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

New-Item -ItemType Directory -Path $toolsDirectory -Force | Out-Null

if (-not (Test-Path -LiteralPath $cloudflaredPath)) {
    Write-Host "[Tunnel] Dang tai cloudflared chinh thuc tu Cloudflare..." -ForegroundColor Cyan

    Invoke-WebRequest -Uri $downloadUrl -OutFile $downloadPath
    Move-Item -LiteralPath $downloadPath -Destination $cloudflaredPath -Force
}

$restartDelaySeconds = 3
$startupTimeoutSeconds = 90
$cloudflaredProcess = $null

try {
    while ($true) {
        if (Test-Path -LiteralPath $tunnelUrlPath) {
            Remove-Item -LiteralPath $tunnelUrlPath -Force
        }

        Set-Content -LiteralPath $standardOutputPath -Value "" -Encoding utf8
        Set-Content -LiteralPath $standardErrorPath -Value "" -Encoding utf8

        Write-Host "[Tunnel] Dang tao HTTPS cho $LocalOrigin ..." -ForegroundColor Cyan

        $cloudflaredProcess = Start-Process `
            -FilePath $cloudflaredPath `
            -ArgumentList @(
                "tunnel",
                "--no-autoupdate",
                "--protocol",
                "http2",
                "--edge-ip-version",
                "4",
                "--url",
                $LocalOrigin
            ) `
            -RedirectStandardOutput $standardOutputPath `
            -RedirectStandardError $standardErrorPath `
            -WindowStyle Hidden `
            -PassThru

        $publishedTunnelUrl = $null
        $printedLineCount = 0
        $startedAt = Get-Date
        $restartReason = $null

        while (-not $cloudflaredProcess.HasExited) {
            $logLines = @()

            if (Test-Path -LiteralPath $standardErrorPath) {
                $logLines = @(Get-Content -LiteralPath $standardErrorPath)
            }

            if ($logLines.Count -gt $printedLineCount) {
                $logLines[$printedLineCount..($logLines.Count - 1)] |
                    ForEach-Object { Write-Host $_ }
                $printedLineCount = $logLines.Count
            }

            $logText = $logLines -join "`n"

            if (-not $publishedTunnelUrl) {
                $urlMatch = [regex]::Match(
                    $logText,
                    "https://[a-z0-9-]+\.trycloudflare\.com"
                )

                if ($urlMatch.Success) {
                    $publishedTunnelUrl = $urlMatch.Value
                    Set-Content `
                        -LiteralPath $tunnelUrlPath `
                        -Value $publishedTunnelUrl `
                        -Encoding utf8

                    Write-Host ""
                    Write-Host "============================================" -ForegroundColor Green
                    Write-Host " HTTPS CAMERA DA SAN SANG" -ForegroundColor Green
                    Write-Host " $publishedTunnelUrl" -ForegroundColor Yellow
                    Write-Host " Hay tao lai ma QR tren trang cham bai." -ForegroundColor Green
                    Write-Host "============================================" -ForegroundColor Green
                    Write-Host ""
                }
            }

            if ($logText -match "Unauthorized: Tunnel not found") {
                $restartReason = "Cloudflare da thu hoi Quick Tunnel"
                break
            }

            if (
                -not $publishedTunnelUrl -and
                ((Get-Date) - $startedAt).TotalSeconds -ge $startupTimeoutSeconds
            ) {
                $restartReason = "Qua thoi gian tao URL HTTPS"
                break
            }

            Start-Sleep -Milliseconds 500
        }

        if (-not $restartReason) {
            $restartReason = if ($cloudflaredProcess.HasExited) {
                "cloudflared da dung voi ma loi $($cloudflaredProcess.ExitCode)"
            } else {
                "Can tao lai Quick Tunnel"
            }
        }

        if (-not $cloudflaredProcess.HasExited) {
            Stop-Process -Id $cloudflaredProcess.Id -Force
            $cloudflaredProcess.WaitForExit()
        }

        if (Test-Path -LiteralPath $tunnelUrlPath) {
            Remove-Item -LiteralPath $tunnelUrlPath -Force
        }

        Write-Host "[Tunnel] $restartReason. Thu lai sau $restartDelaySeconds giay..." -ForegroundColor Yellow
        Start-Sleep -Seconds $restartDelaySeconds
    }
} finally {
    if ($cloudflaredProcess -and -not $cloudflaredProcess.HasExited) {
        Stop-Process -Id $cloudflaredProcess.Id -Force
    }

    if (Test-Path -LiteralPath $tunnelUrlPath) {
        Remove-Item -LiteralPath $tunnelUrlPath -Force
    }
}
