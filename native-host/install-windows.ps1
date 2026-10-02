# Registriert den Native-Messaging-Host fuer YouTube Summary Chat unter Windows
# und richtet die deutsche Standardroute (parakeet primeline) ein.
#
# UNGETESTET: Zur Entwicklungszeit stand kein Windows-Rechner zur Verfuegung.
# Das Skript folgt Chromes dokumentiertem Verfahren (Registry-Schluessel unter
# HKCU zeigt auf die Manifest-Datei), ist aber nicht ausgefuehrt worden.
#
# Was das Skript anlegt:
#   %LOCALAPPDATA%\yt-summary-chat\venv\   eigenes Python mit sherpa-onnx und
#                           numpy, damit der Host nicht davon abhaengt, welches
#                           python Chrome findet. Neben dem Modell, nicht im
#                           Projektordner, damit es nicht in git oder einen Sync geraet.
#   %LOCALAPPDATA%\yt-summary-chat\parakeet-primeline-de\   die vier Modelldateien
#                           (rund 670 MB). Beide Orte kommen aus primeline_ordner()
#                           im Host.
#   run-host.bat            Batch-Huelle, die Chrome startet; zeigt auf das venv.
#
# Die Route Parakeet MLX laeuft nur auf Apple Silicon. Unter Windows bleiben
# primeline (lokal) und die beiden OpenRouter-Routen.
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

# --- Python fuer das venv ------------------------------------------------------
# Der Host braucht 3.10 oder neuer. "py" ist der Windows-Launcher, der bei einer
# Installation von python.org immer dabei ist; python/python3 als Rueckfall.
$Python = $null
foreach ($c in @("python", "python3", "py")) {
  $cmd = Get-Command $c -ErrorAction SilentlyContinue
  if (-not $cmd) { continue }
  & $cmd.Source -c "import sys; sys.exit(sys.version_info < (3, 10))"
  if ($LASTEXITCODE -eq 0) { $Python = $cmd.Source; break }
}
if (-not $Python) {
  Write-Error "Python 3.10+ wurde nicht gefunden. Installation: winget install Python.Python.3.12"
}

# Ordner und Repo kommen aus dem Host, damit Installer und Laufzeit nie auseinanderlaufen.
# UTF-8 erzwingen: sonst kommt ein Umlaut im Benutzernamen in der Codepage statt als UTF-8 an.
$env:PYTHONUTF8 = "1"
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
$ModellInfo = & $Python -c "import sys; sys.path.insert(0, sys.argv[1]); from yt_summary_host import MODELL_PRIMELINE, primeline_ordner; print(MODELL_PRIMELINE); print(primeline_ordner())" $Here
$ModellRepo = $ModellInfo[0]
$ModellDir  = $ModellInfo[1]
$Basis      = Split-Path -Parent $ModellDir
$Venv       = Join-Path $Basis "venv"
$VenvPy     = Join-Path $Venv "Scripts\python.exe"

# $ErrorActionPreference greift nicht fuer native Programme, deshalb der Exitcode.
if (-not (Test-Path $VenvPy)) {
  Write-Host "lege venv an: $Venv"
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Venv) | Out-Null
  & $Python -m venv $Venv
  if ($LASTEXITCODE -ne 0) { throw "python -m venv ist fehlgeschlagen (Exitcode $LASTEXITCODE)." }
}
Write-Host "installiere sherpa-onnx und numpy ..."
& $VenvPy -m pip install --quiet --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "pip-Aktualisierung fehlgeschlagen (Exitcode $LASTEXITCODE)." }
& $VenvPy -m pip install --quiet sherpa-onnx numpy
if ($LASTEXITCODE -ne 0) { throw "pip install sherpa-onnx numpy fehlgeschlagen (Exitcode $LASTEXITCODE)." }

# --- Modelldateien --------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $ModellDir | Out-Null

# Invoke-WebRequest ist mit Fortschrittsanzeige um ein Vielfaches langsamer; bei
# 650 MB macht das den Unterschied zwischen Minuten und einer Viertelstunde.
$ProgressPreference = "SilentlyContinue"

function Lade-Datei($name) {
  $url  = "https://huggingface.co/$ModellRepo/resolve/main/$name"
  $ziel = Join-Path $ModellDir $name
  # Sollgroesse per HEAD: eine vorhandene Datei gilt nur dann als fertig, wenn sie
  # byte-genau so gross ist - ein abgebrochener Lauf darf nicht als Erfolg durchgehen.
  $kopf = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing
  $soll = [int64]"$($kopf.Headers['Content-Length'])"
  if ($soll -le 0) { throw "Groesse von $name nicht abfragbar ($url)." }
  if (Test-Path $ziel) {
    $ist = (Get-Item $ziel).Length
    if ($ist -eq $soll) { Write-Host "vorhanden: $ziel ($ist Bytes)"; return }
    Write-Host "unvollstaendig: $ziel ($ist statt $soll Bytes), lade neu"
  }
  Write-Host "lade $name ($soll Bytes) ..."
  # Erst in eine .part-Datei, erst nach bestandener Groessenpruefung umbenennen.
  $versuch = 0
  while ($true) {
    $versuch++
    try {
      Invoke-WebRequest -Uri $url -OutFile "$ziel.part" -UseBasicParsing
      break
    } catch {
      if ($versuch -ge 3) { throw }
      Write-Host "  Versuch $versuch fehlgeschlagen, erneut ..."
    }
  }
  $ist = (Get-Item "$ziel.part").Length
  if ($ist -ne $soll) { throw "$name hat $ist statt $soll Bytes." }
  Move-Item -Force "$ziel.part" $ziel
}

foreach ($f in @("encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt")) {
  Lade-Datei $f
}

# --- Huelle und Manifest --------------------------------------------------------
# Chrome startet unter Windows kein .py direkt, deshalb eine Batch-Huelle. Sie fixiert
# den Basisordner, weil Chrome den Host mit eigener Umgebung startet. OEM-Kodierung,
# weil cmd.exe Batch-Dateien in der OEM-Codepage liest - ASCII zerstoert Umlaute in Pfaden.
$Wrapper = Join-Path $Here "run-host.bat"
"@echo off`r`nset `"YT_SUMMARY_BASIS=$Basis`"`r`n`"$VenvPy`" `"$HostPy`" %*" | Set-Content -Encoding OEM $Wrapper

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
Write-Host "Python:       $VenvPy"
Write-Host "Modell:       $ModellDir"
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
