#!/usr/bin/env bash
# Registriert den Native-Messaging-Host fuer YouTube Summary Chat unter macOS.
#
# Aufruf ohne Argument nutzt die feste Extension-ID des GitHub-Builds. Die ist
# fest, weil das full-Manifest einen oeffentlichen Schluessel mitbringt - ohne
# den wuerde Chrome die ID aus dem Installationspfad ableiten und jedes
# Verschieben des Ordners wuerde die Registrierung ungueltig machen.
#
# Eine abweichende ID (etwa nach einem eigenen Build ohne den Schluessel) kann
# als erstes Argument uebergeben werden.

set -euo pipefail

DEFAULT_ID="abblpkhijcggklokijkhfbkgeljmimpm"
EXT_ID="${1:-$DEFAULT_ID}"

HERE="$(cd "$(dirname "$0")" && pwd)"
HOST_PY="$HERE/yt_summary_host.py"
HOST_NAME="at.gasperl.youtube_summary_chat"

if [ ! -f "$HOST_PY" ]; then
  echo "FEHLER: $HOST_PY fehlt." >&2
  exit 1
fi
chmod +x "$HOST_PY"

# Chrome startet den Host ohne Login-Shell. Ein Wrapper setzt deshalb einen PATH,
# in dem Homebrew und uv-Werkzeuge zu finden sind - sonst scheitert der Host mit
# "yt-dlp wurde nicht gefunden", obwohl es installiert ist.
WRAPPER="$HERE/run-host.sh"
cat > "$WRAPPER" <<WRAP
#!/usr/bin/env bash
export PATH="/opt/homebrew/bin:/usr/local/bin:\$HOME/.local/bin:\$PATH"
exec /usr/bin/env python3 "$HOST_PY"
WRAP
chmod +x "$WRAPPER"

TARGETS=(
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  "$HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
  "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
)

WROTE=0
for DIR in "${TARGETS[@]}"; do
  PARENT="$(dirname "$DIR")"
  # Nur dort registrieren, wo der Browser auch installiert ist.
  [ -d "$PARENT" ] || continue
  mkdir -p "$DIR"
  sed -e "s#__HOST_PATH__#$WRAPPER#" -e "s#__EXTENSION_ID__#$EXT_ID#" \
    "$HERE/manifest.template.json" > "$DIR/$HOST_NAME.json"
  echo "registriert: $DIR/$HOST_NAME.json"
  WROTE=1
done

if [ "$WROTE" -eq 0 ]; then
  echo "FEHLER: Kein Chrome-Profilverzeichnis gefunden." >&2
  exit 1
fi

echo
echo "Extension-ID: $EXT_ID"
echo
echo "Werkzeuge:"
for T in yt-dlp ffmpeg parakeet-mlx; do
  if PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH" command -v "$T" >/dev/null; then
    echo "  vorhanden: $T"
  else
    echo "  FEHLT:     $T"
  fi
done
echo
echo "Fehlt etwas:"
echo "  brew install yt-dlp ffmpeg"
echo "  uv tool install parakeet-mlx -U"
echo
echo "Chrome muss danach einmal neu gestartet werden."
