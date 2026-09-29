#!/usr/bin/env bash
# Beweist, dass der geteilte Kern plattformneutral bleibt.
#
# Warum das eine eigene Prüfung braucht: `shared/` wird von der Erweiterung UND von der
# Android-App gebündelt. Schlüpft dort Extension-Code hinein, fällt das im Browser nicht
# auf – die App stürzt ab, und `verify-store-bundle.sh` wird stillschweigend unwahr,
# weil `__FALLBACK__` in vorgebündelten Abhängigkeiten nicht ersetzt wird.
#
# Kommentare zählen nicht: sie dürfen die verbotenen Namen nennen, um zu erklären, warum
# sie verboten sind. Geprüft wird Code, deshalb fallen Kommentarzeilen vorher raus.

set -uo pipefail
cd "$(dirname "$0")/.."

FAIL=0
QUELLEN=$(find src -name '*.ts' -o -name '*.tsx')

# Kommentarzeilen (// … und Blockkommentar-Zeilen) entfernen, Rest prüfen.
ohne_kommentare() {
  # `://` bleibt stehen: sonst verschwände mit jedem Kommentar auch jede URL im Code,
  # und Test 2 sähe keinen einzigen Host.
  sed -E 's:(^|[^:])//.*:\1:' "$1" | grep -vE '^\s*(\*|/\*)'
}

echo "== 1. Kein Browser- und kein Extension-Code im geteilten Kern =="
VERBOTEN='chrome\.|document\.|window\.|from ["'"'"']wxt|__FALLBACK__'
for f in $QUELLEN; do
  HIT=$(ohne_kommentare "$f" | grep -nE "$VERBOTEN" || true)
  if [ -n "$HIT" ]; then
    echo "  FEHLGESCHLAGEN – $f:"
    echo "$HIT" | cut -c1-140
    FAIL=1
  fi
done
[ "$FAIL" -eq 0 ] && echo "  ok – keiner von: $VERBOTEN"

echo
echo "== 2. Genau zwei Gegenstellen (§1) =="
# Kein weiterer Endpunkt, auch nicht als optionaler Zweig. Positivliste statt Verbotsliste:
# vier verbotene Namen liessen jeden fünften Host durch (Codex, 21.09.2026, nachgestellt
# mit https://evil.example). github.com ist kein Endpunkt, sondern der Referer-Wert für
# OpenRouter; localhost ist der Origin der App.
ERLAUBT='^https?://(openrouter\.ai|api\.mistral\.ai|api\.eu\.mistral\.ai|www\.youtube\.com|youtu\.be|github\.com|localhost)$'
HITS=""
for f in $QUELLEN; do
  H=$(ohne_kommentare "$f" | grep -oE 'https?://[A-Za-z0-9.-]+' | grep -vE "$ERLAUBT" | sort -u | tr '\n' ' ')
  [ -n "$H" ] && HITS="$HITS  $f: $H"$'\n'
done
if [ -n "$HITS" ]; then
  echo "  FEHLGESCHLAGEN – Host ausserhalb der Positivliste im geteilten Kern:"
  printf '%s' "$HITS" | cut -c1-140
  FAIL=1
else
  echo "  ok – nur Hosts der Positivliste"
fi

# Gegenprobe: ohne sie würde Test 2 auch bestehen, wenn gar keine Clients mehr da wären.
for MUSS in "openrouter\.ai" "api\.eu\.mistral\.ai"; do
  if grep -rqE "$MUSS" src; then
    echo "  ok – $MUSS ist vorhanden (Test 2 greift also überhaupt)"
  else
    echo "  FEHLGESCHLAGEN – $MUSS fehlt im geteilten Kern; Test 2 prüft nichts."
    FAIL=1
  fi
done

echo
echo "== 3. Die Anbieter-Verzweigung steht an genau einer Stelle (§1) =="
# `settings.provider` darf nur in chat.ts abgefragt werden; ein zweiter Ort wäre der
# Anfang einer Provider-Abstraktion.
# Gezählt wird im Code, nicht in der ganzen Datei: `grep -l` fand auch einen Kommentar
# und hätte eine auskommentierte Verzweigung als "vorhanden" durchgehen lassen (DeepSeek,
# 18.09.2026, nachgestellt und bestätigt). Gezählt werden ausserdem Vorkommen, nicht
# Dateien – zwei Verzweigungen in derselben Datei sind auch zwei Stellen.
TREFFER=0
ORTE=""
for f in $QUELLEN; do
  N=$(ohne_kommentare "$f" | grep -cE 'provider === "mistral"')
  [ "$N" -gt 0 ] && { TREFFER=$((TREFFER + N)); ORTE="$ORTE $f($N)"; }
done
if [ "$TREFFER" -eq 1 ] && [ "${ORTE# }" = "src/lib/chat.ts(1)" ]; then
  echo "  ok – genau einmal, in src/lib/chat.ts"
else
  echo "  FEHLGESCHLAGEN – erwartet genau einmal in src/lib/chat.ts, gezählt: ${ORTE:-nichts}"
  FAIL=1
fi

echo
[ "$FAIL" -eq 0 ] && echo "ERGEBNIS: bestanden" || echo "ERGEBNIS: FEHLGESCHLAGEN"
exit "$FAIL"
