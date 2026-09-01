# Status – chrome-youtube-summary-chat

## Offene To-Dos (oberstes zuerst)

1. **Windows-Installer ausführen**, sobald ein Windows-Rechner zur Hand ist.
   `native-host/install-windows.ps1` (Registry-Schlüssel) und die winget-Pfade sind
   ungetestet.
2. Optional: Store-Build einreichen. Er funktioniert jetzt vollständig.

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
