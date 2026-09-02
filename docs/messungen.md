# Gemessene Befunde – chrome-youtube-summary-chat

Alles hier stammt aus echten Aufrufen, nicht aus dem Gedächtnis. Kurzform und
Verweis stehen in [../CLAUDE.md](../CLAUDE.md).

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

**Die Oberfläche ist eingebettet, und zwar nur dort** – in YouTubes rechter Spalte,
einklappbar. Eine zweite Ausgabe in Chromes Seitenleiste gab es zwischenzeitlich; sie ist
vollständig zurückgebaut, samt der Permission `sidePanel`. Grund ist **Vivaldi-Bug
VB-123452** (in 8.1 offen): Vivaldi trägt jede Extension mit dieser Permission ungefragt
in seine Panel-Leiste ein und öffnet dort beim Installieren ein leeres Panel. Aus der
Extension heraus ist das nicht verhinderbar – der einzige Weg ist, die Permission nicht
zu deklarieren.

`uiPlacement: "both"` war zusätzlich ein echter Fehler: beide Instanzen mounten dieselbe
`Sidebar` und hören auf `chrome.storage.local.onChanged`, das ergibt zwei
Transkript-Abrufe pro Video und einen Schreibkonflikt auf `local:conv:<videoId>`.

Zwei gemessene Nachteile der eingebetteten Variante bleiben – beide sind im Code gelöst,
nicht durch ein zweites Fenster:

- YouTubes globale Tastaturkürzel greifen in den Chat (siehe unten, am `window` in der
  Capture-Phase abgefangen).
- YouTube setzt **`html { font-size: 10px }`**. Tailwind rechnet in `rem`, und `rem`
  bezieht sich immer auf die Dokumentwurzel, auch im Shadow DOM. Die Sidebar lief damit
  auf 62,5 % ihrer Grösse: `text-sm` waren 8,75 px statt 14. Deshalb stehen
  Schriftgrössen, Abstände und Radien im `@theme`-Block in **Pixeln**.

Die Spalte ist rund 400 px breit; dagegen steht der Regler `uiScale` (Default 110 %,
90–220 %), der als `zoom` am Wurzel-Container hängt.
**Übersetzt wird, was gerade auf dem Tisch liegt.** Steht eine Antwort im Chat – eine
Zusammenfassung, Kapitel –, wird die übersetzt; erst wenn keine da ist, geht es an das
Transkript. Beides braucht einen anderen Weg: eine Zusammenfassung ist Markdown mit
Überschriften und Listen, ein Transkript sind Zeitstempelzeilen. Bei der lokalen
Übersetzung geht deshalb jede Zeile einzeln durch `translateMarkdown`, und der
strukturtragende Zeilenanfang (`## `, `- `, `[02:13] `) bleibt unangetastet – wirft man
der Translator API eine ganze Markdown-Antwort hin, kommt sie zerlegt zurück.

**YouTubes Tastaturkürzel greifen in den Chat**, wenn man nichts dagegen tut: für einen
Listener ausserhalb des Shadow DOM ist `event.target` nicht das `<textarea>`, sondern der
Host `<yt-summary-chat>` – das Event wird beim Verlassen des Shadow-Baums umgeschrieben.
YouTubes Prüfung „tippt der Nutzer gerade in ein Feld?" schlägt fehl, und jeder Buchstabe
wird zum Kürzel: Leer und „k" pausieren, „m" schaltet stumm, Ziffern springen.

Abgefangen wird am **`window` in der Capture-Phase** – die früheste Station der
Ereigniskette, früher als jeder Listener am `document`, unabhängig von der
Registrierungsreihenfolge. Wichtig: **nativ registrieren**, nicht über
`ctx.addEventListener` – der Wrapper reicht das Capture-Flag nicht durch, und ohne
Capture kommt YouTube zuerst dran. Gemessen: vorher vier Tasten pro Anschlag am
`document`, danach null; ausserhalb der Sidebar unverändert.

**Die Schrift im Shadow DOM muss am Kind gesetzt werden.** WXTs Reset ist
`all: initial !important` auf `:host` – auf `:host` selbst lässt sich das nicht
überschreiben, und ohne Gegenregel fällt der Browser auf seine Serifenschrift zurück.
Deshalb steht die Regel auf `:host > *`, mit YouTubes eigenem Stack (Roboto).

**Das Transkript holt das Content-Script.** Derselbe Player-Aufruf gibt aus einer
Extension-Seite heraus **HTML statt JSON** zurück – YouTube beantwortet ihn nur von einer
eigenen Seite aus. Das war der Grund, warum die Seitenleiste eine Message-Bridge brauchte;
ohne sie ist der Punkt erledigt, das Content-Script fragt direkt.

**Das Symbol öffnet die Optionen**, mehr nicht. Tab-weises Freigeben und Sperren per
`setOptions({tabId, enabled})` wäre der naheliegende Weg gewesen, ist aber doppelt
verbaut: **Vivaldi ignoriert `tabId` und führt genau ein globales Panel**, und die
Seitenleiste gibt es ohnehin nicht mehr.

**Vivaldi-Eigenheiten**, gemessen am 02.09.2026 (Vivaldi 8.1 / Chromium 150):

- **`action.default_icon` ist Pflicht.** Chrome fällt ohne es auf `icons` zurück, Vivaldi
  zeigt dann gar kein Symbol.
- `chrome.sidePanel` ist vorhanden, `setOptions`/`setPanelBehavior` laufen durch, aber
  `setOptions({side})` wird mit *„Unexpected property"* abgewiesen; `getLayout()` meldet
  `{side: "right"}` und ist reine Auskunft. Die Panel-Seite ist eine Browser-Einstellung.
- Vivaldi hat einen **eigenen Zoom pro Web-Panel**, getrennt vom Seiten-Zoom – relevant
  nur, falls die Seitenleiste je zurückkommt.

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


**Die winzige Schrift kam aus einer einzigen selbstgeschriebenen Regel.** Die
Tailwind-Klassen standen längst auf Pixeln, aber `.md-body` in `@layer components` stand
weiter auf `font-size: 0.875rem` – bei YouTubes 10px-Wurzel also **8,75 px statt 14**.
Michaels Schätzung „4–5 pt" war zutreffend; meine Messung der `text-sm`-Klassen ging an
der Stelle vorbei, an der der Text tatsächlich gerendert wurde. Jetzt 15 px. Dazu
entfernt: `-webkit-font-smoothing: antialiased` – YouTube rendert mit `auto` (gemessen),
antialiased zeichnet die Striche auf macOS dünner und lässt den Text kleiner wirken.

**Die drei Zusammenfassungsstufen unterscheiden sich im Zweck, nicht in der Länge.**
Reine Mengenangaben („kurz", „mittel", „lang") erzeugen Nacherzählung in drei Grössen,
weil dem Modell ein Kriterium zum Weglassen fehlt. Die Knöpfe heissen deshalb **Fazit ·
Argumente · Ausführlich**, und die Presets arbeiten mit Leser statt Aufgabe, Aussage statt
Thema (mit Kontrastpaar), einem Verbot der Nacherzähl-Wendungen, Reihenfolge nach Gewicht
und einem Satzbudget, das vom Input entkoppelt ist.

Verursacher war aber nicht das Preset, sondern der **System-Prompt**: er verlangte
„Abschnitte in der Reihenfolge des Videos", Vollständigkeit und Zeitstempel-Dichte und
übersteuerte damit jede Verdichtungsanweisung. Widersprechen sich beide, gewinnt der
längere und konkretere Text. Form gehört seither ausschliesslich in die Presets, der
System-Prompt sagt nur noch, was inhaltlich gilt. **Der ursprüngliche System-Prompt kam
wörtlich aus Michaels Auftrag – die Änderung ist bewusst und hier offengelegt.**

