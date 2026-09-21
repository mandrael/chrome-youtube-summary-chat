#!/usr/bin/env bash
# Beweist, dass in der App kein Code steckt, den sie nicht haben darf.
#
# §2 gilt fuer die App verschaerft: es gibt keinen full-Build. Kein Native Messaging,
# kein yt-dlp, kein Videodownload - nicht ausgeblendet, sondern nicht vorhanden. Und
# §1 gilt hier genauso: genau zwei Gegenstellen.
#
# Zweistufig, weil beide Stufen verschiedene Fragen beantworten:
#   Stufe 1 (immer, ohne Android-SDK): das gebaute Web-Bundle in app/dist.
#   Stufe 2 (--apk <datei>): dieselben Muster in der entpackten APK. Erst das beweist,
#           dass der Kopierschritt von Capacitor nichts hinzufuegt.
#
# Aufruf:
#   bash scripts/verify-app-bundle.sh
#   bash scripts/verify-app-bundle.sh --apk android/app/build/outputs/apk/debug/app-debug.apk

set -uo pipefail
cd "$(dirname "$0")/.."

FAIL=0
APK=""
[ "${1:-}" = "--apk" ] && APK="${2:-}"

# "yt-dlp" und "ffmpeg" stehen bewusst NICHT in der Liste - aus demselben Grund wie in
# extension/scripts/verify-store-bundle.sh: die App ruft sie nie selbst auf, und im
# unminifizierten Bundle stehen sie als Wort in einem Kommentar (transcript.ts erklaert,
# woher der Player-Aufruf abgelesen ist). Ein Treffer waere ein blinder Alarm, kein
# Befund. Gesucht ist die Faehigkeit: die Native-Messaging-API und der Host-Name.
VERBOTEN='api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.groq\.com|connectNative|sendNativeMessage|at\.gasperl\.youtube_summary_chat'
# captureStream ist der Weg der Erweiterung (Tab-Ton + Web Speech). Im Android-WebView
# gibt es die Web Speech API nicht; der Ton-Weg der App laeuft spaeter ueber ein eigenes
# Plugin. Taucht captureStream hier auf, ist Extension-Code in die App gerutscht.
VERBOTEN="$VERBOTEN|captureStream"
MUSS='openrouter\.ai'
MUSS2='api\.eu\.mistral\.ai'

pruefe() {
  local name="$1" hits="$2" hat1="$3" hat2="$4"
  echo "== $name =="
  if [ -n "$hits" ]; then
    echo "  FEHLGESCHLAGEN - verbotener Code:"
    echo "$hits" | cut -c1-160
    FAIL=1
  else
    echo "  ok - keiner von: $VERBOTEN"
  fi
  # Gegenprobe: ohne sie bestuende der Test auch bei einem leeren Bundle.
  if [ "$hat1" = "ja" ] && [ "$hat2" = "ja" ]; then
    echo "  ok - beide erlaubten Gegenstellen vorhanden (der Test greift also)"
  else
    echo "  FEHLGESCHLAGEN - openrouter.ai: $hat1, api.eu.mistral.ai: $hat2"
    FAIL=1
  fi
}

# ---- Stufe 1: das gebaute Web-Bundle ----------------------------------------
if [ ! -d dist ]; then
  echo "FEHLER: app/dist fehlt. Zuerst 'pnpm run build' ausfuehren." >&2
  exit 2
fi
H=$(grep -rInE "$VERBOTEN" dist --include='*.js' --include='*.html' 2>/dev/null || true)
A=$(grep -rqE "$MUSS" dist --include='*.js' && echo ja || echo nein)
B=$(grep -rqE "$MUSS2" dist --include='*.js' && echo ja || echo nein)
pruefe "Stufe 1: app/dist" "$H" "$A" "$B"

echo
echo "== Stufe 1b: Manifest =="
M=android/app/src/main/AndroidManifest.xml
if [ -f "$M" ]; then
  # Der Ton-Weg ist noch nicht gebaut; bis dahin darf die App weder aufnehmen noch
  # den Bildschirm abgreifen duerfen (§4, §5).
  RECHTE=$(grep -oE 'android:name="android.permission.[A-Z_]+"' "$M" | sort -u)
  echo "  Permissions: $(echo "$RECHTE" | tr '\n' ' ')"
  # Ganze Zeile, nicht Teilstring: INTERNET_IRGENDWAS rutschte sonst durch.
  if echo "$RECHTE" | grep -qvxE 'android:name="android\.permission\.INTERNET"'; then
    echo "  FEHLGESCHLAGEN - mehr als INTERNET deklariert:"
    echo "$RECHTE" | grep -vxE 'android:name="android\.permission\.INTERNET"'
    FAIL=1
  else
    echo "  ok - nur INTERNET"
  fi
  if grep -q 'android.intent.action.SEND' "$M"; then
    echo "  ok - Teilen-Ziel deklariert"
  else
    echo "  FEHLGESCHLAGEN - kein Teilen-Ziel im Manifest"
    FAIL=1
  fi
else
  echo "  uebersprungen ($M fehlt)"
fi

# ---- Stufe 2: die gebaute APK ------------------------------------------------
if [ -n "$APK" ]; then
  echo
  if [ ! -f "$APK" ]; then
    echo "FEHLER: $APK fehlt." >&2
    exit 2
  fi
  TMP=$(mktemp -d)
  unzip -qo "$APK" 'assets/public/*' -d "$TMP"
  H=$(grep -rInE "$VERBOTEN" "$TMP/assets/public" 2>/dev/null || true)
  A=$(grep -rqE "$MUSS" "$TMP/assets/public" && echo ja || echo nein)
  B=$(grep -rqE "$MUSS2" "$TMP/assets/public" && echo ja || echo nein)
  pruefe "Stufe 2: $APK" "$H" "$A" "$B"
  rm -rf "$TMP"

  # Stufe 1b liest das Quellmanifest. Rechte, die eine Abhaengigkeit ueber den
  # Manifest-Merger einbringt, stehen nur in der APK (Codex, 21.09.2026). Das Manifest
  # dort ist binaer, lesbar nur mit aapt2 aus den Build-Tools.
  echo
  echo "== Stufe 2b: Permissions der fertigen APK =="
  SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  AAPT=$(ls "$SDK"/build-tools/*/aapt2 2>/dev/null | sort -V | tail -1)
  if [ -z "$AAPT" ]; then
    echo "  FEHLGESCHLAGEN - aapt2 nicht gefunden unter $SDK/build-tools; die Rechte der APK sind ungeprueft."
    FAIL=1
  else
    # Das eigene "…DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" legt androidx an; es ist
    # ein selbst definiertes Signaturrecht, kein Zugriff auf irgendetwas.
    APKRECHTE=$("$AAPT" dump permissions "$APK" | grep -oE "uses-permission: name='[^']+'" | sed -E "s/.*name='([^']+)'/\1/" | grep -v 'DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION$' | sort -u)
    echo "  Permissions: $(echo "$APKRECHTE" | tr '\n' ' ')"
    if [ "$APKRECHTE" = "android.permission.INTERNET" ]; then
      echo "  ok - nur INTERNET"
    else
      echo "  FEHLGESCHLAGEN - erwartet genau android.permission.INTERNET"
      FAIL=1
    fi
  fi
else
  echo
  echo "== Stufe 2: uebersprungen (kein --apk uebergeben) =="
  echo "  Ohne sie ist nur das Web-Bundle geprueft, nicht die ausgelieferte Datei."
  # Wo Stufe 2 laufen MUSS, sagt der Aufrufer das mit APK_PFLICHT=1. Sonst meldete ein
  # Lauf, dem --apk abhandenkommt, weiter Erfolg (DeepSeek, 18.09.2026).
  if [ -n "${APK_PFLICHT:-}" ]; then
    echo "  FEHLGESCHLAGEN – APK_PFLICHT gesetzt, aber kein --apk uebergeben."
    FAIL=1
  fi
  UNVOLLSTAENDIG=ja
fi

echo
if [ "$FAIL" -ne 0 ]; then
  echo "ERGEBNIS: FEHLGESCHLAGEN"
elif [ -n "${UNVOLLSTAENDIG:-}" ]; then
  echo "ERGEBNIS: Stufe 1 bestanden, Stufe 2 nicht gelaufen"
else
  echo "ERGEBNIS: bestanden"
fi
exit "$FAIL"
