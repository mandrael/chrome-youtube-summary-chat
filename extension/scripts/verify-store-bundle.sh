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
echo "== 2d. Videodownload (§4a): kein Weg zum Helfer im Store-Bundle =="
# Gesucht sind die Funktionen der Bruecke und der Port-Handler im Service Worker, nicht
# die i18n-Texte des Dialogs – die sind Text, kein Code (siehe 2b).
DOWNLOAD='videoFormate|videoLaden|kind: "download"|kind: "formats"|function handleDownloadPort|function startDownload'
DHITS=$(grep -rInE "$DOWNLOAD" "$OUT" --include='*.js' 2>/dev/null || true)
if [ -n "$DHITS" ]; then
  echo "  FEHLGESCHLAGEN – Download-Code im Store-Bundle:"
  echo "$DHITS" | cut -c1-160
  FAIL=1
else
  echo "  ok – keiner von: $DOWNLOAD"
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
  if grep -rqE "videoLaden" "$FULL" --include='*.js' && grep -rqE "function startDownload" "$FULL" --include='*.js'; then
    echo "  ok – full-Build enthält den Videodownload (Test 2d greift also überhaupt)"
  else
    echo "  FEHLGESCHLAGEN – auch der full-Build enthält keinen Download-Code; Test 2d prüft nichts."
    FAIL=1
  fi
else
  echo "  übersprungen ($FULL fehlt)"
fi

echo
echo "== 4. React als Produktionsfassung (beide Builds) =="
# Beide Richtungen: der Produktionsmarker muss da sein UND der Entwicklungsmarker
# fehlen – sonst bestünde der Test auch, wenn beide Fassungen gebündelt wären. Exakter
# Dateiname, weil devlop/lib/development.js legitim im Bundle steht.
for B in "$OUT" "$FULL"; do
  [ -d "$B" ] || continue
  CS="$B/content-scripts/content.js"
  if grep -qF "react-dom-client.production.js" "$CS" && ! grep -qF "react-dom-client.development.js" "$CS"; then
    echo "  ok – $B: react-dom-client.production.js drin, development-Fassung fehlt"
  else
    echo "  FEHLGESCHLAGEN – $B bündelt React nicht (nur) als Produktionsfassung."
    echo "  Ursache meist: WXT setzt NODE_ENV auf den Modusnamen; siehe Hook in wxt.config.ts."
    FAIL=1
  fi
  # Die JSX-Übersetzung muss zur React-Fassung passen. Am 05.09.2026 war React Produktion,
  # das JSX aber noch über jsx-dev-runtime übersetzt: „jsxDEV is not a function" beim
  # ersten Render, keine Sidebar. Der Dateiname jsx-dev-runtime steht nur im kaputten
  # Bundle (gemessen: 2 gegen 0 Treffer); das Wort jsxDEV allein reicht nicht, es kommt
  # in hast-util-to-jsx-runtime legitim vor.
  if grep -qF "jsx-dev-runtime" "$CS"; then
    echo "  FEHLGESCHLAGEN – $B übersetzt JSX über jsx-dev-runtime (Vite sieht keine Produktion)."
    echo "  Ursache meist: NODE_ENV=production fehlt vor dem wxt-Aufruf in package.json."
    FAIL=1
  else
    echo "  ok – $B: kein react/jsx-dev-runtime im Bundle"
  fi
done

echo
[ "$FAIL" -eq 0 ] && echo "ERGEBNIS: bestanden" || echo "ERGEBNIS: FEHLGESCHLAGEN"
exit "$FAIL"
