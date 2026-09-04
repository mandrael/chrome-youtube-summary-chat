#!/usr/bin/env bash
# Registriert den Native-Messaging-Host fuer YouTube Summary Chat unter macOS und
# Linux und richtet die deutsche Standardroute (parakeet primeline) ein.
#
# Aufruf ohne Argument nutzt die feste Extension-ID des GitHub-Builds. Die ist
# fest, weil das full-Manifest einen oeffentlichen Schluessel mitbringt - ohne
# den wuerde Chrome die ID aus dem Installationspfad ableiten und jedes
# Verschieben des Ordners wuerde die Registrierung ungueltig machen.
#
# Eine abweichende ID (etwa nach einem eigenen Build ohne den Schluessel) kann
# als erstes Argument uebergeben werden.
#
# Was das Skript anlegt:
#   <Basis>/venv/           eigenes Python mit sherpa-onnx und numpy. Ein venv,
#                           weil Homebrew-Python (PEP 668) kein pip install ins
#                           System erlaubt und der Host so nicht davon abhaengt,
#                           welches python3 Chrome gerade findet. Es liegt neben
#                           dem Modell und nicht im Projekt, damit es weder in
#                           git noch in einen Dropbox-Sync geraet.
#   <Basis>/parakeet-primeline-de/  die vier Modelldateien (rund 670 MB).
#   Die Basis ist der Ort aus primeline_ordner() im Host - wird von dort gelesen,
#   nicht hier ein zweites Mal festgelegt (macOS: ~/Library/Application Support/
#   yt-summary-chat, Linux: $XDG_DATA_HOME/yt-summary-chat).
#   run-host.sh             Wrapper, den Chrome startet; zeigt auf das venv.

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

# Chrome startet den Host ohne Login-Shell; derselbe erweiterte PATH gilt deshalb
# hier bei der Suche und spaeter im Wrapper.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"

# --- Python fuer das venv ------------------------------------------------------
# Der Host braucht 3.10 oder neuer; das System-Python von macOS ist 3.9.
PYTHON=""
for C in python3 python3.13 python3.12 python3.11 python3.14; do
  if command -v "$C" >/dev/null && "$C" -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then
    PYTHON="$(command -v "$C")"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "FEHLER: Kein Python 3.10+ gefunden. Installation: brew install python (macOS) oder das Paket python3 der Distribution." >&2
  exit 1
fi

# Ordner und Repo kommen aus dem Host, damit Installer und Laufzeit nie auseinanderlaufen.
MODELL_INFO="$("$PYTHON" - "$HERE" <<'PY'
import sys
sys.path.insert(0, sys.argv[1])
from yt_summary_host import MODELL_PRIMELINE, primeline_ordner
print(MODELL_PRIMELINE)
print(primeline_ordner())
PY
)"
MODELL_REPO="$(echo "$MODELL_INFO" | sed -n 1p)"
MODELL_DIR="$(echo "$MODELL_INFO" | sed -n 2p)"
BASIS="$(dirname "$MODELL_DIR")"
VENV="$BASIS/venv"

if [ ! -x "$VENV/bin/python" ]; then
  echo "lege venv an: $VENV ($("$PYTHON" --version))"
  mkdir -p "$(dirname "$VENV")"
  "$PYTHON" -m venv "$VENV"
fi
echo "installiere sherpa-onnx und numpy ..."
if command -v uv >/dev/null; then
  # uv ist deutlich schneller als pip, aendert aber nichts am Ergebnis.
  uv pip install --quiet --python "$VENV/bin/python" sherpa-onnx numpy
else
  "$VENV/bin/python" -m pip install --quiet --upgrade pip
  "$VENV/bin/python" -m pip install --quiet sherpa-onnx numpy
fi

# --- Modelldateien --------------------------------------------------------------
mkdir -p "$MODELL_DIR"

dateigroesse() {
  # macOS/BSD-stat kennt -f, GNU-stat -c.
  stat -f %z "$1" 2>/dev/null || stat -c %s "$1"
}

lade_datei() {
  local name="$1" url ziel soll ist
  url="https://huggingface.co/$MODELL_REPO/resolve/main/$name"
  ziel="$MODELL_DIR/$name"
  # Sollgroesse per HEAD: eine vorhandene Datei gilt nur dann als fertig, wenn sie
  # byte-genau so gross ist - ein abgebrochener Lauf darf nicht als Erfolg durchgehen.
  soll="$(curl -sIL "$url" | tr -d '\r' | awk 'tolower($1) == "content-length:" {s = $2} END {print s}')"
  if [ -z "$soll" ]; then
    echo "FEHLER: Groesse von $name nicht abfragbar (Netz? $url)" >&2
    exit 1
  fi
  if [ -f "$ziel" ]; then
    ist="$(dateigroesse "$ziel")"
    if [ "$ist" = "$soll" ]; then
      echo "vorhanden: $ziel ($ist Bytes)"
      return
    fi
    echo "unvollstaendig: $ziel ($ist statt $soll Bytes), lade neu"
  fi
  echo "lade $name ($soll Bytes) ..."
  # Erst in eine .part-Datei, erst nach bestandener Groessenpruefung umbenennen.
  curl -fL --retry 3 -# -o "$ziel.part" "$url"
  ist="$(dateigroesse "$ziel.part")"
  if [ "$ist" != "$soll" ]; then
    echo "FEHLER: $name hat $ist statt $soll Bytes." >&2
    exit 1
  fi
  mv "$ziel.part" "$ziel"
}

for F in encoder.int8.onnx decoder.int8.onnx joiner.int8.onnx tokens.txt; do
  lade_datei "$F"
done

# --- Wrapper und Manifest -------------------------------------------------------
# Der Wrapper setzt den PATH fuer yt-dlp und ffmpeg, fixiert den Basisordner (Chrome
# startet den Host mit eigener Umgebung, HOME oder XDG_DATA_HOME koennen abweichen)
# und startet das venv-Python.
WRAPPER="$HERE/run-host.sh"
cat > "$WRAPPER" <<WRAP
#!/usr/bin/env bash
export PATH="/opt/homebrew/bin:/usr/local/bin:\$HOME/.local/bin:\$PATH"
export YT_SUMMARY_BASIS="$BASIS"
exec "$VENV/bin/python" "$HOST_PY"
WRAP
chmod +x "$WRAPPER"

TARGETS=(
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  "$HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
  "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
  "$HOME/Library/Application Support/Vivaldi/NativeMessagingHosts"
  "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
  "$HOME/.config/google-chrome/NativeMessagingHosts"
  "$HOME/.config/chromium/NativeMessagingHosts"
  "$HOME/.config/vivaldi/NativeMessagingHosts"
  "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  "$HOME/.config/microsoft-edge/NativeMessagingHosts"
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
echo "Python:       $VENV/bin/python"
echo "Modell:       $MODELL_DIR"
echo
echo "Werkzeuge:"
TOOLS=(yt-dlp ffmpeg)
[ "$(uname)" = "Darwin" ] && TOOLS+=(parakeet-mlx)
for T in "${TOOLS[@]}"; do
  if command -v "$T" >/dev/null; then
    echo "  vorhanden: $T"
  else
    echo "  FEHLT:     $T"
  fi
done
echo
echo "Fehlt etwas:"
if [ "$(uname)" = "Darwin" ]; then
  echo "  brew install yt-dlp ffmpeg"
  echo "  uv tool install parakeet-mlx -U    # nur fuer die Route Parakeet MLX"
else
  echo "  Paketverwaltung der Distribution oder: uv tool install yt-dlp; ffmpeg als Paket"
fi
echo
echo "Chrome muss danach einmal neu gestartet werden."
