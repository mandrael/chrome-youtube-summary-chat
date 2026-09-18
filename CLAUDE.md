# chrome-youtube-summary-chat

Chrome-Extension (MV3): Chat-Sidebar auf YouTube-Videoseiten. Transkript-Chat,
Zusammenfassung, Kapitel, Übersetzung. Stack: WXT, React 19, TypeScript, Tailwind 4,
shadcn/ui, pnpm.

Dazu eine Android-App (Capacitor) in `app/`, die sich den Kern in `shared/` mit der
Erweiterung teilt – Stand: Spike, siehe §6.

Aktueller Stand, offene Punkte und Historie stehen in [status.md](status.md) – zuerst
lesen. Nutzerseitige Doku in [README.md](README.md). Wer die App am Mac weiterbaut,
fängt bei [docs/uebergabe-android-2026-09-18.md](docs/uebergabe-android-2026-09-18.md)
an.

---

## Absolute Regeln dieses Projekts

**1. Genau zwei Gegenstellen: OpenRouter (Standard) und Mistral AI direkt
(Datenschutzoption, EU).** Kein weiterer Endpunkt – kein Code, der `api.openai.com`,
`api.anthropic.com`, `generativelanguage.googleapis.com` oder `api.groq.com` direkt
aufruft, auch nicht als optionaler Zweig. Kein Fallback zwischen beiden: fällt der
gewählte Anbieter aus, sagt die UI das, statt still zum anderen zu wechseln. Keine
generische Provider-Abstraktion – ein Schalter (`settings.provider`), zwei Clients
(`lib/openrouter.ts`, `lib/mistral.ts`), der Service Worker verzweigt an genau einer
Stelle. Was nur OpenRouter kann (Web-Plugin, Reasoning-Regler, Preise, STT), fehlt bei
Mistral sichtbar, nicht heimlich. Groq ausschliesslich über OpenRouters
Provider-Routing.

**2. Der Store-Build enthält keinen Download-Code.** Nicht ausgeblendet, sondern nicht
vorhanden: Native Messaging, yt-dlp-Weg und Helfer-Routen fehlen im Bundle. Das gilt für
den Audio-Fallback ebenso wie für den Videodownload (§4a) – beide Wege laufen über
dieselbe `__FALLBACK__`-Konstante. Was im Arbeitsspeicher bleibt, ist erlaubt und
**muss** drin sein – die Spracherkennung aus dem laufenden Ton (`lib/audio-live.ts`) ist
im Store-Build der einzige Weg zu einem Transkript, wenn Untertitel fehlen. Jede
Änderung daran wird mit `extension/scripts/verify-store-bundle.sh` gegengeprüft, und
zwar gegen das gebaute Bundle, nicht gegen den Quelltext. Das Skript prüft beide
Richtungen – verbotener Code darf nicht drin sein, erwarteter Code muss – und macht eine
Gegenprobe gegen den `full`-Build; ohne sie könnte ein Test bestehen, der nichts misst.

**3. Kein stiller Fehlschlag beim Transkript.** Fehlen Untertitel, sagt die UI das. Kein
Platzhalter, kein Ersatztext, keine erfundene Ausgabe. Liefert eine Quelle keine
Zeitstempel, steht `hasTimestamps: false` und es werden keine Sprungmarken angeboten.

**4. Kein Download und keine Tonaufnahme ohne Klick.** Audio-Fallback und
Spracherkennung starten ausschliesslich auf eine ausdrückliche Nutzeraktion, nie
automatisch. Der Zustand des Players (Position, Tempo, Ton, Pause) wird danach in jedem
Fall wiederhergestellt, auch bei Abbruch und Fehler.

**4a. Der Videodownload ist rechtlich nicht risikofrei.** OLG Hamburg (21.11.2024,
5 U 54/23, rechtskräftig seit BGH-Beschluss Oktober 2025) wertet YouTubes Rolling
Cipher als wirksame technische Schutzmaßnahme nach § 95a UrhG. Der Knopf ist deshalb
nur im `full`-Build erreichbar (§2), lädt nur auf Klick (§4) und bekommt in der UI einen
Hinweis auf eigene, gemeinfreie und lizenzfreie Nutzung. Einordnung mit Quellen:
[docs/gutachten-agy-video-download-2026-09-03.md](docs/gutachten-agy-video-download-2026-09-03.md).

**5. Keine Telemetrie, kein Backend, kein Proxy.** Host-Permissions bleiben bei
`youtube.com`, `openrouter.ai`, `api.eu.mistral.ai` und `api.mistral.ai`. In der App
bleiben die Android-Permissions bei `INTERNET`; keine Analytics-Abhängigkeit im Gradle
(kein Firebase, kein Crashlytics).

**6. Zwei Ziele, ein Kern.** Chrome-Erweiterung und Android-App teilen sich `shared/`
(pnpm-Workspace). Dort steht kein `chrome.`, kein `document.`, kein `window.`, nichts aus
`wxt/` und kein `__FALLBACK__` – geprüft von `shared/scripts/check.sh`, Kommentare
ausgenommen. Grund: `__FALLBACK__` wird in vorgebündelten Abhängigkeiten nicht ersetzt,
und der Store-Beweis wäre still unwahr. Die Anbieter-Verzweigung aus §1 steht in
`shared/src/lib/chat.ts` und **nur dort**; beide Plattformen rufen sie auf, statt sie zu
kopieren. Für die App gilt §2 verschärft: es gibt keinen `full`-Build – kein Native
Messaging, kein yt-dlp, kein Videodownload. Bewiesen wird das mit
`app/scripts/verify-app-bundle.sh`, Stufe 1 gegen `app/dist`, Stufe 2 gegen die
entpackte APK (nur die zeigt, dass Capacitors Kopierschritt nichts hinzufügt).

---

## Gemessene Befunde

Alle Messwerte, die nicht erneut geraten werden dürfen – Untertitel-Weg, STT-Modelle,
Preiseinheiten, Schrift, Tastatur, Vivaldi, Presets – stehen in
[docs/messungen.md](docs/messungen.md). **Vor jeder Änderung an Transkript, Schrift oder
Seitenleiste dort nachlesen**, sonst wird eine bereits widerlegte Hypothese neu geprüft.

## Gescheiterte und verworfene Ansätze

- **Plasmo** als Bundler: letzte npm-Veröffentlichung `0.90.5` vom 17.05.2025, über 15
  Monate alt, Selbstbeschreibung weiterhin Alpha. Ersetzt durch WXT (Vite/Rollup), wo die
  Dead-Code-Elimination für den Store-Build verlässlich greift.
- **Route Parakeet ONNX (Intel-Mac)**: `achetronic/parakeet` liefert nur Linux-Binaries.
  Verworfen, nicht aufgeschoben.
- **Route DiktaGo**: nicht ansprechbar, kein URL-Scheme, kein STT-CLI. Befund liegt als
  Rückmeldung im DiktaGo-Projekt.
- **`ytInitialPlayerResponse` aus dem globalen Objekt lesen**: bei SPA-Navigation nicht
  zuverlässig auf dem Stand der sichtbaren Video-ID. Stattdessen ein frischer
  same-origin-Abruf der Watch-Seite mit explizitem `?v=`.
- **Eine Kopie des echten Chrome-Profils**, um angemeldet zu testen: die Sitzungsdatei auf
  Platte ist nur so aktuell wie das letzte saubere Beenden von Chrome (im Test neun Tage
  alt), und ihre Entschlüsselung braucht einen Schlüsselbund-Eintrag, den ein Chrome mit
  fremdem `--user-data-dir` nicht bekommt. Ergebnis: `angemeldet: false`. Nicht noch
  einmal versuchen – der Weg führt über einen Debug-Port am laufenden Chrome.
- **Der Cookie-Banner als Ursache** des leeren Panels: selbst vermutet, selbst widerlegt.
  Ein frisches Profil ohne jeden Banner-Klick zeigte denselben Fehler.
- **Die fehlende Anmeldung als Ursache**: ebenfalls selbst vermutet, am 01.09.2026 in
  einer angemeldeten Sitzung widerlegt. Nicht erneut prüfen.
- **Der Proof-of-Origin-Token als Ursache**: vermutet und widerlegt – `yt-dlp` holt die
  Untertitel mit `PO Token Providers: none`.
- **Chromes Seitenleiste als zweite Oberfläche**: gebaut, gemessen, zurückgebaut. Vivaldi
  trägt jede Extension mit der Permission `sidePanel` ungefragt in seine Panel-Leiste ein
  (Bug VB-123452, in 8.1 offen) – nicht abschaltbar, ausser die Permission fehlt. Dazu kam
  der Doppel-Mount bei `uiPlacement: "both"`. Nicht erneut versuchen, solange der Bug offen
  ist.
- **yt-dlp als Untertitel-Route**: war die Notlösung, solange die Ursache unklar war. Der
  Browser-Weg funktioniert; yt-dlp ist wieder das, was es sein sollte – der Weg zur
  Tonspur.

---

## Aufbau

```
build-full/           gebaute Erweiterung zum Laden (GitHub-Build)
shared/               plattformneutraler Kern für Erweiterung und App
  src/lib/            openrouter · mistral · chat · prompts · transcript · settings · i18n …
app/                  Android-App (Capacitor + TypeScript), android/ eingecheckt
  src/                main.ts (Spike-Messungen) · http-capacitor.ts
  scripts/            verify-app-bundle.sh
icon-source/          Icon-Quelle (Python/PIL) und die gerenderten Grössen
build-store/          gebaute Erweiterung ohne Fallback
extension/            WXT-Projekt (Quelltext, das Manifest entsteht erst beim Bauen)
  entrypoints/        content.tsx · background.ts · options/
  components/         Sidebar, Markdown, TranscriptView, HistoryView, ui/
  lib/                openrouter · mistral · transcript · audio-live · fallback · korrektur · prompts …
  scripts/            selfcheck.ts · verify-store-bundle.sh · ladeprobe.mjs
native-host/          Python-Host für den Audio-Fallback (nur full)
```

Der Fallback liegt vollständig in `lib/fallback.ts` und wird nur aus
`if (__FALLBACK__)`-Zweigen erreicht – so greift die Elimination am Modul, nicht bloss an
der Bedingung.

## Prüfungen

```bash
pnpm -r run compile && pnpm -r run check          # Wurzel: extension, shared, app
cd extension && pnpm run build && pnpm run build:store && ./scripts/verify-store-bundle.sh
cd native-host && python3 selfcheck.py
```

Alle vier laufen, bevor etwas als fertig gemeldet wird. Was nicht geprüft werden konnte,
steht im README-Abschnitt „Was nicht geprüft ist“ und wird dort gepflegt, nicht
weggelassen.

**Fünftens, nach jeder Build-Änderung: die Erweiterung einmal headless laden** und
Konsole samt `pageerror` einsammeln. Das macht `extension/scripts/ladeprobe.mjs` (braucht
Playwright, bewusst keine Projekt-Abhängigkeit: `pnpm dlx playwright@1.56.1`). Am
05.09.2026 bestanden alle vier Prüfungen, während das Content-Script beim ersten Render
warf – ein Bundle-Grep ersetzt keinen Ladeversuch.

**Sechstens, für die App: nichts davon ist in der Cloud prüfbar.** Android-SDK
(`dl.google.com`) und `youtube.com` sind in der Entwicklungsumgebung gesperrt. Gebaut und
gemessen wird am Mac; bis eine Messung mit Gerät und Android-Version in
[docs/messungen.md](docs/messungen.md) steht, gilt jede Aussage über App-Verhalten als
ungeprüft und gehört in den README-Abschnitt „Was nicht geprüft ist".

**Version vor jedem Commit mit Nutzerwirkung erhöhen**, Schema `major.function.fix`
(status.md, 03.09.2026), an zwei Stellen: `extension/wxt.config.ts` (Manifest) und
`extension/package.json`. Die Optionsseite zeigt die Nummer mit dem Build dahinter –
ohne Erhöhung ist beim Testen nicht erkennbar, was im Browser steckt. Am 04.09.2026
wurde das über drei Commits vergessen. **Ein Commit ist genau ein Sprung**, nie einer
pro enthaltener Funktion: 0.6.0 → 0.7.0, auch wenn drei Funktionen drinstecken. Am
05.09.2026 sprang ein Commit fälschlich von 0.6.0 auf 0.8.0. **„function“ heisst neue
Fähigkeit** – ein zweiter Anbieter, ein Downloadweg, ein Modellmenü. Prompts ändern,
Kacheln umbenennen, hinzufügen oder streichen, Texte, Layout: das ist **„fix“**. Am
06.09.2026 wurde das Streichen dreier Kacheln fälschlich als 0.9.0 gezählt.

## Sprache

Doku, UI-Texte und Kommentare auf Deutsch mit echten Umlauten. Technische Begriffe im
Original.

**Auch im Native-Host gilt das für jeden Text, den der Nutzer zu sehen bekommt** – die
Meldungen aus `progress()` und `HostError` landen in der Sidebar. Sie sind sicher, weil
`json.dumps` sie standardmässig nach `\uXXXX` escapet und die Nachricht als reines ASCII
über Native Messaging geht; keine Konsolen-Kodierung kann daran etwas verderben. Ohne
Umlaute bleiben nur die Ausgaben, die der Host selbst auf ein Terminal schreibt
(`selfcheck.py`, Logzeilen) – dort ist die Zeichensatz-Einstellung tatsächlich ungewiss.
