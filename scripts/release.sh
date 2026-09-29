#!/usr/bin/env bash
# Baut das aktuelle Release für Tester nach releases/ (nur lokal, in .gitignore):
#   chrome-youtube-summary-chat-<version>-full.zip   Erweiterung mit Download-Weg
#   chrome-youtube-summary-chat-<version>-store.zip  Erweiterung wie im Web Store
#   youtube-summary-chat-app-<versionName>-debug.apk Android-App (Debug-Signatur)
# Ältere Stände in releases/ werden ersetzt – dort liegt immer nur das neueste.
# Vor dem Packen laufen dieselben Beweise wie vor jedem Commit (CLAUDE.md, Prüfungen).
set -euo pipefail
cd "$(dirname "$0")/.."
wurzel="$PWD"

version=$(node -p "require('./extension/package.json').version")
app_version=$(sed -n 's/.*versionName "\(.*\)".*/\1/p' app/android/app/build.gradle)

echo "== Erweiterung $version bauen und prüfen =="
pnpm -r run compile
pnpm -r run check
(cd extension && pnpm run build && pnpm run build:store && ./scripts/verify-store-bundle.sh)

echo "== App $app_version bauen =="
pnpm --filter @ytsc/app run build
(cd app && pnpm exec cap sync android)
# Gradle verlangt JDK 21 (docs/uebergabe-android-2026-09-18.md).
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME_21:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
(cd app/android && ./gradlew assembleDebug --no-daemon -q -Dorg.gradle.java.installations.paths="$JAVA_HOME")
apk="app/android/app/build/outputs/apk/debug/app-debug.apk"
(cd app && bash scripts/verify-app-bundle.sh --apk "$wurzel/$apk")

echo "== Packen =="
rm -rf releases && mkdir releases
# store: Inhalt ohne Oberordner – entpacken, Ordner in chrome://extensions laden.
# full: Erweiterung, Helfer und Anleitung – ohne den Helfer gehen keine Downloads, und
# die Optionsseite verweist auf eine README, die Tester sonst nicht haben.
paket="$(mktemp -d)/chrome-youtube-summary-chat-$version-full"
mkdir -p "$paket/native-host"
cp -R build-full "$paket/erweiterung"
cp native-host/yt_summary_host.py native-host/install-macos.sh native-host/install-windows.ps1 \
   native-host/manifest.template.json native-host/selfcheck.py "$paket/native-host/"
cat > "$paket/LIESMICH.txt" <<EOF
YouTube Summary Chat $version (full)

1. Diesen Ordner an einen festen Platz legen, danach nicht mehr verschieben:
   der Helfer wird mit seinem Pfad in Chrome registriert.
2. Chrome: chrome://extensions, Entwicklermodus ein, "Entpackte Erweiterung laden",
   den Ordner "erweiterung" wählen.
3. Nur für Downloads (Video, Audio) und Transkript aus der Tonspur – der Helfer:
   macOS:
     brew install yt-dlp ffmpeg python   (Python ab 3.10)
     cd native-host && ./install-macos.sh
   Windows (ungetestet):
     winget install yt-dlp.yt-dlp
     winget install ffmpeg
     powershell -ExecutionPolicy Bypass -File .\\native-host\\install-windows.ps1
   Der Installer richtet auch Python-Umgebung und Sprachmodell ein (rund 670 MB).
   Danach Chrome einmal ganz beenden und neu starten.
4. Den API-Schlüssel (OpenRouter oder Mistral) auf der Optionsseite eintragen.
EOF
(cd "$paket/.." && zip -qr -X "$wurzel/releases/chrome-youtube-summary-chat-$version-full.zip" "$(basename "$paket")")
(cd build-store && zip -qr -X "$wurzel/releases/chrome-youtube-summary-chat-$version-store.zip" .)
cp "$apk" "releases/youtube-summary-chat-app-$app_version-debug.apk"
ls -l releases
