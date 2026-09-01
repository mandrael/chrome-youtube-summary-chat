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
# Das sind die Native-Messaging-API, der Host-Name und der STT-Endpunkt.
#
# "yt-dlp" und "ffmpeg" stehen bewusst NICHT hier: die Extension ruft sie nie selbst
# auf, das macht der Host. Im Bundle koennen sie nur als Wort in einem Hinweistext
# vorkommen - dort waere ein Treffer kein Befund, sondern ein blinder Alarm.
HARD='connectNative|sendNativeMessage|at\.gasperl\.youtube_summary_chat|audio/transcriptions'

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

# Gesucht ist die Implementierung, nicht der case-Label-String: der bleibt im
# Store-Build stehen und antwortet "In diesem Build nicht enthalten".
STT=$(grep -rInE 'STT_MODEL_IDS|function listSttModels|whisper-large-v3-turbo|parakeet-tdt' "$OUT" --include='*.js' 2>/dev/null | cut -c1-120 || true)
if [ -n "$STT" ]; then
  echo "  FEHLGESCHLAGEN – die STT-Modellliste des Fallbacks steht im Store-Bundle:"
  echo "$STT"
  FAIL=1
else
  echo "  ok – keine STT-Modellliste im Store-Bundle"
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
