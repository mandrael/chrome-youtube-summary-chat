#!/usr/bin/env bash
# Beweist, dass im Store-Build kein Fallback-Code steckt.
#
# Die Zusage "Tree-Shaking entfernt das schon" ist nichts wert, solange sie nicht
# nachgemessen ist: geprüft wird das gebaute Bundle, nicht der Quelltext.
#
# Deshalb baut wxt.config.ts ohne Minifier – ein Minifier würde die gesuchten
# Bezeichner umbenennen und den Test blind machen.

set -uo pipefail
cd "$(dirname "$0")/.."

OUT="../build-store"
FAIL=0

if [ ! -d "$OUT" ]; then
  echo "FEHLER: $OUT fehlt. Zuerst 'pnpm run build:store' ausführen." >&2
  exit 2
fi

echo "== 1. Manifest: nativeMessaging darf nicht auftauchen =="
if grep -q "nativeMessaging" "$OUT/manifest.json"; then
  echo "  FEHLGESCHLAGEN – Permission steht im Store-Manifest:"
  grep -n "nativeMessaging" "$OUT/manifest.json"
  FAIL=1
else
  echo "  ok"
fi
echo "  Permissions: $(python3 -c "import json,sys;print(json.load(open('$OUT/manifest.json')).get('permissions'))")"

echo
echo "== 2. Bundle: keine Fallback-Faehigkeit =="
# Harte Kriterien: die Bezeichner, ohne die der Fallback technisch unmoeglich ist.
# Das sind die Native-Messaging-API und der Host-Name.
#
# "yt-dlp" und "ffmpeg" stehen bewusst NICHT hier: die Extension ruft sie nie selbst
# auf, das macht der Host. Im Bundle koennen sie nur als Wort in einem Hinweistext
# vorkommen - dort waere ein Treffer kein Befund, sondern ein blinder Alarm.
#
# Der STT-Endpunkt stand bis 02.09.2026 hier und ist bewusst entfernt: die
# Spracherkennung aus dem laufenden Ton (lib/audio-live.ts) laedt nichts herunter und
# ist im Store erlaubt. Sie MUSS im Store-Bundle stehen, siehe Test 2c.
HARD='connectNative|sendNativeMessage|at\.gasperl\.youtube_summary_chat'

HITS=$(grep -rInE "$HARD" "$OUT" --include='*.js' --include='*.json' 2>/dev/null || true)
if [ -n "$HITS" ]; then
  echo "  FEHLGESCHLAGEN – Fallback-Faehigkeit im Store-Bundle:"
  echo "$HITS" | cut -c1-160
  FAIL=1
else
  echo "  ok – keiner von: $HARD"
fi

echo
echo "== 2b. Reste: Huellen duerfen bleiben, aber nur leer =="
# Rolldown leert die Funktionskoerper, behaelt aber gelegentlich Namen und
# UI-Texte. Ein Name ohne Koerper ist kein Code – ein Koerper waere einer.
if grep -qE 'function runFallbackJob\([^)]*\) *\{ *\}' "$OUT/content-scripts/content.js"; then
  echo "  ok – runFallbackJob ist eine leere Huelle"
elif grep -qE 'runFallbackJob' "$OUT/content-scripts/content.js"; then
  echo "  FEHLGESCHLAGEN – runFallbackJob hat einen Koerper:"
  grep -nE 'function runFallbackJob' "$OUT/content-scripts/content.js" | cut -c1-160
  FAIL=1
else
  echo "  ok – runFallbackJob kommt gar nicht vor"
fi

if grep -qE 'port\.name === "fallback" && false' "$OUT/background.js"; then
  echo "  ok – der Fallback-Port im Service Worker ist als tot markiert"
elif grep -qE 'handleFallbackPort' "$OUT/background.js"; then
  echo "  FEHLGESCHLAGEN – handleFallbackPort steht noch im Service Worker"
  FAIL=1
else
  echo "  ok – kein Fallback-Port im Service Worker"
fi

# Uebrig bleiben die i18n-Zeichenketten des Fallbacks. Das sind Texte, kein Code,
# und sie werden bewusst nicht gesondert behandelt.
LEFT=$(grep -coE 'startFallback|startSubtitles|subtitlesHint|audioHint|noCaptionsFull' "$OUT/content-scripts/content.js" || true)
echo "  Hinweis: $LEFT ungenutzte i18n-Zeichenketten des Fallbacks im Bundle (Text, kein Code)"

# Die Modellliste selbst ist erlaubt (der Live-Weg nutzt whisper-large-v3-turbo).
# Verboten bleibt die Auswahl der Host-Routen: sie gehoert zum lokalen Helfer.
# Gesucht ist die Implementierung, nicht der Vorgabewert: "parakeet-mlx" steht als
# Zeichenkette in DEFAULT_SETTINGS und ist dort ein Datenwert, kein Weg zum Helfer.
ROUTEN=$(grep -rInE 'function listSttModels|output_modalities=transcription' "$OUT" --include='*.js' 2>/dev/null | cut -c1-120 || true)
if [ -n "$ROUTEN" ]; then
  echo "  FEHLGESCHLAGEN – die Routenauswahl des lokalen Helfers steht im Store-Bundle:"
  echo "$ROUTEN"
  FAIL=1
else
  echo "  ok – keine Helfer-Routen im Store-Bundle"
fi

echo
echo "== 2c. Der erlaubte Weg MUSS drin sein =="
# Ein Test, der nur Verbotenes sucht, wuerde auch bestehen, wenn das Store-Bundle gar
# nichts mehr kann. Die Spracherkennung aus dem laufenden Ton ist dort der einzige Weg
# zu einem Transkript, wenn Untertitel fehlen.
if grep -rqE 'captureStream' "$OUT" --include='*.js'; then
  echo "  ok – die Spracherkennung aus dem laufenden Ton ist enthalten"
else
  echo "  FEHLGESCHLAGEN – captureStream fehlt: der Store-Build hat ohne Untertitel"
  echo "  keinen Weg mehr zu einem Transkript."
  FAIL=1
fi

echo
echo "== 3. Gegenprobe: im full-Build muss der Code vorhanden sein =="
FULL="../build-full"
if [ -d "$FULL" ]; then
  if grep -rqE "connectNative" "$FULL"; then
    echo "  ok – full-Build enthält connectNative (der Test greift also überhaupt)"
  else
    echo "  FEHLGESCHLAGEN – auch der full-Build enthält keinen Fallback-Code."
    echo "  Damit prüft Test 2 nichts. Erst 'pnpm run build' ausführen."
    FAIL=1
  fi
else
  echo "  übersprungen ($FULL fehlt)"
fi

echo
[ "$FAIL" -eq 0 ] && echo "ERGEBNIS: bestanden" || echo "ERGEBNIS: FEHLGESCHLAGEN"
exit "$FAIL"
