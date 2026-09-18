# Android-App – Spike

Stand: **Messgerät, kein Produkt.** Diese App beantwortet die Fragen, die über die
Architektur der richtigen App entscheiden und in der Cloud nicht beantwortbar waren.
Erst wenn die Antworten da sind, wird die eigentliche Oberfläche gebaut.

Warum überhaupt ein Zwischenschritt: der gemessene Transkript-Weg (signierte
Untertitel-URL aus der visionOS-Player-Antwort) funktioniert im Browser auf youtube.com
und in `yt-dlp` aus einem reinen HTTP-Client – aus einer Chrome-Extension-Seite kam
dagegen HTML statt JSON. Eine Android-App liegt dazwischen. Steht diese Antwort, steht
die App; steht sie nicht, ändert sich der Aufbau grundlegend.

## Bauen am Mac

Voraussetzungen: Node 22+, pnpm 10, JDK 21, Android Studio (mindestens Narwhal 3 Feature
Drop, wegen AGP 8.13), ein Android-Gerät mit USB-Debugging.

```bash
pnpm install                                   # an der Wurzel des Repos
pnpm --filter @ytsc/app run build              # Web-Bundle nach app/dist
cd app && bash scripts/verify-app-bundle.sh    # Stufe 1: was nicht drin sein darf
pnpm exec cap sync android
cd android && ./gradlew assembleDebug
cd .. && bash scripts/verify-app-bundle.sh --apk android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Mitlesen statt aufs Display starren – die App spiegelt jede Zeile nach logcat:

```bash
adb logcat -c && adb logcat -s Capacitor/Console:* Capacitor:* AndroidRuntime:E chromium:E
```

## Die Messungen

Schlüssel einmal eintragen und „Eingaben merken" – sie bleiben über `@capacitor/preferences`
auf dem Gerät, gehen an niemanden sonst.

| Knopf | Frage | Woran man das Ergebnis erkennt |
|---|---|---|
| **A** Transkript | Liefert der Player-Call aus `CapacitorHttp` JSON? | Spurenzahl > 0, URL trägt `signature=`, Cues kommen an. `LOGIN_REQUIRED` oder „keine JSON-Antwort" heißt: der Weg trägt nicht. |
| **B1/B2** | Erlauben OpenRouter und Mistral CORS für `https://localhost`, und streamt `fetch` im WebView? | „streamt" plus Zahl der Deltas. „GEPUFFERT" oder ein CORS-Fehler bei `/models` ist der Befund. |
| **C** Player | Nimmt YouTube diesen Origin als Embedder? | `onReady` = ja. `onError 153` = fehlender Referer, `101/150` = Einbetten gesperrt. Dazu die Liste der Abspieltempi. |
| **C +30 s** | Springt `seekTo` genau, und was meldet `getCurrentTime` während Werbung? | Position vorher/nachher im Log. |
| **D** Teilen | Kommt ein Link aus der YouTube-App an – kalt und warm? | Zeile „D geteilt:" samt erkannter Video-ID. Nichts zu klicken: teilen genügt. |
| **E** Deep-Link | Beachtet die YouTube-App `t=`? | Öffnet das Video bei 1:30 oder bei 0:00. |
| **F** Speicher | Trägt der Dateiweg statt Preferences? | Schreibdauer für 100 kB, `mtime` und `size` aus `readdir`. |

Test kalt und warm für D, ohne die YouTube-App:

```bash
adb shell am start -a android.intent.action.SEND -t text/plain \
  --es android.intent.extra.TEXT "https://youtu.be/aqz-KE-bpKQ" \
  -n at.gasperl.ytsummary/.MainActivity
```

Vorgeschlagene Videos: `aqz-KE-bpKQ` (Big Buck Bunny, CC-BY, im Projekt schon gemessen),
`9CZBIaaiPRI` (hat Untertitel), dazu ein altersbeschränktes und eines mit gesperrtem
Einbetten – gerade die beiden letzten zeigen, wo die Grenzen liegen.

Ergebnisse gehören nach `docs/messungen.md`, mit Gerät, Android-Version und
WebView-Version:

```bash
adb shell dumpsys package com.google.android.webview | grep versionName
```

## Was hier bewusst fehlt

Kein Download, kein Native Messaging, kein yt-dlp – §2 gilt für die App ohne Ausnahme,
und `scripts/verify-app-bundle.sh` prüft das gegen die gebaute APK. Kein Tonmitschnitt:
die Permissions bleiben bei `INTERNET`, bis der Weg gebaut ist und §4 erfüllt (Start nur
auf Klick, System-Consent für die Aufnahme).
