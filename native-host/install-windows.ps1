# Registriert den Native-Messaging-Host fuer YouTube Summary Chat unter Windows.
#
# UNGETESTET: Zur Entwicklungszeit stand kein Windows-Rechner zur Verfuegung.
# Das Skript folgt Chromes dokumentiertem Verfahren (Registry-Schluessel unter
# HKCU zeigt auf die Manifest-Datei), ist aber nicht ausgefuehrt worden.
#
# Ausserdem gilt: die lokale Route Parakeet MLX laeuft nur auf Apple Silicon.
# Unter Windows bleiben die beiden OpenRouter-Routen.
#
#   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
#   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -ExtensionId <id>

param(
  [string]$ExtensionId = "abblpkhijcggklokijkhfbkgeljmimpm"
)

$ErrorActionPreference = "Stop"

$Here     = Split-Path -Parent $MyInvocation.MyCommand.Path
$HostPy   = Join-Path $Here "yt_summary_host.py"
$HostName = "at.gasperl.youtube_summary_chat"

if (-not (Test-Path $HostPy)) {
  Write-Error "yt_summary_host.py fehlt in $Here"
}

$Python = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $Python) { $Python = (Get-Command python3 -ErrorAction SilentlyContinue) }
if (-not $Python) {
  Write-Error "Python 3 wurde nicht gefunden. Installation: winget install Python.Python.3.12"
}

# Chrome startet unter Windows kein .py direkt, deshalb eine Batch-Huelle.
$Wrapper = Join-Path $Here "run-host.bat"
"@echo off`r`n`"$($Python.Source)`" `"$HostPy`" %*" | Set-Content -Encoding ASCII $Wrapper

$ManifestPath = Join-Path $Here "$HostName.json"
(Get-Content (Join-Path $Here "manifest.template.json") -Raw) `
  -replace "__HOST_PATH__", ($Wrapper -replace '\\', '\\\\') `
  -replace "__EXTENSION_ID__", $ExtensionId |
  Set-Content -Encoding UTF8 $ManifestPath

$RegPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
New-Item -Path $RegPath -Force | Out-Null
Set-ItemProperty -Path $RegPath -Name "(Default)" -Value $ManifestPath

Write-Host "registriert: $RegPath -> $ManifestPath"
Write-Host "Extension-ID: $ExtensionId"
Write-Host ""
Write-Host "Werkzeuge:"
foreach ($t in @("yt-dlp", "ffmpeg")) {
  if (Get-Command $t -ErrorAction SilentlyContinue) {
    Write-Host "  vorhanden: $t"
  } else {
    Write-Host "  FEHLT:     $t"
  }
}
Write-Host ""
Write-Host "Fehlt etwas:"
Write-Host "  winget install yt-dlp.yt-dlp"
Write-Host "  winget install ffmpeg"
Write-Host ""
Write-Host "Chrome muss danach einmal neu gestartet werden."
