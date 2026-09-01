# chrome-youtube-summary-chat

Chrome-Extension (MV3): Chat-Sidebar auf YouTube-Videoseiten. Transkript-Chat,
Zusammenfassung, Kapitel, Übersetzung. Stack: WXT, React 19, TypeScript, Tailwind 4,
shadcn/ui, pnpm.

Aktueller Stand, offene Punkte und Historie stehen in [status.md](status.md) – zuerst
lesen. Nutzerseitige Doku in [README.md](README.md).

---

## Absolute Regeln dieses Projekts

**1. Nur OpenRouter.** Kein Code, der `api.openai.com`, `api.anthropic.com`,
`generativelanguage.googleapis.com` oder `api.groq.com` direkt aufruft – auch nicht als
optionaler Zweig, auch nicht als Fallback. Groq ausschliesslich über OpenRouters
Provider-Routing. Keine Provider-Abstraktion: es gibt genau eine Gegenstelle, ein
Interface mit einer Implementierung wäre Ballast.

**2. Der Store-Build enthält keinen Fallback-Code.** Nicht ausgeblendet, sondern nicht
vorhanden. Jede Änderung am Fallback wird mit `extension/scripts/verify-store-bundle.sh`
gegengeprüft, und zwar gegen das gebaute Bundle, nicht gegen den Quelltext. Das Skript
enthält eine Gegenprobe gegen den `full`-Build – ohne sie könnte ein Test bestehen, der
nichts misst.

**3. Kein stiller Fehlschlag beim Transkript.** Fehlen Untertitel, sagt die UI das. Kein
Platzhalter, kein Ersatztext, keine erfundene Ausgabe. Liefert eine Quelle keine
Zeitstempel, steht `hasTimestamps: false` und es werden keine Sprungmarken angeboten.

**4. Kein Download ohne Klick.** Der Audio-Fallback startet ausschliesslich auf eine
ausdrückliche Nutzeraktion.

**5. Keine Telemetrie, kein Backend, kein Proxy.** Host-Permissions bleiben bei
`youtube.com` und `openrouter.ai`.

---

## Was gemessen ist und nicht wieder aus dem Gedächtnis beantwortet wird

Diese Werte stammen aus echten Aufrufen am 01.09.2026. Sie stehen hier, damit sie nicht
erneut geraten werden:

- `openai/whisper-large-v3-turbo` **kann** Zeitstempel: `response_format: "verbose_json"`
  plus `timestamp_granularities: ["segment"]`, 46 Segmente über fünf Minuten. Der
  ursprüngliche Auftragsstand („Zeitstempel nicht dokumentiert“) ist überholt.
- `nvidia/parakeet-tdt-0.6b-v3` **kann sie nicht**: HTTP 400, *„The selected model does
  not support response_format verbose_json. Use json instead.“* Einziger Provider:
  Together.
- `parakeet-mlx` schreibt `{"text", "sentences": [{text, start, end, …}]}` – **start und
  end sind Strings**, kein Zahlentyp.
- OpenRouter weist bei STT-Modellen **keine Preiseinheit** aus. Derselbe Feldwert steht
  je nach Provider für Sekunden, Minuten oder Stunden. Deshalb Heuristik plus Rohwert in
  der UI, nie eine stumme Umrechnung.
- Das komprimierte Format zählt: fünf Minuten sind als WAV 9,6 MB und als Opus 0,9 MB.
  Der Endpunkt nimmt `format: "ogg"`.

**Der Untertitel-Weg im Browser – gelöst, und wie:**

Die `baseUrl` aus dem HTML der Watch-Seite ist **unbrauchbar**: HTTP 200 mit leerem Body,
anonym wie angemeldet, bei `roh`, `fmt=json3`, `fmt=srv3`, `fmt=json3&c=WEB`. Brauchbar
ist nur die **signierte** URL aus einer Player-Antwort des visionOS-Clients – sie trägt
`signature=`, `expire=`, `sparams=`, `key=yt8`.

Damit YouTube diese Antwort herausgibt, müssen **vier** Dinge stimmen. Fehlt eines,
kommt `playabilityStatus: LOGIN_REQUIRED` („Melde dich an, damit wir sehen, dass du kein
Bot bist") – auch beim angemeldeten Nutzer:

1. **`playbackContext.contentPlaybackContext.signatureTimestamp`** aus YouTubes
   `base.js` (`jsUrl` steht im HTML, darin `signatureTimestamp:20684`). Das war der
   eigentlich fehlende Baustein.
2. Header **`X-Goog-Visitor-Id`** mit dem `visitorData` aus dem HTML.
3. **`userAgent` im Kontext-Objekt** – ein Safari-String. Der echte `User-Agent`-Header
   ist für JavaScript gesperrt, wird aber auch nicht gebraucht.
4. **Kein `key=`-Parameter** an der URL, nur `?prettyPrint=false`.

Abgelesen an `yt-dlp --print-traffic`, nicht geraten. Gemessen 01.09.2026: 31 Spuren,
signierte URL, **46.010 Zeichen** Untertitel-JSON, **mit und ohne Cookies** – also auch
für nicht angemeldete Nutzer.

**Die Spurauswahl braucht `defaultCaptionTrackIndex`.** Bei 31 Community-Spuren liefert
„erste Spur" Arabisch statt Englisch. YouTubes eigene Vorauswahl steht in
`audioTracks[0].defaultCaptionTrackIndex` (im Test: 6 = Englisch).

**Was daran nicht die Ursache war**, jeweils gemessen und ausgeschlossen: die fehlende
Anmeldung, der Proof-of-Origin-Token (yt-dlp läuft mit `PO Token Providers: none`), der
`User-Agent`-Header, der Cookie-Banner.

**yt-dlp ist damit nur noch für Audio zuständig** – so, wie es der Auftrag vorsah. Die
Host-Route `"subtitles"` bleibt als Notnagel bestehen, falls YouTube wieder dichtmacht,
wird aber nur angeboten, wenn der Browser-Weg scheitert.

**Der DOM-Panel-Weg funktioniert nicht** und ist nur noch zweiter Rückfall: der Klick auf
„Transkript anzeigen" öffnet weder programmatisch noch mit echtem Nutzerklick etwas, und
im DOM liegen zwei Panels (`PAmodern_transcript_view`,
`engagement-panel-searchable-transcript`), beide `HIDDEN` und leer.

**Die Oberfläche liegt in Chromes Seitenleiste**, nicht mehr in YouTubes rechter Spalte.
Drei Gründe, alle gemessen:

- Die Spalte ist rund 400 px breit, mehr gibt sie nicht her.
- Tastendrücke im Chat erreichten YouTubes globale Kürzel – die **Leertaste pausierte das
  Video beim Tippen**. Ein eigenes Dokument sieht diese Tasten nicht.
- YouTube setzt **`html { font-size: 10px }`**. Tailwind rechnet in `rem`, und `rem`
  bezieht sich immer auf die Dokumentwurzel, auch im Shadow DOM. Die eingebettete Sidebar
  lief damit auf 62,5 % ihrer Grösse: `text-sm` waren 8,75 px statt 14. Deshalb stehen
  Schriftgrössen, Abstände und Radien im `@theme`-Block in **Pixeln**.

**Das Transkript holt weiterhin das Content-Script.** Derselbe Player-Aufruf gibt aus
einer Extension-Seite heraus **HTML statt JSON** zurück – YouTube beantwortet ihn nur von
einer eigenen Seite aus. Die Seitenleiste fragt deshalb über `lib/transcript-bridge.ts`
per Message an. Für den DOM-Rückfall gilt dasselbe, er braucht ohnehin einen DOM.

**Das Symbol schaltet die Seitenleiste um**, mehr nicht – über
`setPanelBehavior({openPanelOnActionClick: true})`. Der naheliegende Weg, ausserhalb von
YouTube stattdessen die Einstellungen zu öffnen, wäre tab-weises Freigeben und Sperren
per `setOptions({tabId, enabled})`. Der ist verbaut: **Vivaldi ignoriert `tabId` und führt
genau ein globales Panel**, ein Sperren „nur für diesen Tab" schaltet die Seitenleiste
dort überall ab. Liegt kein YouTube-Video im aktiven Tab, sagt das Panel das selbst und
bietet einen Knopf zu den Einstellungen an.

**Vivaldi-Eigenheiten**, recherchiert am 02.09.2026:

- Die Seitenleiste erscheint in **Vivaldis Panel-Leiste** (bei Standardeinstellung links),
  nicht rechts neben der Seite. Die Seite ist eine Browser-Einstellung: `getLayout()`
  meldet sie nur, `setOptions({side})` wird mit *„Unexpected property"* abgewiesen.
- **`action.default_icon` ist Pflicht.** Chrome fällt ohne es auf `icons` zurück, Vivaldi
  zeigt dann gar kein Symbol – und ohne Symbol kommt niemand an die Seitenleiste.
- `side_panel.default_path` steht statisch im Manifest, weil `setOptions()` in Vivaldi bis
  Version 8.0 wirkungslos war.

**Werbung kappt `currentTime`.** Während einer Werbeeinblendung meldet das `<video>` die
Dauer des Werbespots (19 bzw. 111 s statt 1120 s), und ein Sprung darüber hinaus wird
still gekappt. Deshalb `pendingSeek` plus `durationchange`/`loadedmetadata`.

Zwei DOM-Fallen aus der Panel-Zeit, im Code abgesichert:

- YouTube hält **zwei identische Segmentlisten**, eine unsichtbar. Nur die sichtbare
  lesen, zusätzlich nach Zeit und Text deduplizieren.
- Im **Hintergrundtab** lädt das Panel nie. Der Code wartet auf
  `visibilityState === "visible"` und sagt das in der UI.

**Die Translator API verlangt eine Nutzergeste**, solange das Sprachmodell noch nicht
geladen ist: *„NotAllowedError: Requires a user gesture when availability is 'downloading'
or 'downloadable'."* Jedes `await` vor `Translator.create()` verbraucht die Geste des
Klicks – auch ein dynamischer Import. Deshalb ist `translate()` in der Sidebar synchron
und `create()` der erste `await` überhaupt. Gemessen: 286 Zeitstempel, 22.507 Zeichen,
rund drei Minuten, davon 160 s Modell-Download.

**Die Oberfläche liegt in Chromes Seitenleiste**, nicht mehr in YouTubes rechter Spalte.
Drei Gründe, alle gemessen:

- Die Spalte ist rund 400 px breit, mehr gibt sie nicht her.
- Tastendrücke im Chat erreichten YouTubes globale Kürzel – die **Leertaste pausierte das
  Video beim Tippen**. Ein eigenes Dokument sieht diese Tasten nicht.
- YouTube setzt **`html { font-size: 10px }`**. Tailwind rechnet in `rem`, und `rem`
  bezieht sich immer auf die Dokumentwurzel, auch im Shadow DOM. Die eingebettete Sidebar
  lief damit auf 62,5 % ihrer Grösse: `text-sm` waren 8,75 px statt 14. Deshalb stehen
  Schriftgrössen, Abstände und Radien im `@theme`-Block in **Pixeln**.

**Das Transkript holt weiterhin das Content-Script.** Derselbe Player-Aufruf gibt aus
einer Extension-Seite heraus **HTML statt JSON** zurück – YouTube beantwortet ihn nur von
einer eigenen Seite aus. Die Seitenleiste fragt deshalb über `lib/transcript-bridge.ts`
per Message an. Für den DOM-Rückfall gilt dasselbe, er braucht ohnehin einen DOM.

**Das Symbol schaltet die Seitenleiste um**, mehr nicht – über
`setPanelBehavior({openPanelOnActionClick: true})`. Der naheliegende Weg, ausserhalb von
YouTube stattdessen die Einstellungen zu öffnen, wäre tab-weises Freigeben und Sperren
per `setOptions({tabId, enabled})`. Der ist verbaut: **Vivaldi ignoriert `tabId` und führt
genau ein globales Panel**, ein Sperren „nur für diesen Tab" schaltet die Seitenleiste
dort überall ab. Liegt kein YouTube-Video im aktiven Tab, sagt das Panel das selbst und
bietet einen Knopf zu den Einstellungen an.

**Vivaldi-Eigenheiten**, recherchiert am 02.09.2026:

- Die Seitenleiste erscheint in **Vivaldis Panel-Leiste** (bei Standardeinstellung links),
  nicht rechts neben der Seite. Die Seite ist eine Browser-Einstellung: `getLayout()`
  meldet sie nur, `setOptions({side})` wird mit *„Unexpected property"* abgewiesen.
- **`action.default_icon` ist Pflicht.** Chrome fällt ohne es auf `icons` zurück, Vivaldi
  zeigt dann gar kein Symbol – und ohne Symbol kommt niemand an die Seitenleiste.
- `side_panel.default_path` steht statisch im Manifest, weil `setOptions()` in Vivaldi bis
  Version 8.0 wirkungslos war.

**Werbung kappt `currentTime`.** Während einer Werbeeinblendung meldet das `<video>` die
Dauer des Werbespots (19 bzw. 111 s statt 1120 s), und ein Sprung darüber hinaus wird
still gekappt. Deshalb `pendingSeek` plus `durationchange`/`loadedmetadata`.

Zwei DOM-Fallen, die dabei aufgefallen sind und im Code abgesichert sind:

- YouTube hält **zwei identische Segmentlisten**, eine unsichtbar. Ein Selektor über das
  Dokument verdoppelt das Transkript still. Nur die sichtbare Liste lesen, zusätzlich
  nach Zeit und Text deduplizieren.
- Im **Hintergrundtab** lädt das Panel nie (zehn Anläufe über 141 s: null Segmente).
  Deshalb wartet der Code auf `visibilityState === "visible"`.

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
- **yt-dlp als Untertitel-Route**: war die Notlösung, solange die Ursache unklar war. Der
  Browser-Weg funktioniert; yt-dlp ist wieder das, was es sein sollte – der Weg zur
  Tonspur.

---

## Aufbau

```
build-full/           gebaute Erweiterung zum Laden (GitHub-Build)
icon-source/          Icon-Quelle (Python/PIL) und die gerenderten Grössen
build-store/          gebaute Erweiterung ohne Fallback
extension/            WXT-Projekt (Quelltext, das Manifest entsteht erst beim Bauen)
  entrypoints/        sidepanel/ · content.tsx · background.ts · options/
  components/         PanelApp, Sidebar, Markdown, TranscriptView, HistoryView, ui/
  lib/                openrouter · transcript · transcript-bridge · fallback · translate-local …
  scripts/            selfcheck.ts · verify-store-bundle.sh
native-host/          Python-Host für den Audio-Fallback (nur full)
```

Der Fallback liegt vollständig in `lib/fallback.ts` und wird nur aus
`if (__FALLBACK__)`-Zweigen erreicht – so greift die Elimination am Modul, nicht bloss an
der Bedingung.

## Prüfungen

```bash
cd extension && pnpm run compile && pnpm run check
cd extension && pnpm run build && pnpm run build:store && ./scripts/verify-store-bundle.sh
cd native-host && python3 selfcheck.py
```

Alle vier laufen, bevor etwas als fertig gemeldet wird. Was nicht geprüft werden konnte,
steht im README-Abschnitt „Was nicht geprüft ist“ und wird dort gepflegt, nicht
weggelassen.

## Sprache

Doku, UI-Texte und Kommentare auf Deutsch mit echten Umlauten. Ausnahme: der
Native-Host-Quelltext kommt ohne Umlaute aus, weil er in Umgebungen mit ungewisser
Zeichensatz-Einstellung läuft. Technische Begriffe im Original.
