# Übergabe: Android-Spike → Mac

Stand 18.09.2026, Branch `claude/youtube-transcription-android-app-1ts44f`.
Diese Datei ist der Einstieg für die Sitzung am Mac. Sie sagt, was fertig ist, was
bewiesen ist, was offen ist – und was als Erstes zu tun ist.

---

## In einem Satz

Der plattformneutrale Kern ist aus der Erweiterung herausgelöst und wird von beiden
Zielen benutzt; die Android-App existiert als **Messgerät**, nicht als Produkt, weil
eine einzige unbewiesene Annahme über ihren Aufbau entscheidet.

## Die eine Frage, die alles trägt

Kommt der signierte Untertitel-Weg auf Android durch?

Gemessen ist: aus einer Seite auf `youtube.com` heraus funktioniert er, aus `yt-dlp`
(reiner HTTP-Client) funktioniert er, aus einer **Chrome-Extension-Seite** kam HTML statt
JSON (`docs/messungen.md`). Die App liegt dazwischen – sie ruft über `CapacitorHttp`
nativ, ohne Browser-Origin, mit allen Headern. Das spricht für „funktioniert", ist aber
nicht gemessen.

- **Trägt er** → die App wird gebaut wie geplant: Oberfläche aus `shared/`, Speicher als
  Dateien, Player als IFrame-Embed.
- **Trägt er nicht** (`LOGIN_REQUIRED`, HTML statt JSON) → Rückfall ist ein unsichtbarer
  WebView auf youtube.com-Origin, der denselben Aufruf von dort macht. Das ist ein
  anderer Aufbau, deshalb ist die Oberfläche bewusst noch nicht gebaut.

---

## Was fertig ist

**`shared/`** – plattformneutraler Kern, rund 2.700 Zeilen, ein pnpm-Workspace-Paket:
openrouter · mistral · chat · prompts · transcript · settings · timestamps · absaetze ·
korrektur · tracks · i18n · translate-cues · types.

Vier Nähte, keine Provider-Abstraktion (§1 bleibt gewahrt):

| Naht | Was sie trennt |
|---|---|
| `chat.ts` | Die Anbieter-Verzweigung, früher im Service Worker. Jetzt eine Stelle, beide Plattformen rufen sie. |
| `Http` in `transcript.ts` | Erweiterung: `fetch` mit Cookies. App: `CapacitorHttp` (nativ, kein CORS). |
| `settings.ts` | Vorgaben, Schlüsselnamen, Speicherregeln geteilt – die Ablage selbst bleibt plattformspezifisch. |
| `stream` in `translate-cues.ts` | Der Chat-Strom wird injiziert statt importiert; sonst kennte der Kern `chrome.runtime`. |

**`app/`** – Capacitor 8.5.2 + TypeScript, ein Bildschirm, sieben Messungen, kein
Framework. `android/`-Gerüst ist eingecheckt.

**Prüfungen**, neu dazugekommen:

- `shared/scripts/check.sh` – hält den Kern frei von `chrome.`/`document.`/`window.`/
  `wxt/`/`__FALLBACK__` (Kommentare zählen nicht), prüft §1 und dass
  `provider === "mistral"` an genau einer Stelle steht.
- `app/scripts/verify-app-bundle.sh` – §2 für die App, zweistufig: `app/dist` und die
  entpackte APK.
- `extension/scripts/ladeprobe.mjs` – die fünfte Prüfung aus CLAUDE.md, bisher
  Handarbeit. Lädt den Build in Chromium, leitet `www.youtube.com` auf einen lokalen
  Stub um, sammelt `pageerror`.

## Was bewiesen ist (und wo)

| Prüfung | Ergebnis | Wo gelaufen |
|---|---|---|
| `pnpm -r run compile` | grün | Cloud |
| `extension` selfcheck | 23/23 | Cloud + CI |
| `shared/scripts/check.sh` | bestanden | Cloud + CI |
| beide Extension-Builds + `verify-store-bundle.sh` | bestanden | Cloud |
| Ladeprobe `build-full` / `build-store` | bestanden, Sidebar mountet, 0 unerwartete Fehler | Cloud |
| `verify-app-bundle.sh` Stufe 1 | bestanden | Cloud + CI |
| `cap sync` + `gradlew assembleDebug` | **grün, 2:54** | GitHub Actions |
| `verify-app-bundle.sh` Stufe 2 (entpackte APK) | **bestanden** | GitHub Actions |

Nicht gelaufen: `native-host/selfcheck.py` – in der Cloud fehlt `run-host.sh`, weil dort
kein Installer lief. Am Mac läuft die Prüfung wie bisher.

## Was offen ist

Alles, was die App auf einem Gerät tut. Vollständige Liste der ungeprüften Punkte steht
in `docs/messungen.md` unter „Android-App".

---

## Erster Schritt am Mac

```bash
git fetch origin
git checkout claude/youtube-transcription-android-app-1ts44f
pnpm install                       # an der Wurzel, nicht in extension/
```

Dann entweder die fertige Debug-APK aus dem Actions-Lauf ziehen (schneller) oder selbst
bauen:

```bash
pnpm --filter @ytsc/app run build
cd app && pnpm exec cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Gradle verlangt ein JDK 21; das System-Java dieses Macs ist 18. Gemessen am 21.09.2026 –
so baut es lokal durch (41 s), Homebrew-JDK genügt:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
./gradlew assembleDebug --no-daemon -Dorg.gradle.java.installations.paths="$JAVA_HOME"
```

Mitlesen:

```bash
adb logcat -c && adb logcat -s Capacitor/Console:* Capacitor:* AndroidRuntime:E chromium:E
```

Ablauf der sieben Messungen: `app/README.md`. **A zuerst.**

## Ergebnisse festhalten

Diese Tabelle ausgefüllt nach `docs/messungen.md` übernehmen – mit Gerät, Android- und
WebView-Version (`adb shell dumpsys package com.google.android.webview | grep versionName`):

```
Gerät / Android / WebView: …

A Transkript      Spuren: …  signiert: …  Cues: …  oder Fehlertext: …
B1 OpenRouter     /models: HTTP …  Deltas: …  erstes nach … ms
B2 Mistral        /models: …  Deltas: …  erstes nach … ms
C Player          onReady: …  onError: …  Tempi: …  Position vor/nach seekTo: …
C Werbung         getCurrentTime während Pre-Roll: …
D Teilen          kalt: …  warm: …  aus der YouTube-App: …  erkannte ID: …
E Deep-Link       öffnet bei 1:30: …
F Speicher        100 kB in … ms, mtime/size sichtbar: …
G Edge-to-Edge    Statusleiste überdeckt Kopf: …
```

## Danach

1. Befunde in `docs/messungen.md` eintragen, „ungeprüft"-Liste entsprechend kürzen.
2. Je nach Ergebnis von A: weiterbauen oder auf den WebView-Rückfall umschwenken.
3. Erst dann die Oberfläche: `Markdown.tsx`, `TranscriptView.tsx`, `HistoryView.tsx` und
   die Chat-Logik aus `Sidebar.tsx` (Zeilen ~307–660) nach `shared/src/components`
   bzw. `shared/src/lib/use-chat.ts`. Dann bekommt `shared/` erstmals React als
   Abhängigkeit – dabei `resolve.dedupe: ["react", "react-dom"]` in beiden Vite-Configs
   setzen und `@source` in den Tailwind-Dateien auf `shared/src` erweitern, sonst fehlen
   die Klassen der geteilten Komponenten im Bundle.
4. Speicher der App: Einstellungen über `@capacitor/preferences`, Unterhaltungen und
   Übersetzungen als Dateien (`conv/<videoId>.json`). Grund: SharedPreferences schreibt
   seine XML bei jedem `apply()` vollständig neu, und der Verlauf wird bei jeder
   Nachricht gespeichert.
5. Version: Die App-Erstveröffentlichung ist der Funktionssprung 0.9.1 → **0.10.0**, an
   allen Stellen gleichzeitig (`extension/wxt.config.ts`, `extension/package.json`,
   `app/package.json`, `versionName`/`versionCode` in `app/android/app/build.gradle`).
   Der Umbau selbst war ohne Nutzerwirkung und hat deshalb keinen Sprung bekommen.

## Was die App bewusst nicht kann

- **Keine Anmeldung, kein Premium.** Google sperrt Sign-in in eingebetteten WebViews
  (403 `disallowed_useragent`), und der WebView hat einen eigenen Cookie-Topf. Im
  eingebetteten Player läuft Werbung. Wer das nicht will, springt per Deep-Link in die
  YouTube-App – deshalb ist Messung E kein Nebenschauplatz.
- **Kein Download, kein Native Messaging, kein yt-dlp** (§2, §4a). Für die App gibt es
  keinen `full`-Build.
- **Keine Spracherkennung aus dem laufenden Ton – noch nicht.** Die Web Speech API gibt
  es im Android-WebView nicht. Der spätere Weg wäre MediaProjection +
  AudioPlaybackCapture auf den eigenen WebView-Ton, dann OpenRouter-STT. Dabei gilt §4
  (nur auf Klick, System-Consent) und: der eingebettete Player gibt höchstens 2× Tempo
  her, der 8×-Trick der Erweiterung entfällt.
