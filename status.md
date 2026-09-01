# Status – chrome-youtube-summary-chat

## Offene To-Dos (oberstes zuerst)

1. **Windows-Installer ausführen**, sobald ein Windows-Rechner zur Hand ist.
2. Optional: Store-Build einreichen.

## Stand 02.09.2026 (nachts) – Tastatur, Schrift, Grössen

### Tippen im Chat löste YouTube-Kürzel aus

Der gravierendste der drei Punkte. Ursache: für einen Listener ausserhalb des Shadow DOM
ist `event.target` nicht das `<textarea>`, sondern der Host – das Event wird beim
Verlassen des Shadow-Baums umgeschrieben. YouTubes Prüfung „tippt jemand in ein Feld?"
schlägt fehl, jeder Buchstabe wird zum Kürzel.

Abgefangen am `window` in der **Capture**-Phase, **nativ registriert**: WXTs
`ctx.addEventListener` reicht das Capture-Flag nicht durch, und ohne Capture kommt
YouTubes document-Listener zuerst. Gemessen: vorher vier Treffer am `document` pro
Anschlag, danach null – ausserhalb der Sidebar unverändert einer.

### Serifenschrift

WXTs Reset ist `all: initial !important` auf `:host`, das nimmt auch die Schriftfamilie.
Auf `:host` selbst nicht überschreibbar, deshalb `:host > *` mit YouTubes Stack. Gemessen:
vorher Times, jetzt Roboto.

### Grössen

Fliesstext 14 px, Sekundäres 13 px – an YouTube angeglichen; die Kleinstgrössen 10/11 px
sind raus. Pixel statt `rem` bleibt richtig: `rem` hinge an YouTubes 10-px-Wurzel, Pixel
folgen dem Browser-Zoom genauso.

## Stand 02.09.2026 (abends) – vier Korrekturen nach Michaels Test

### 1. Die eingebettete Sidebar war weg – mein Fehler

Beim Umzug in die Seitenleiste habe ich die Sidebar in YouTubes rechter Spalte
**ersetzt statt ergänzt**. Der ursprüngliche Auftrag galt aber weiter. Sie ist zurück;
neue Einstellung `uiPlacement` mit „Beides" (Default), „Nur eingebettet", „Nur
Seitenleiste". Einklappen konnte die eingebettete Variante schon immer, der Zustand wird
gemerkt.

### 2. Übersetzen nahm immer das Transkript

Jetzt kontextabhängig: steht eine Antwort im Chat, wird die übersetzt – erst wenn keine
da ist, das Transkript. Der Knopf beschriftet sich entsprechend.

### 3. Formattreue beim Übersetzen

Wirft man der Translator API eine ganze Markdown-Antwort hin, kommt sie zerlegt zurück.
`translateMarkdown` geht deshalb zeilenweise vor und lässt den strukturtragenden
Zeilenanfang stehen: `## `, `- `, `1. `, `> ` und Zeitstempel wie `[02:13] `. Codeblöcke,
Leerzeilen und Trennlinien werden übersprungen. Für den Cloud-Weg gibt es
`answerTranslationPrompt`, der Formattreue statt Vollständigkeit verlangt.

**Verifiziert:** Zusammenfassung erzeugt, dann übersetzt – 2.418 Zeichen mit erhaltenen
Listen, Zeitstempeln und Fettungen.

### 4. Audio-Route auch bei vorhandenen Untertiteln

Im Transkript-Tab sitzt jetzt ein Knopf, der die Tonspur über die eingestellte STT-Route
transkribiert, obwohl Untertitel da sind. Nur im `full`-Build.

## Offene To-Dos (oberstes zuerst)

1. **Windows-Installer ausführen**, sobald ein Windows-Rechner zur Hand ist.
2. Optional: Store-Build einreichen.

## Stand 02.09.2026 – Umzug in Chromes Seitenleiste, Farben, Icon

### Warum die eingebettete Sidebar weg ist

Drei Mängel, die alle an der Einbettung hingen:

- **Zu schmal.** YouTubes rechte Spalte gibt rund 400 px her, mehr nicht.
- **Die Leertaste pausierte das Video beim Tippen** – YouTubes globale Tastaturkürzel
  erreichten den Chat. Ein eigenes Dokument sieht diese Tasten nicht mehr.
- **Alles war 37,5 % zu klein.** YouTube setzt `html { font-size: 10px }` (gemessen).
  Tailwind rechnet in `rem`, und `rem` bezieht sich auf die Dokumentwurzel – auch im
  Shadow DOM. `text-sm` waren damit 8,75 px statt 14. Behoben durch Pixelwerte im
  `@theme`-Block; das gilt jetzt für beide Oberflächen.

### Was der Umzug gekostet hat

Der Player-Aufruf für die Untertitel gibt aus einer Extension-Seite heraus **HTML statt
JSON** zurück – YouTube beantwortet ihn nur von einer eigenen Seite aus. Das Transkript
holt deshalb weiterhin das Content-Script; die Seitenleiste fragt über
`lib/transcript-bridge.ts` per Message an. Das Content-Script hat keine eigene
Oberfläche mehr.

### Symbol und Vivaldi

Der Klick schaltet die Seitenleiste um. Die erste Fassung gab sie pro Tab frei oder
sperrte sie, um ausserhalb von YouTube die Einstellungen zu öffnen – das ist verworfen:
**Vivaldi ignoriert `tabId` bei `setOptions()`** und führt ein globales Panel, ein Sperren
„nur für diesen Tab" hätte die Seitenleiste dort überall abgeschaltet. Stattdessen sagt
das Panel selbst, wenn kein YouTube-Video im aktiven Tab liegt, und bietet den Knopf zu
den Einstellungen.

Zwei weitere Vivaldi-Befunde:

- **`action.default_icon` ist Pflicht.** Ohne es zeigt Vivaldi kein Symbol – und ohne
  Symbol kommt niemand an die Seitenleiste. Das war die Ursache dafür, dass die
  Seitenleiste bei Michael nie erschien.
- Die Seitenleiste sitzt in Vivaldis **Panel-Leiste**, standardmäßig links. Die Seite ist
  Nutzereinstellung: `getLayout()` liest sie, `setOptions({side})` wird abgewiesen
  (*„Unexpected property"*).

### Farben und Icon

Die Farbwelt kommt aus DiktaGo: warme, gebrochene Töne statt Reinweiss und Reinschwarz,
Basis im Dunkeln `#1A1613`. Akzent ist YouTube-Rot (`#C4302B` hell, `#FF4438` dunkel) –
auch die Zeitstempel, die vorher YouTube-blau waren.

Das Icon liegt als Python-Quelle in `icon-source/` und wird in 16/32/48/128/256 gerendert:
YouTube-rotes Rechteck mit Farbverlauf, drei Transkriptzeilen, Play-Scheibe. Die Grössen
entsprechen denen der Translate-Extension.

### Verifiziert

Seitenleiste neben einem YouTube-Tab: **286 Transkriptzeilen, Spur „English"** korrekt
vorausgewählt, Zeitstempel in der Akzentfarbe, Schrift 14 px. Alle vier Prüfungen grün.

## Stand 01.09.2026 (spät) – der Untertitel-Weg im Browser funktioniert

**Michaels Einwand war berechtigt und hat die Sache gelöst:** yt-dlp ist für Untertitel
nicht nötig, es war nur für Audio gedacht. Solange der Browser-Weg nicht lief, war der
Auftrag nicht erfüllt – auch wenn die Extension über den Umweg funktionierte.

### Was gefehlt hat

Die `baseUrl` aus dem HTML ist unbrauchbar (HTTP 200, leerer Body). Brauchbar ist nur die
**signierte** URL aus einer visionOS-Player-Antwort. Dafür braucht der Request vier Dinge,
und mir fehlten drei davon:

1. `playbackContext.contentPlaybackContext.signatureTimestamp` aus YouTubes `base.js`
2. Header `X-Goog-Visitor-Id` mit dem `visitorData` der Seite
3. `userAgent` **im Kontext-Objekt** (Safari-String)
4. kein `key=`-Parameter an der URL

**Abgelesen, nicht geraten:** `yt-dlp --print-traffic` zeigt den exakten Request. Das war
der Schritt, der nach zwei falschen Hypothesen weitergeholfen hat.

### Gemessen

| | |
|---|---|
| Player-Antwort | `playabilityStatus: OK`, 31 Spuren, signierte URL |
| Untertitel-JSON | 46.010 Zeichen, mit **und ohne** Cookies |
| Sidebar `full`-Build | 286 Zeilen, kein Helfer-Knopf |
| Sidebar `store`-Build | **286 Zeilen, ohne nativeMessaging** |
| Spurauswahl | `defaultCaptionTrackIndex` = 6 = Englisch (ohne das: Arabisch) |

### Zwei Hypothesen, die ich selbst widerlegt habe

- **Die fehlende Anmeldung.** Angemeldet gemessen: `playabilityStatus` wird `OK`, der
  Abruf bleibt trotzdem leer.
- **Der Proof-of-Origin-Token.** `yt-dlp` läuft mit `PO Token Providers: none` – es
  braucht ihn gar nicht.

### Folgen

- **Entscheidung A (Store-Build fallenlassen) ist hinfällig.** Der Store-Build liefert
  jetzt dasselbe Transkript wie der full-Build, ohne Helfer, ohne `nativeMessaging`.
  Der Tree-Shaking-Test läuft weiter durch.
- **yt-dlp ist wieder das, was der Auftrag vorsah:** der Weg zur Tonspur. Die Host-Route
  `"subtitles"` bleibt als Notnagel, falls YouTube den Browser-Weg wieder zumacht.
- **Der Native Host war auf Michaels Rechner nie installiert** – deshalb lief die
  Extension bei ihm nicht. Jetzt registriert, und der Installer deckt neben Chrome auch
  **Vivaldi**, Brave und Edge ab.

## Stand 01.09.2026 (abends) – die Anmeldung war nicht die Ursache

In einer **angemeldeten** Sitzung gemessen (Browser-Pane, Michaels Konto):

| | anonym | angemeldet |
|---|---|---|
| `playabilityStatus` | `LOGIN_REQUIRED` | **`OK`** |
| Spurliste | vorhanden | vorhanden, 31 Spuren |
| `baseUrl` abrufen | HTTP 200, Body leer | **HTTP 200, Body leer** |
| Panel, programmatischer Klick | 0 Segmente | 0 Segmente |
| Panel, **echter Nutzerklick** | – | **0 Segmente** |

Damit ist meine eigene Erklärung vom Nachmittag widerlegt: `LOGIN_REQUIRED` war ein
Nebenschauplatz, nicht die Ursache. Im DOM liegen inzwischen zwei Transkript-Panels
(`PAmodern_transcript_view`, `engagement-panel-searchable-transcript`), beide bleiben
`HIDDEN` und leer.

**Wahrscheinliche echte Ursache, ungemessen:** der Proof-of-Origin-Token für
`/api/timedtext`, den `yt-dlp` erzeugt und ein `fetch` aus der Seite heraus nicht.

**Folge:** Der `full`-Build ist unverändert tragfähig – die yt-dlp-Route ist die
Hauptroute, nicht der Notnagel. Der `store`-Build hat ein echtes Loch und ist so nicht
einreichbar. Siehe To-Do 1.

## Stand 01.09.2026 (nachmittags) – Transkript-Blocker gelöst, Kette end-to-end belegt

### Die Ursache: YouTube verlangt eine Anmeldung

`POST /youtubei/v1/player` mit dem visionOS-Client (clientName `VISIONOS`, clientVersion
`1.02`, deviceModel `RealityDevice17,1`, `X-Youtube-Client-Name: 101`) antwortet
`playabilityStatus: LOGIN_REQUIRED`, Grund im Wortlaut: **„Melde dich an, damit wir sehen,
dass du kein Bot bist"** – mit und ohne angemeldete Sitzung. Das ist die gemeinsame
Ursache aller drei Fehlschläge im Browser:

| Weg | Ergebnis |
|---|---|
| `baseUrl` aus `ytInitialPlayerResponse`, roh / `fmt=json3` / `fmt=srv3` / `&c=WEB` | HTTP 200, Body leer |
| Panel-Klick im DOM | expandiert (`visibility=…EXPANDED`), kein einziger Netzwerk-Request |
| `POST /youtubei/v1/get_transcript` mit vollen Headern | HTTP 400 „Precondition check failed." |

### Die Lösung: eine dritte Route im lokalen Helfer

`yt-dlp` kommt durch. Neue Host-Route `"subtitles"` (`fetch_subtitles()` in
`native-host/yt_summary_host.py`) holt die vorhandene Untertitelspur per
`--write-subs --write-auto-subs --sub-format json3 --skip-download`. Kostenlos, mit
YouTubes eigenen Zeitstempeln, kein Audio-Download. In der Sidebar steht sie als
**erster** Knopf – billig vor teuer –, der Audio-Fallback als zweiter. Beide nur auf Klick.

### Vollständig verifizierte Kette (Testprofil, unangemeldet)

Sidebar → „Untertitel über den lokalen Helfer holen" → Native Host → yt-dlp →
**286 Segmente, 18.430 Zeichen**, `Quelle: YouTube-Untertitel (en, via yt-dlp)` →
Chat-Tab → Preset „Kurz" → **4.278 Zeichen deutsche Antwort auf ein englisches Video,
34 anklickbare Zeitstempel, „Token: 6941 / 1299 · Kosten: $0.00533"**.

### Chrome-Übersetzung: real gelaufen

**286 Zeitstempel, 22.507 Zeichen**, vollständige deutsche Fassung des Transkripts,
ohne Netz zum Anbieter und ohne Kosten. Dauer rund drei Minuten, davon 160 s
Modell-Download.

Der Weg dahin war ein echter Fund: `Translator.create()` verlangt eine **Nutzergeste**,
solange das Sprachmodell noch nicht geladen ist –
*„NotAllowedError: Requires a user gesture when availability is 'downloading' or
'downloadable'."* Jedes `await` vor dem Aufruf verbraucht die Geste des Klicks. Deshalb
ist `translate()` in der Sidebar jetzt **synchron**: kein dynamischer Import, keine
Verfügbarkeitsprüfung im Handler (die läuft vorab in einem Effect), und
`Translator.create()` ist der erste `await` überhaupt. Der Download-Fortschritt wird
angezeigt, weil 160 s ohne Rückmeldung wie ein Hänger aussehen.

### Dritter Fehler aus dem Browsertest: Werbung kappt den Zeitsprung

Ein Klick auf `[05:01]` sprang nicht. Ursache: das `<video>`-Element zeigte während der
Werbung eine Dauer von 19 bzw. 111 s statt 1120 s, und `currentTime` wurde auf diese
Länge gekappt. Behoben über `pendingSeek` plus `durationchange`/`loadedmetadata`.
Verifiziert: `[05:01]` geklickt, nach 7 s stand das Video bei 302 s.

### Geschärfte Store-Test-Kriterien

`yt-dlp` und `ffmpeg` sind aus den harten Kriterien von `verify-store-bundle.sh`
entfernt, mit Begründung im Skript: die Extension ruft beide nie selbst auf, nur der Host –
im Bundle kämen sie ausschließlich als Wort in Hinweistexten vor. Hart geprüft werden
`connectNative`, `sendNativeMessage`, der Host-Name und `audio/transcriptions`. Dazu die
Prüfung, dass `runFallbackJob` eine leere Hülle ist. Gegenprobe gegen den full-Build
läuft mit. Ergebnis: bestanden.

### Gescheiterte Profilkopie

Die vom Nutzer gewählte Variante – eine Kopie des echten Chrome-Profils – ging nicht:
die Sitzungsdatei auf Platte war neun Tage alt (Chrome schreibt sie erst beim Beenden),
und ihre Entschlüsselung braucht einen Schlüsselbund-Eintrag, den ein Chrome mit fremdem
`--user-data-dir` nicht bekommt. Ergebnis: `angemeldet: false`. Die Kopie wurde
vollständig gelöscht.

## Stand 01.09.2026 – Erstfassung

### Verifiziert, mit Beleg

| Prüfung | Ergebnis |
|---|---|
| `pnpm run build` / `build:store` | beide grün |
| `verify-store-bundle.sh` | bestanden, inkl. Gegenprobe gegen den full-Build |
| `pnpm run compile` | keine Fehler |
| `pnpm run check` | 12 Prüfungen |
| `native-host/selfcheck.py` | 6 Prüfungen |
| Host end-to-end, Route parakeet-mlx | 4 Segmente mit Zeiten |
| Host end-to-end, Route whisper-turbo | 1 Segment (19-s-Video), 46 bei 5 Minuten |
| Host end-to-end, Route parakeet OpenRouter | 0 Segmente, nur Text – wie vorhergesagt |
| `/api/v1/key` | HTTP 200, Felder wie im Parser erwartet |
| Sidebar in Chrome | hängt als erstes Kind in `#secondary-inner`, also über den Empfehlungen; Dark-Mode übernommen |
| Options-Page in Chrome | Modellliste live (375 Modelle), 1M-Marker, System-Prompt, Kopier-Knöpfe |

### Zwei Fehler, die der Browsertest gefunden hat

- **Sidebar doppelt eingehängt.** Beide Navigationssignale (`wxt:locationchange` und
  `yt-navigate-finish`) feuerten für dasselbe Video, und der zweite Lauf startete einen
  zweiten Mount, während der erste noch auf den Anker wartete. Behoben über einen
  Generationszähler plus Aufräumen alter DOM-Reste.
- **Transkript-Verdoppelung.** YouTube hält zwei identische Segmentlisten im DOM, eine
  unsichtbar. Ein Selektor über das Dokument hätte das Transkript still verdoppelt.

### Die drei Recherchepunkte, beantwortet

whisper-turbo liefert Zeitstempel, parakeet über OpenRouter nicht, parakeet-mlx liefert
sie lokal, DiktaGo ist nicht ansprechbar. Zahlen in [CLAUDE.md](CLAUDE.md).

### Entscheidungen des Nutzers in dieser Sitzung

- WXT statt Plasmo (Plasmo seit Mai 2025 ohne Veröffentlichung).
- Route Parakeet ONNX (Intel) entfällt – nur Linux-Binaries verfügbar.
- Route DiktaGo entfällt, Befund als Rückmeldung ins DiktaGo-Projekt geschrieben.
- Der STT-Test durfte den OpenRouter-Key aus DiktaGos Datenordner verwenden.
- Beim Untertitel-Problem: erst messen, dann den DOM-Weg als Rückfall einbauen.

### Nachträglicher Wunsch, umgesetzt

Chromes eingebaute Translator API als zweiter Übersetzungsweg – zeilenweise, damit
Zeitstempel strukturell unangetastet bleiben. Läuft im Content-Script, weil die API in
Web Workers fehlt. Standard bleibt OpenRouter.
