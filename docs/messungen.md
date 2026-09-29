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



## Breite der rechten Spalte (02.09.2026)

YouTube schreibt `--ytd-watch-flexy-sidebar-width` als Inline-Custom-Property auf
`ytd-watch-flexy` und rechnet sie bei jedem Resize neu (Basis 402 px, darüber ein
prozentualer Anteil der Fensterbreite). Eine Autorenregel mit `!important` gewinnt
trotzdem, auch nach jedem Resize.

`--ytd-watch-flexy-max-player-width` ist **keine Breiten-, sondern eine
Höhendeckelung**: `calc((100vh - 56px - 12px - 48px) * 16/9)`. Wer sie durch eine eigene
`100vw`-Formel ersetzt, hebt den Deckel auf. Gemessen bei 1600x600 Fenster:

| Regel | Spalte | Player |
|---|---|---|
| YouTube unverändert | 489 px | 1063 x 598 |
| beide Variablen gesetzt | 636 px | 884 x 663 (ragt aus dem Fenster) |
| nur Spaltenbreite gesetzt | 636 px | 645 x 484 |

Weitere Messwerte mit gesetzter Spaltenbreite 620 px: bei 1010 px Fensterbreite schrumpft
`#secondary` auf 498 px und der Player hält seine Mindestbreite 480 px; bei 990 px fällt
YouTube ins Ein-Spalten-Layout, `#secondary` und damit die Sidebar verschwinden ganz
(Attribut `is-two-columns_` fehlt dann).

Echte Werte der Hilfsvariablen (headless, ohne sichtbare Scrollbar):
`--ytd-watch-flexy-horizontal-page-margin: 16px`, `--ytd-watch-flexy-scrollbar-width: 0px`,
`--ytd-watch-flexy-non-player-height: calc(56px + 12px + 48px)`.

`--ytd-watch-flexy-sidebar-min-width` (300 px) ist das Sicherheitsventil und bleibt
unangetastet.


## `zoom` und Viewport-Einheiten (02.09.2026)

**`zoom` multipliziert Viewport-Einheiten mit, Prozentwerte nicht.** Gemessen: ein
Element mit `zoom: 1.1` und `height: calc(100vh - 80px)` misst bei 813 px Viewport
**806,3 px**, also (813 − 80) × 1,1 statt 733. Das heisst, ein `h-[72vh]` am gezoomten
Element rendert bei `uiScale` 110 in Wahrheit 79 vh, bei 150 % über 100 vh.

Deshalb trägt die **äussere, unskalierte Hülle** die Höhe und das gezoomte Kind steht auf
`h-full`. Gegenprobe: Hülle ohne `zoom` mit `calc(100vh - 80px)` = 733 px, Kind mit
`zoom: 1.1; height: 100%` = exakt 733 px.

**YouTubes Custom Properties kommen durch WXTs Reset hindurch**: `all: initial !important`
am `:host` lässt Custom Properties per Spezifikation aus, `--ytd-watch-flexy-non-player-height`
ist im Shadow DOM als `calc(56px + 12px + 48px)` lesbar. Verwendet werden trotzdem feste
Zahlen – eine Umbenennung bei YouTube würde sonst stumm die Höhe zerstören.

## Symbolgeometrie im Sendeknopf (02.09.2026)

`getBBox()` des lucide-Icons `Send` liefert x 2…22, y 2…22, Mitte exakt (12, 12) – die Box
ist zentriert, die **Masse** aber nicht: der Papierflieger hat Ecken bei (22, 2), (2, 9)
und (15, 22), Schwerpunkt rund (13, 11). Das Symbol wirkt dadurch nach oben rechts
versetzt. `ArrowUp` ist x 5…19, y 5…19 und in beiden Achsen spiegelsymmetrisch – deshalb
steht dort jetzt ein Pfeil, wie in allen aktuellen Chat-Eingaben.

## Spurauswahl: welche Untertitelspur die richtige ist (02.09.2026)

Gemessen am Video `9D-xzper0wQ`: die Watch-Seite meldet zwei Spuren, `.de` (von Hand,
Index 0) und `a.en` (`kind: "asr"`, Index 1), dazu
`"defaultCaptionTrackIndex":0, "hasDefaultTrack":true, "captionTrackIndices":[0,1]`.
YouTube selbst wählt also die **deutsche, redigierte** Spur vor – die Extension nahm
trotzdem die englische ASR-Spur und lud 364 Zeilen automatisch erzeugten Text.

Die Regel lautet jetzt: ist die Vorauswahl automatisch, gewinnt eine handgemachte Spur –
erst dieselbe Sprache (der Kanal hat korrigierte Untertitel nachgereicht), sonst
irgendeine handgemachte. Eine redigierte Spur ist auch in einer anderen Sprache besser
als eine automatische, weil das Modell ohnehin übersetzt. Nach der Änderung: „Deutsch",
218 Zeilen.

## `port.onDisconnect` feuert nur am anderen Ende (02.09.2026)

Chromes Dokumentation ist an der Stelle eindeutig, und es war die Ursache des
Stopp-Knopfs, der nach dem Klick als Stopp-Knopf stehenblieb: `port.disconnect()` löst
**kein** `onDisconnect` in derselben Seite aus, das Versprechen des Chat-Clients wurde
also nie aufgelöst. `stop()` löst es jetzt selbst.

Gemessen am laufenden Übersetzungslauf: Titel „Abbrechen · 37/218", nach dem Klick binnen
1,2 s „Original anzeigen", sechs Sekunden später unverändert – es läuft nichts weiter.

## React-Hooks hinter einem frühen Return (02.09.2026)

Die Options-Seite rendert gar nichts (`document.body.textContent.length === 10`), in der
Konsole steht „Rendered more hooks than during the previous render". Vier Hooks der
Verfügbarkeitsanzeige standen hinter `if (!s) return <Laden/>`. Der Fehler ist im DOM
unsichtbar – ohne Auslesen der Konsole hätte man ihn für ein Ladeproblem gehalten.

## Werbung besetzt das `<video>`-Element (02.09.2026)

Während einer Anzeige ist `document.querySelector('video')` das Werbevideo (gemessen:
Dauer 113 s, `.ad-showing` gesetzt, das eigentliche Video hat keine eigene Instanz). Ein
Zeitstempel-Klick spulte damit die Werbung. `seek()` merkt den Sprung jetzt vor und holt
ihn nach, sobald der Player umschaltet – derselbe Weg, den `applyPendingSeek` schon ging.

## Chrome-Übersetzung im Options-Kontext (02.09.2026)

`Translator.availability({sourceLanguage:"en", targetLanguage:<Ziel>})` antwortet auf der
`chrome-extension://`-Options-Seite mit `downloadable`; der Ladeknopf steht da, der
Schalter für die lokale Route ist gesperrt, solange das Modell fehlt. Der Download dauert
rund 160 Sekunden. Die API stammt aus Chromium und ist stabil ab Chrome 138 (37
Sprachen), Edge 148 bringt eine eigene Variante (145+ Sprachen) – Vivaldi und Brave
müssten sie eigenständig anbieten, was **nicht garantiert** ist. Deshalb wird der Zustand
gemessen und nicht angenommen.

## Absatzkriterien im Fliesstext (Setzung, 02.09.2026)

Absatzende bei einer Pause von 2 Sekunden, ab 25 Sekunden Dauer mit Satzzeichen, hart bei
60 Sekunden. An `9D-xzper0wQ` ergibt das 36 Absätze aus 218 Cues – lesbar. Das sind
Setzungen, keine Messwerte; an sehr schnell gesprochenen Spuren nachzujustieren.

## Folgemodus: Ruhezone und Zielpunkt (02.09.2026)

Die aktive Zeile wird nur nachgeführt, wenn sie ausserhalb von 20–60 % der sichtbaren
Höhe liegt, und landet dann auf einem Drittel. Gerechnet wird mit `offsetTop`/`scrollTop`
statt `getBoundingClientRect`, weil `zoom` die Rechteckwerte skaliert. Gemessen: Video auf
Minute 10 von 17:34 gesetzt, Klick auf das Symbol scrollt von 0 auf 2016 px; ein
`wheel`-Ereignis schaltet den Modus wieder ab.

## Beschleunigte Wiedergabe als Audioquelle: 4x trägt, 8x nicht (02.09.2026)

Für einen Store-Build ohne yt-dlp bleibt nur der Ton, den der Browser ohnehin abspielt.
Gemessen im Content-Script auf einer Watch-Seite (Chrome 152): `video.captureStream()`
liefert eine Audiospur, `createMediaElementSource` ebenfalls; hängt der Graph nicht an
`ctx.destination`, hört der Nutzer nichts. `playbackRate` bis 16 bleibt tönend – bei 8x
und 16x kam kein einziger stiller Block an, RMS unverändert. Der AudioContext lief mit
**44,1 kHz**.

Der Haken ist nicht der Dekoder, sondern die Bandbreite: Web Audio liefert in
Wanduhrzeit, die Beschleunigung komprimiert das Signal. Nach dem Zurückrechnen bleibt
44,1 kHz geteilt durch den Faktor, halbiert.

Nachgemessen mit `parakeet-tdt-0.6b-v3` an vier Minuten deutscher Rede aus
`M4Tw_3SmNXg`. Die Kette in ffmpeg bildet Chromes Weg nach:
`asetrate=48000*N, aresample=44100, asetrate=44100/N, aresample=16000`. Referenz ist
dasselbe Audio ohne Umweg, 548 Wörter.

| Faktor | Nutzband | Wörter | WER | 30-min-Video braucht |
|---|---|---|---|---|
| 1x | 22,0 kHz | 548 | – | 30:00 |
| 3x | 7,4 kHz | 548 | 0,0 % | 10:00 |
| **4x** | **5,5 kHz** | **549** | **1,6 %** | **7:30** |
| 5x | 4,4 kHz | 549 | 1,8 % | 6:00 |
| 6x | 3,7 kHz | 549 | 4,2 % | 5:00 |
| 8x | 2,8 kHz | 463 | 32,7 % | 3:45 |

Die WER-Zahl allein verharmlost den Bruch bei 8x. Dort **kippt Parakeet in die falsche
Sprache** und übersetzt halb: aus „Das ist in diesem Fall aber nicht weiter schlimm"
wird „This is in this fall but not schlimm, while we this model not test". Der Text
klingt flüssig und ist falsch – die gefährlichste Fehlerart. Bei 4x und 5x sind es
Kleinigkeiten („ist" → „is"), bei 6x beginnt dasselbe Kippen einzelner Sätze
(„That is in diesem Fall").

Damit ist **4x der Arbeitspunkt** und 5x die Grenze, an die man gehen kann. Der Gewinn
von 6x (eine Minute je halbe Stunde) steht gegen den Anfang des Sprachkippens.

> **Gilt nur für Parakeet.** Der Live-Weg im Browser schickt an
> `whisper-large-v3-turbo`, und dort liegt die Grenze woanders – siehe den Abschnitt vom
> 03.09.2026. Entscheidend ist dort nicht der Faktor, sondern die Sprachvorgabe.

## Audioqualität, Geschwindigkeit und der Versuch, sie nachzukorrigieren (02.09.2026)

**Die Audiospur hängt nicht an der Videoqualität.** Gemessen über
`getStatsForNerds()` an `M4Tw_3SmNXg`: von 720p bis 144p zieht Chrome immer dieselbe
Spur, `opus (251)` mit 142 kbit/s und 48 kHz. Das Video wechselt (640x480 → 320x240 →
192x144), der Ton bleibt. Eine niedrige Auflösung ist also gratis – sie entlastet den
Dekoder für die beschleunigte Wiedergabe, ohne den Ton zu verschlechtern.

Was zählt, ist die **Abtastrate der Quelle**, nicht ihre Bitrate. Dieselben vier Minuten,
drei Audiospuren, gegen die unbeschleunigte Referenz:

| Audiospur | 1x | 4x | 6x | 8x |
|---|---|---|---|---|
| AAC 49k, **22 kHz** (itag 139) | 8,0 % | 13,7 % | 29,2 % | 34,9 % |
| Opus 46k, 48 kHz (itag 249) | 0,4 % | 1,1 % | 6,4 % | 28,5 % |
| Opus 142k, 48 kHz (itag 251) | 0,0 % | 0,9 % | 4,0 % | 33,0 % |

Opus mit 46 kbit/s ist praktisch so gut wie mit 142; die AAC-Spur mit halber Abtastrate
ist schon unbeschleunigt unbrauchbar. Im Browser kommt sie nicht vor – gut zu wissen,
falls jemand später auf die Idee kommt, die Tonspur selbst auszuwählen.

**Der Zusammenbruch bei 8x ist nicht berechenbar.** Derselbe Aufbau an einem zweiten
Ausschnitt desselben Videos (Minute 20 bis 24 statt 2 bis 6):

| Ausschnitt | 4x | 6x | 8x |
|---|---|---|---|
| A: Fachdeutsch mit englischen Begriffen | 0,9 % | 4,0 % | **33,0 %** |
| B: erzählendes Deutsch | 1,2 % | 1,2 % | **3,2 %** |

In Ausschnitt A kippt Parakeet bei 8x in die falsche Sprache und übersetzt halb; in B
bleibt es bei Kleinigkeiten. Das Argument gegen 8x ist deshalb nicht der Mittelwert,
sondern das Risiko: der Nutzer kann vorher nicht wissen, welchen Fall er hat, und die
Ausgabe klingt in beiden Fällen flüssig.

**Eine deterministische Nachkorrektur rettet das nicht.** Geprüft mit einer Liste
englischer Funktionswörter, die im deutschen Satz nichts verloren haben („and" → „und",
„for" → „für"), abgesichert über die Nachbarwörter, damit echte englische Passagen in
Ruhe bleiben:

| | roh | nachkorrigiert |
|---|---|---|
| Ausschnitt A, 6x | 4,0 % | **2,7 %** |
| Ausschnitt A, 8x | 33,0 % | 30,7 % |
| Ausschnitt B, 4x | 1,2 % | **2,3 %** |
| Ausschnitt B, 6x | 1,2 % | **2,3 %** |

Sie nimmt ein Drittel der Fehler weg, wo der Fehler auftritt, und verdoppelt ihn, wo er
nicht auftritt: in einem Text über Programmierwerkzeuge sind „and" und „for" oft richtig.
Beides zu unterscheiden verlangt genau das Sprachverständnis, das der deterministischen
Nachbearbeitung fehlt. Das ist der Unterschied zu DiktaGos Wörterbuch, das nur
namentlich eingetragene Begriffe anfasst.

**Ergebnis: 4x, ein Modus, kein Schnell-Schalter.** Ein Umschalter „schnell oder genau"
wäre die Wahl zwischen „meistens gut" und „manchmal flüssig formulierter Unsinn", ohne
dass der Nutzer vorher sagen kann, welcher Fall vorliegt.

## Audiospur und Videoqualität: dritter Anlauf, diesmal mit Kontrollwert (02.09.2026)

Zwei Messungen davor waren wertlos, und das stand jeweils im eigenen Ergebnis:

1. `setPlaybackQualityRange()` gesetzt, `getStatsForNerds()` gelesen – aber
   `getPlaybackQuality()` meldete bei allen fünf Stufen unverändert „large". Die
   Umschaltung hatte nie gegriffen.
2. Ein Sprung von 45 Sekunden im laufenden Video sollte eine neue Aushandlung erzwingen.
   Er garantiert weder einen ungepufferten Bereich noch einen neuen Audio-Request – der
   vorhandene Puffer spielt die alte Spur weiter. Befund von Codex, nicht von mir.

Der tragfähige Aufbau: Qualität setzen, **Seite neu laden** (YouTube merkt sich die Wahl
für die Sitzung, und erst der frische Ladevorgang handelt beide Spuren neu aus), dann
Qualität, Codecs und die Pixelmasse des `<video>`-Elements zusammen auslesen. Die
Auflösung des Elements ist der Kontrollwert: wechselt sie nicht, hat die Messung nicht
gegriffen.

| gewünscht | gemeldete Qualität | `<video>`-Element | Codecs |
|---|---|---|---|
| tiny | tiny | 256x144 | av01 (394) / **opus (251)** |
| small | tiny | 426x240 | av01 (395) / **opus (251)** |
| medium | medium | 640x360 | av01 (396) / **opus (251)** |
| hd720 | hd720 | 1280x720 | av01 (398) / **opus (251)** |

Die Videospur wechselt über vier Stufen, die Audiospur bleibt dieselbe. Für die
beschleunigte Erfassung heisst das: eine niedrige Auflösung kostet nichts an Tonqualität
und entlastet den Dekoder.

Der itag lässt sich **nicht** mehr aus den Netzwerk-URLs lesen: die DASH-Segmente laufen
heute als POST an `/videoplayback` ohne `itag=` im Query. Im Mitschnitt tauchte nur
itag 18 auf (das alte muxed 360p-Format für die Vorschau). Wer das nachmessen will, nimmt
`getStatsForNerds().codecs` und den Kontrollwert oben.

Die öffentliche Beleglage stützt das: bis zur Umstellung auf HTML5 mit Media Source
Extensions (27.01.2015) waren Ton und Bild in einer Datei – itag 18 mit 96 kbit/s AAC,
itag 22 mit 192 kbit/s –, wer damals herunterschaltete, bekam zwingend schlechteren Ton.
Seither sind es getrennte Ströme; die alten muxed-Formate hat YouTube Mitte 2024
abgeschaltet. Auf itag 249/250 stuft heute nur die Bandbreitenregelung herunter, nicht
die Auflösungswahl.

## Welche Tonspur der lokale Helfer lädt (02.09.2026)

`-f bestaudio` nahm immer die grösste Spur. Für die Spracherkennung zählt aber die
Abtastrate, nicht die Bitrate – siehe die Tabelle weiter oben: Opus mit 46 kbit/s und
48 kHz liegt bei 0,4 % Wortfehlern, Opus mit 142 kbit/s bei 0,0 %, die AAC-Spur mit
22 kHz Abtastrate dagegen bei 8,0 %.

Der Selektor lautet jetzt
`bestaudio[asr=48000][abr<=70]/bestaudio[asr>=44100]/bestaudio`: erst eine schmale
48-kHz-Spur, sonst die beste ab 44,1 kHz, sonst irgendeine. Die 22-kHz-Spur ist damit
ausgeschlossen, obwohl sie die kleinste wäre.

Gemessen an drei Videos:

| Video | vorher | jetzt | Datenmenge |
|---|---|---|---|
| M4Tw_3SmNXg | 251, 142 kbit/s | **250, 64 kbit/s** | 47,2 → 22,3 MB |
| jNQXAC9IVRw | 251 | **250, 60 kbit/s** | – |
| 9D-xzper0wQ | 251, 121 kbit/s | 251 | unverändert, es gibt dort keine schmale Spur |

Die ganze Kette (Download, ffmpeg auf 16 kHz Mono, parakeet-mlx) an einem kurzen Video
gegengeprüft: das Transkript kommt sauber heraus.

## Chrome Web Store: Was mit dem Ton erlaubt ist (02.09.2026)

Nachgelesen in den Programmrichtlinien, nicht vermutet:

- **Download ist verboten.** Wörtlich untersagt ist, *„unauthorized access, download, or
  streaming of copyrighted content or media"* zu ermöglichen oder zu erleichtern. Das
  trifft den `yt-dlp`-Weg des full-Builds – er bleibt deshalb dort und kommt nie in den
  Store-Build.
- **Verarbeitung im Arbeitsspeicher ist erlaubt.** `chrome.tabCapture` und
  `captureStream()` erzeugen keine Datei; der Ton wird gelesen, transkribiert und
  verworfen.
- **Ein Verweis auf die andere Fassung wäre ein Bann.** Auch ein Hinweistext, wo man die
  Fassung mit Download bekommt, gilt als Erleichterung der Umgehung. Der Store-Build
  erwähnt den full-Build nicht.

## Parakeet läuft nur auf Apple Silicon (02.09.2026)

`parakeet-mlx` setzt auf MLX auf und braucht damit einen Mac mit Apple Silicon. Windows
und Intel-Macs haben ausschliesslich die OpenRouter-Routen; die ONNX-Route war schon
vorher ausgeschieden, weil `achetronic/parakeet` nur Linux-Binaries veröffentlicht. Eine
betriebssystemspezifische Ansteuerung bringt darüber hinaus nichts – MLX ist bereits die
plattformspezifische Fassung.

## Modellauswahl: Filterfeld, Klapprichtung, Nicht-Chat-Modelle (02.09.2026)

Im Browser gemessen, nicht angenommen:

- Nach dem Öffnen liegt der Fokus im Filterfeld (`document.activeElement` ist das Input
  mit dem Platzhalter „Filtern – Name oder Slug").
- Die Liste klappt nur nach unten: der Auslöser endet bei 415 px, die Liste beginnt bei
  419 px. Beim Aufklappen nach oben lag die Kopfzeile mit dem Filterfeld ausserhalb des
  sichtbaren Bereichs.
- Nach dem Modalitätsfilter bleiben 278 bis 281 Modelle. Sieben fielen erst durch die
  verschärfte Regel „Ausgabe **nur** Text" heraus: Bildgeneratoren (Ausgabe „image,
  text"), `gpt-audio` und `gpt-audio-mini` (Ausgabe „text, audio"). `llama-guard-4-12b`
  und `gpt-oss-safeguard-20b` geben zwar nur Text aus, liefern aber Sicherheitsurteile
  statt Antworten – sie sind nur am Namen zu erkennen.

## YouTube drosselt je Video, nicht je Werkzeug (02.09.2026)

Derselbe Aufruf, zwei Videos: 15,19 MiB in 13 Sekunden bei `9D-xzper0wQ`, 34 KiB/s bei
`M4Tw_3SmNXg`. Am lokalen Weg wurde nichts geändert – die Drosselung liegt bei YouTube
und trifft einzelne Videos.

## Spracherkennung aus dem laufenden Ton: was die Probe ergab (02.09.2026)

Gemessen in Michaels eigenem Chrome (Kopie des angemeldeten Profils, Debug-Port,
`--mute-audio`), Video `9D-xzper0wQ` ab Sekunde 60, Aufnahme 30 Sekunden Realzeit bei
`playbackRate = 4` und `preservesPitch = false`:

| Grösse | Wert |
|---|---|
| Abtastwerte | 1.318.912 (44.100 Hz Aufnahmerate) |
| abgedeckte Videozeit | 85,2 s |
| daraus gemessene Rate | 15.489 Hz |
| Dauer laut Whisper | 85,15 s |
| Segmente | 13, Sprache korrekt als Englisch erkannt |
| Grösse der Anfrage | 3,4 MB base64 |

**Die Rückrechnung stimmt auf 0,05 Sekunden** – die Dauer, die das Modell im WAV liest,
entspricht der Videozeit, die wirklich vergangen ist.

**Die Rate darf nicht gerechnet werden.** 30 Sekunden bei vierfachem Tempo müssten 120
Videosekunden sein; es waren 85,2, effektiv also 2,8x. Die Ursache lag hier an der stark
belegten Internetleitung und sagt nichts über Chrome; entscheidend ist, dass es
vorkommt. Wäre die WAV-Rate als „Aufnahmerate durch vier" (11.025 Hz) deklariert worden,
hätte das Modell alles um Faktor 1,4 zeitverschoben ausgegeben – ohne Fehlermeldung, mit
plausibel aussehendem Text. Deshalb wird die Rate aus Abtastwerten je tatsächlich
vergangener Videosekunde bestimmt.

**Whisper läuft am Stückende über:** letztes Segmentende bei 114,92 s in einem Stück von
85,15 s. Die Zeiten werden deshalb auf die Stückdauer geklemmt.

## Werbung ist kein Randfall, sondern der Normalfall im Testprofil (02.09.2026)

In einem frischen, nicht angemeldeten Chrome-Profil lieferte YouTube vor jedem Video
Werbeblöcke von 80, 111, 149, 180 und 305 Sekunden; teils lief die Werbung nicht einmal
ab (`currentTime` blieb bei 0 von 149 s). Drei Befunde daraus, die den Code betreffen:

- **Werbung läuft im selben `<video>`-Element.** Sie meldet ihre eigene `duration` – im
  Test 79 s statt 46 Minuten. Ein Ende-Test gegen `duration` hielt die Erkennung für
  fertig, bevor der Beitrag begonnen hatte.
- **Die Klasse steht am Player, nicht irgendwo.** Geprüft wird
  `#movie_player.ad-showing`.
- **Nach der Werbung setzt YouTube die Geschwindigkeit auf 1x zurück**, ohne dass
  zwingend ein `ratechange` folgt. Beim Übergang zurück in den Beitrag muss das Tempo
  neu gesetzt und der Stückbeginn auf die Beitragszeit gezogen werden.

## Zwei Rennen beim Start (02.09.2026)

- `video.play()` bricht mit `AbortError` ab, wenn YouTube im selben Moment eine neue
  Quelle lädt: *„The play() request was interrupted by a new load request."* Das ist kein
  Fehlschlag – entscheidend ist, ob danach gespielt wird.
- `video.captureStream()` kann einen Strom **ohne Audiospur** liefern, wenn er zu früh
  geholt wird: `InvalidStateError: MediaStream has no audio track`. Der Strom wird
  deshalb so lange erneut geholt, bis eine Tonspur darin liegt.

## Chrome 136+ sperrt den Debug-Port am Standardprofil (02.09.2026)

Chromes eigene Meldung im Wortlaut: *„DevTools remote debugging requires a non-default
data directory. Specify this using --user-data-dir."* Tests mit Michaels Anmeldung
laufen deshalb auf einer **Kopie** des Profils. Der frühere Fehlschlag dieses Wegs lag
daran, dass Chrome beim Kopieren noch lief; nach sauberem Beenden meldete die Kopie
`angemeldet: true` und lieferte keine Werbung.

## Tempo im Live-Weg: 8x trägt, die Sprachvorgabe entscheidet (03.09.2026)

Gegenprobe zum Parakeet-Befund oben, diesmal am Modell, das der Live-Weg wirklich
benutzt: `openai/whisper-large-v3-turbo` über OpenRouter. Aufgenommen wurde jeweils
**derselbe Abschnitt** – `JTFq1MM9bYA`, ab Sekunde 60, 120 Videosekunden – im echten
Content-Script-Weg (`captureStream` → ScriptProcessor → WAV mit gemessener Rate).

| Faktor | Rate im WAV | Echtzeit | Ergebnis |
|---|---|---|---|
| 4x | 11.025 Hz | 30,2 s | sehr gut |
| 6x | 7.346 Hz | 20,1 s | sehr gut, kein Unterschied zu 4x |
| **8x** | **5.506 Hz** | **15,1 s** | **sehr gut – ein Satz mehr als bei 4x** |
| 12x | 3.673 Hz | 10,1 s | erste Fehler: „liege ich mich in den Stressabbau", „Niedigkeit" |
| 16x | 2.760 Hz | 7,6 s | unbrauchbar: „Ich heiße mich ja Ila", „Hibbernatur-Prävention" |

Der Player ist nicht die Grenze: eingestellt 16x, erreicht 15,89x, und bis dahin kommt
lückenlos Ton an (Spitzenwert 0,99 in jedem Lauf).

**Der eigentliche Hebel ist die Sprachvorgabe.** Ohne `language` erkannte Whisper
denselben deutschen Ausschnitt bei 4x als Englisch und gab ihn halb übersetzt zurück:
„With my body work I'm going to the stress-on-the-send." Mit `language: "de"` war
derselbe Ton bei 4x, 6x und 8x fehlerfrei. Das kostet mehr Qualität als jede Tempostufe –
und es ist dasselbe Kippen, das den Parakeet-Befund oben bei 8x abbrechen liess.

Konsequenz im Code: `TEMPO = 8`, und ab dem zweiten Stück gilt die Sprache, die das erste
ergeben hat, statt sie je Stück neu raten zu lassen. Ende zu Ende über den Knopf
gemessen: **43,5 s für ein 5:06-Video** statt 109 s bei 4x.

## Parakeet über OpenRouter liefert keine Zeitstempel (03.09.2026, Gegenprobe)

Der Grund, warum der Live-Weg fest auf Whisper steht, erneut geprüft – dieselbe
WAV-Datei, drei Anfragen:

| Anfrage | Antwort |
|---|---|
| `nvidia/parakeet-tdt-0.6b-v3` + `verbose_json` | HTTP 400: „The selected model does not support response_format \"verbose_json\". Use \"json\" instead." |
| `nvidia/parakeet-tdt-0.6b-v3` + `json` | HTTP 200, Felder `text`, `usage` – **keine Segmente** |
| `openai/whisper-large-v3-turbo` + `verbose_json` | HTTP 200, Felder `duration`, `language`, `segments`, `task`, `text`, `usage` |

Ohne Segmente gäbe es im Live-Weg nur eine Sprungmarke je 120-Sekunden-Stück. Lokal über
den Helfer ist Parakeet dagegen die richtige Wahl: `parakeet-mlx` liefert Zeitstempel
selbst, kostet nichts und brauchte für dasselbe 5:06-Video 16,6 s.

## Deutsches Parakeet: es gibt eines, aber nicht von NVIDIA (03.09.2026)

`nvidia/parakeet-tdt-0.6b-v3` ist das mehrsprachige Modell – 25 europäische Sprachen laut
Modellkarte, Deutsch darunter; `v2` und `parakeet-ctc-1.1b` sind rein englisch. Ein
eigenes deutsches Modell kommt von Dritten: **`primeline/parakeet-primeline`**,
Feintuning auf v3-Basis, veröffentlicht am 13.01.2026. Genau dieses steckt in der
Android-App „Dictate Keyboard" (Engine: sherpa-onnx) als Auswahl „Parakeet German".
Fachspezifisch gibt es ausserdem `Mediform/parakeet-medical-de` und
`johannhartmann/parakeet_de_med`.

## Der Modellfilter verlor den Fokus nach dem ersten Zeichen (03.09.2026)

Gemeldet und nachgestellt: im Auswahlfeld für das Chat-Modell kam nur ein Buchstabe an,
danach ging der Fokus verloren. Gemessen über CDP, `document.activeElement` nach jedem
Anschlag:

| nach | Fokus | Feldwert |
|---|---|---|
| „s" | `DIV[role=listbox]` | „s" |
| „o" | `DIV[role=option]` | „s" |
| „n" | `DIV[role=option]` | „s" |

Radix setzt den Fokus neu, sobald sich die Liste ändert; die weiteren Anschläge landeten
im Typeahead des Auswahlfelds. Den Fokus im nächsten Frame zurückzuholen half nicht –
Radix setzt ihn danach erneut.

Behoben, indem das Auswahlfeld die Tasten selbst entgegennimmt
(`onKeyDownCapture` am `SelectContent`, druckbare Zeichen und Rücktaste werden vor dem
Typeahead abgefangen und in den Filtertext geschrieben). Das Feld darüber zeigt nur noch
an (`readOnly`, `tabIndex={-1}`). Gegenprobe mit „sonnet 5": 147 → 15 → 10 → 5 → 1
Treffer, der Text steht vollständig im Feld.

## Testbrowser ansteuern, ohne die Arbeit zu stören (03.09.2026)

`PUT /json/new` legt zwar einen Tab an, hebt aber das Chrome-Fenster über die laufende
Arbeit. Stattdessen am Browser-Endpunkt (`/json/version` → `webSocketDebuggerUrl`)
`Target.createTarget` mit `background: true` aufrufen und mit `Target.closeTarget` wieder
schliessen; wo möglich den vorhandenen Tab per `Page.navigate` weiterverwenden.

Ebenfalls gemessen: **Chrome sucht das Native-Messaging-Manifest im Ordner des jeweiligen
Profils.** Eine Instanz mit eigenem `--user-data-dir` sieht die Installation im
Standardprofil nicht – `Specified native messaging host not found.` Im Testprofil genügt
ein Symlink nach `<user-data-dir>/NativeMessagingHosts/`.

## Wortfehlerrate der vier STT-Modelle gegen ein Handtranskript (03.09.2026)

Referenz ist ein **von Hand geschriebenes und lektoriertes** Transkript: TEDx-Vortrag
`9CZBIaaiPRI`, deutsch, 11:54, 1353 Wörter. YouTube weist es als reguläre Untertitelspur
aus, nicht als automatische. Live-Untertitel taugen dafür nicht – die Tagesschau
(`n_Y8ly4MMJ0`) hat zwar eine manuelle Spur, schreibt aber selbst hinein: „Diese Sendung
wurde vom NDR **live** untertitelt", und Live-Untertitelung kürzt.

Verglichen wird auf Wortebene nach Kleinschreibung, ohne Satzzeichen, mit ß→ss auf beiden
Seiten (sonst zählte jede Schreibweise als Fehler). Ziffern bleiben Ziffern.

| Modell | WER | falsche Wörter | ausgegebene Wörter |
|---|---|---|---|
| **parakeet primeline** (deutsch, lokal, ONNX int8) | **3,8 %** | 51 | 1352 |
| whisper-large-v3 (OpenRouter) | 4,1 % | 56 | 1369 |
| whisper-large-v3-turbo (OpenRouter) | 4,5 % | 61 | 1372 |
| parakeet v3 (mehrsprachig, MLX, lokal) | **15,7 %** | 212 | 1247 |

Der Abstand zwischen primeline und Whisper ist klein (5 Wörter auf 1353). Der grosse
Befund ist **parakeet v3**: 15,7 % und über 100 verschluckte Wörter – und genau dieses
Modell ist im Helfer als lokale Route eingestellt.

Die Herstellerangaben von primeline (Ø 2,95 % gegen 3,64 % für v3 und 3,28 % für
whisper-large-v3) stammen aus Benchmarks mit vorgelesenen Sätzen; auf Vortragston
schrumpft der Vorsprung.

### primeline schreibt kein ß

Im ganzen Transkript kein einziges ß, dafür „weiss", „muss", „Fuss". Das liegt **nicht**
an der ONNX-Konvertierung: das Vokabular führt vier ß-Tokens, darunter ein eigenes
`▁weiß`. Das Modell kennt die Form und wählt sie trotzdem nicht – die Trainingsdaten waren
offenbar in Schweizer Schreibweise oder ß-normalisiert. Zum Vergleich: whisper-large-v3
setzt neun ß, die Referenz drei.

## Dasselbe Modell, drei Laufzeitwege – und der Weg entscheidet mehr als das Modell (03.09.2026)

Anlass war Michaels Einwand, `parakeet v3` mit 15,7 % sei „eigenartig, da DiktaGo das nutzt
und gut ist". Der Einwand war berechtigt: gemessen wurde nicht das Modell, sondern die
Chunking-Voreinstellung von `parakeet-mlx` (120 s Fenster, 15 s Überlappung), die acht
Lücken von 8 bis 35 Wörtern hinterliess.

DiktaGo lädt dasselbe Modell über **FluidAudio** – Swift, CoreML, Apple Neural Engine,
`AsrModels.downloadAndLoad(version: .v3)` aus dem Repo `FluidInference/parakeet-tdt-0.6b-v3-coreml`.
Der Nachbau in `scratchpad/anevergleich/` bildet den Aufruf exakt nach: `AsrManager` mit
`config: .default`, frischer `TdtDecoderState`, `language: nil`.

| Modell | Weg | WER | ausgegebene Wörter |
|---|---|---|---|
| **parakeet primeline** (ValentinWeyer) | FluidAudio / CoreML (ANE) | **3,0 %** | 1352 |
| **parakeet primeline** (matt-2012) | FluidAudio / CoreML (ANE) | **3,0 %** | 1351 |
| parakeet primeline | sherpa-onnx, ONNX int8 | 3,8 % | 1352 |
| whisper-large-v3 | OpenRouter | 4,1 % | 1369 |
| whisper-large-v3-turbo | OpenRouter | 4,5 % | 1372 |
| parakeet v3 | FluidAudio / CoreML (ANE) | 5,9 % | 1347 |
| parakeet v3 | parakeet-mlx, `--chunk-duration 0` | 8,5 % | 1289 |
| parakeet v3 | parakeet-mlx, Standard-Chunking | 15,7 % | 1247 |

Für v3 liegen zwischen dem besten und dem schlechtesten Weg **15,7 gegen 5,9 Prozent** –
bei identischen Gewichten. Die Voreinstellung des Laufzeitwegs wiegt hier schwerer als die
Wahl zwischen zwei Modellen.

Geschwindigkeit auf der ANE, 11:54 Audio: primeline 3,0 s (235x Echtzeit), v3 2,9 s (248x).
Laden aus einem bereits vorhandenen Verzeichnis 9,8 s.

### primeline läuft auf der ANE, meldet dabei aber einen Shape-Fehler

Auf stdout erscheint einmalig `E5RT encountered an STL exception … ios17.slice_by_index:
zero shape error`. Das Transkript ist davon unbeschädigt (1352 Wörter, keine Lücke), aber
die Meldung landet **vor** dem Text und muss vor jeder Auswertung entfernt werden – sonst
zählt sie als 16 falsche Wörter und die WER springt von 3,0 auf 4,5 %.

Die Konvertierung ist ausserdem laut `conversion_metadata.json` mit
`compute_units: CPU_ONLY` gebaut. Sie läuft trotzdem unter FluidAudio, aber sie ist nicht
für die ANE optimiert – die 235x sind also kein Beleg für ANE-Nutzung des Encoders.

### Die Falle, die zwei Messungen wertlos gemacht hat

`AsrModels.load(from: URL)` **ignoriert den übergebenen Ordnernamen**. Der Code nimmt
`directory.deletingLastPathComponent()` und hängt den Repo-Ordnernamen selbst an. Heisst
das eigene Verzeichnis anders, findet FluidAudio nichts, lädt still das Standardmodell von
HuggingFace nach und rechnet damit – **ohne Fehler, ohne Warnung**.

Zwei Läufe lieferten so bit-identischen Text zum v3-Lauf (gleiche md5, 80 Fehler, 1347
Wörter), was zuerst wie ein Messfehler in der Auswertung aussah. Bewiesen wurde es mit der
Gegenprobe: **`Encoder.mlmodelc` komplett entfernt, Lauf lieferte trotzdem 8534 Zeichen
Transkript in 0,2 s Ladezeit.**

Der Ordner muss `parakeet-tdt-0.6b-v3` heissen – **ohne** `-coreml`, obwohl das HF-Repo so
heisst. Kontrolle bei jedem Lauf mit eigenem Modell:

- Ladezeit im Sekundenbereich (ein Download dauert Minuten),
- kein neuer Ordner im Elternverzeichnis,
- bei primeline: **kein einziges ß** im Ergebnis. Das ist die verlässlichste Signatur;
  v3 setzt neun.

### Es gibt zwei primeline-CoreML-Konvertierungen, beide gleich gut

`ValentinWeyer/parakeet-primeline-de-coreml` und `matt-2012/parakeet-primeline-de-coreml`
gehen auf denselben Checkpoint zurück (`primeline/parakeet-primeline`, bei Valentin als
`2_95_WER.nemo` in den Metadaten benannt). Decoder und JointDecision sind bytegleich, die
Encoder-Gewichte unterscheiden sich in der Quantisierung: 1212,1 MB bei Valentin gegen
1185,9 MB bei matt-2012.

Gemessen am selben Talk: 41 gegen 40 falsche Wörter von 1353. Der Unterschied ist Rauschen,
die Ausgaben sind aber nicht identisch. Beide brauchen rund 11 s zum Laden und knapp 3 s
für 11:54 Audio.

Beigaben unterscheiden sich: Valentin liefert `conversion_metadata.json` (die einzige
Quelle für Fenstergrösse, Vokabulargrösse und `compute_units`) und zwei Vokabulardateien,
matt-2012 nur `parakeet_vocab.json`.

**Achtung bei vorgefundenen Modellordnern:** Ein Ordner namens `primeline-matt` aus einer
DiktaGo-Sitzung enthielt in Wahrheit das Standard-v3 – erkennbar am 425-MB-Encoder und an
einer `config.json`, die von `palettized_lut6_mixed_fp16` und FluidAudio-Issue 760 spricht.
Der Lauf darauf lieferte prompt wieder die v3-Zahlen. Ein Ordnername ist kein Beleg; der
Beleg ist die Encoder-Grösse (primeline über 1,1 GB) und **null ß im Ergebnis**.

## Reale Modellgrössen und ein Plattformweg für Windows/Linux/Intel-Mac (03.09.2026)

Grössen über die HuggingFace-API abgerufen (`?blobs=true`), nicht geschätzt – nur die
Dateien gezählt, die der jeweilige Loader tatsächlich braucht:

| Modell | CoreML (ANE) | ONNX int8 |
|---|---|---|
| parakeet v3 | 482 MB (`Encoder_v2` + `Decoder` + `JointDecisionv3` + `Preprocessor`) | 670 MB (`istupakov/parakeet-tdt-0.6b-v3-onnx`) |
| primeline (ValentinWeyer) | 1224 MB | – |
| primeline (matt-2012) | 1211 MB | – |
| primeline (OpenVoiceOS, ONNX) | – | 672 MB |

primeline ist auf dem CoreML-Weg zweieinhalbmal so gross wie v3: v3s Encoder liegt dort
6-bit-palettiert vor (`Encoder_v2.mlmodelc`), primelines Konvertierungen nur in fp16.

### Sprachvorgabe ändert bei FluidAudio nichts an der Wortfehlerrate

`AsrManager.transcribe(…, language: "de")` gegen `language: nil` an `parakeet v3`:
identische 80 von 1353 falschen Wörtern. Der Parameter filtert laut Quelltext nur die
Ausgabeschrift für nicht-lateinische Alphabete, er beeinflusst nicht die Erkennung
selbst. Für Deutsch/Englisch also wirkungslos.

### `onnxruntime` deckt Windows, Linux und Intel-Mac mit demselben Code ab

Geprüft über die PyPI-API: Version 1.29.0 liefert Räder für `win_amd64`, `win_arm64`,
`manylinux2014_x86_64`, `manylinux2014_aarch64`, `macosx_10_15_x86_64` (Intel) und
`macosx_11_0_arm64`. `onnx-asr` (Modellname `nemo-parakeet-tdt-0.6b-v3`,
`quantization="int8"`) lädt sowohl das offizielle v3-ONNX-Repo als auch den
primeline-ONNX-Ordner mit derselben Codezeile. Lokal (Apple Silicon) bestätigt:
`onnxruntime.get_available_providers()` meldet dort `CoreMLExecutionProvider` vor
`CPUExecutionProvider` – der Provider wählt sich pro Plattform selbst, auf Windows wäre
das `CUDAExecutionProvider`/`DmlExecutionProvider`, auf Linux `CUDAExecutionProvider`.

**Nicht gemessen, weil die Hardware fehlt:** echte Windows- oder Linux-Läufe, eine
CUDA-GPU-Messung. Wird als offen geführt, nicht geschätzt.

## Fairer Vergleich ValentinWeyer gegen matt-2012: Gleichstand bestätigt (04.09.2026)

Anlass war Michaels Zweifel an der ersten Messung, die matt-2012 vorn zeigte (352x
gegen 289x) – zurecht, denn im ersten Lauf lief Valentin als erstes Modell im
Skript und trug damit den Aufwärmeffekt allein. Das Messschema wurde vor dem
erneuten Lauf mit Fable 5.1 abgestimmt:

- jedes Modell im **eigenen Prozess** geladen, nie zwei Modelle nacheinander im
  selben Lauf
- der erste Vortrag jeder Runde ist **Aufwärmlauf und wird verworfen**
- Reihenfolge über die Runden **ABBA** (Runde 1 Valentin→matt, Runde 2 matt→Valentin, …)
- fünf Runden, **5 Sekunden Pause** zwischen den Läufen gegen thermische Drift
- ausgewertet wird der **Median**, nicht das arithmetische Mittel

| | Wortfehler (Runde 1, WER ist deterministisch) | Anteil | Tempo, Median über 4 Läufe je Vortrag |
|---|---|---|---|
| matt-2012 | 457 von 5434 | 8,41 % | 369x (Streuung 238–411x) |
| ValentinWeyer | 461 von 5434 | 8,48 % | 345x (Streuung 216–396x) |

**Determinismus geprüft:** Über fünf Runden liefert jedes Modell exakt einen
Ergebnis-Hash – gleiches Audio, gleiches Ergebnis, kein fp16-Rauschen im Ausgang.

**Die sechs Stellen, an denen beide Modelle überhaupt abweichen** (auf 5434 Wörter):

| ValentinWeyer | matt-2012 |
|---|---|
| „oft gekommenen" | „oftgekommenen" |
| „misslingens" | „misslings" |
| „ja" | (fehlt) |
| „weh" | „wehren werden" |
| „mitzusagen" | „mit zu sagen" |
| (fehlt) | „denn" |

Ausschliesslich Getrennt-/Zusammenschreibung und Wortgrenzen, keine inhaltlichen
Fehler, keine falschen Zahlen oder Namen. **Der Tempovorteil von matt-2012 bleibt
auch fair gemessen bestehen** (rund 7 % im Median), plausibel durch den 26 MB
kleineren Encoder – Laden und Rechnen sind minimal günstiger. Bei über 340-facher
Echtzeit ist das für die Praxis ohne Bedeutung.

**Ein Auswertungsfehler ist dabei aufgetreten und behoben:** Der Aufwärmlauf nutzt
dieselbe Datei wie der erste Messlauf der Runde (`ted.wav` zweimal hintereinander).
Der erste Parser fasste beide Vorkommen unter demselben Dateinamen zusammen, wodurch
sich der Text verdoppelte und die Fehlerzahl auf 33 % hochschoss. Der Fehler lag rein
in der Auswertung, nicht in der Messung selbst – behoben, indem jeder `===DATEI`-Trenner
die Liste für diesen Namen neu beginnt, statt an eine bestehende anzuhängen.

## Sind die primeline-Konvertierungen optimal? Nein – siehe Gutachten (04.09.2026)

Volle Einschätzung von Fable 5.1, ohne eigene Messung, anhand der Modell-Metadaten:
[docs/gutachten-fable-primeline-optimierung-2026-09-03.md](gutachten-fable-primeline-optimierung-2026-09-03.md).

Zentrale Punkte: Beide Konvertierungen liegen unquantisiert in fp16 bei 1,2 GB.
6-bit-LUT-Palettisierung könnte auf rund 480 MB drücken (wie v3s `Encoder_v2.mlmodelc`),
bei geschätzt 0,1–0,3 WER-Punkten Verlust – ohne Training, mit `coremltools.optimize`
in Minuten machbar. Die E5RT-Warnung beim Laden ist ein **Leistungsdefekt**, kein
Datendefekt: Eine `slice_by_index`-Operation mit Nulldimension (vermutlich NeMos
Cache-aware-Pfad oder das Positional-Encoding) zwingt CoreML, diese eine Stelle auf
CPU statt ANE zu legen – das Transkript bleibt vollständig, aber jede Partitionsgrenze
kopiert Aktivierungen. Ein Engineering-Fork (Palettisierung, sauberer ANE-Graph,
Fenster-Stitching mit Überlappung statt hartem Schnitt) lohnt sich mit 1–3 Tagen
Aufwand; ein Neutraining nicht (GPU-Tage für vielleicht 1–2 Punkte).

## Weitere deutsche Parakeet-Varianten (04.09.2026)

Recherchiert mit agy, um sicherzugehen, dass primeline nicht übersehen lässt, was
schon existiert:

| Modell | Basis | Trainingsdaten | WER | Eignung für uns |
|---|---|---|---|---|
| `Mediform/parakeet-medical-de` | v3, volles Fine-Tuning | 117 h medizinisch (`Mediform/medical_asr_de`) | 11,3 % (Fachdomäne) | Domänenspezialist, ungeeignet |
| `johannhartmann/parakeet_de_med` | v3, PEFT (Decoder/Joint) | 976 synth. Arztbriefe | 3,3 % (Fachdomäne) | Domänenspezialist, ungeeignet |
| `nvidia/stt_de_fastconformer_hybrid_large_pc` | eigenständig, 115M | 2500 h (Common Voice, MLS, VoxPopuli) | 5,4 % Common Voice | andere Architektur, kleiner, nicht Parakeet |
| **`primeline/parakeet-primeline`** | v3, Daten nicht offengelegt | vermutlich `flozi00/asr-german-mixed` (CV, MLS) | **2,95 %** (Ø Tuda-De/MLS/CV19) | **gewählt** |

Öffentliche Vergleichstabelle (`flozi00/asr-german-mixed-evals`), WER in Prozent:

| Modell | Gesamt | Tuda-De | MLS | Common Voice 19 |
|---|---|---|---|---|
| `primeline/whisper-large-v3-turbo-german` | 2,62 | 6,37 | 2,06 | 3,22 |
| `nyrahealth/CrisperWhisper` | 2,68 | 5,17 | 2,85 | 1,90 |
| `primeline/whisper-large-v3-german` | 2,76 | 7,78 | 2,12 | 3,31 |
| **`primeline/parakeet-primeline`** | **2,95** | **4,11** | 2,60 | 3,03 |
| `openai/whisper-large-v3` (Basis) | 3,28 | 7,86 | 2,85 | 3,46 |
| `nvidia/parakeet-tdt-0.6b-v3` (Basis) | 3,64 | 7,05 | 2,95 | 3,70 |

Auf **Tuda-De** – akustisch variable, realitätsnahe Aufnahmen, am nächsten an
YouTube-Vortragston – liegt primeline mit 4,11 % klar vor jedem Whisper-Modell. Bei
vorgelesener Hörbuch-/Studiosprache (MLS, Common Voice) liegen spezialisierte
Whisper-Turbo-Fine-Tunes knapp davor. `2_95_WER.nemo`, der Dateiname von primelines
Checkpoint, bezieht sich auf den Gesamtdurchschnitt „All" aus dieser Tabelle.

**Nutzervorgabe (04.09.2026):** Whisper-Wege werden nicht mehr weiterverfolgt oder
gemessen, die Recherche konzentriert sich auf Parakeet und dessen Ableitungen. Bei
einem deutschen Parakeet-Derivat gilt ValentinWeyer als bevorzugte Wahl.

## Empfohlene OpenRouter-Modelle: Antwort, Zeit bis zum ersten Token, Kosten (05.09.2026)

Anlass: Michaels Bericht „nur luna scheint zu gehen, alle anderen Modelle haben nicht
funktioniert, deepseek flash geht z. B. nicht“, ohne Fehlertext. Gemessen mit dem
Anfragekörper aus `lib/openrouter.ts` (stream, usage, reasoning minimal) über den
DiktaGo-Schlüssel, zwei Läufe: kurzer Prompt (zwei Sätze) und ein Transkript von rund
214.000 Zeichen (60.000 bis 110.000 Token je Tokenizer). **Alle 18 Kandidaten
antworteten in beiden Läufen mit HTTP 200 und Text**, auch deepseek-v4-flash. Der
Fehler liegt also nicht am Anfragekörper und nicht am Modell; er ist ohne Michaels
Fehlertext nicht zuzuordnen.

| Modell | 1. Token kurz | 1. Token lang | Kosten lang | Eingabe $/M |
|---|---|---|---|---|
| openai/gpt-5.6-luna | 1,9 s | 4,0 s | 0,015 $ | 0,20 |
| google/gemini-3.8-flash | 2,2 s | 6,6 s | 0,052 $ | 0,75 |
| google/gemini-3.5-flash-lite | 1,3 s | 2,5 s | 0,021 $ | 0,30 |
| z-ai/glm-5.3-flash | – | 5,4 s | 0,005 $ | ≈ 0,07 |
| nvidia/nemotron-3-nano-30b-a3b | 1,7 s | 5,2 s | 0,003 $ | 0,05 |
| openai/gpt-5-nano | 3,1 s | 3,0 s | 0,003 $ | 0,05 |
| qwen/qwen3.7-flash | 3,5 s | 8,0 s | 0,007 $ | 0,03 |
| deepseek/deepseek-v4-flash | 3,5 s | 10,7 s | 0,009 $ | 0,08 |
| anthropic/claude-haiku-4.5 | 2,0 s | 5,2 s | 0,084 $ | 1,00 |
| z-ai/glm-5.3 | – | 4,9 s | 0,093 $ | ≈ 1,4 |
| openai/gpt-5.6-sol | 2,4 s | 5,1 s | 0,151 $ | 2,00 |
| anthropic/claude-sonnet-5 | 1,4 s | 4,8 s | 0,223 $ | 2,00 |
| qwen/qwen3.8-flash | 2,8 s | 12,2 s | 0,010 $ | 0,15 |
| qwen/qwen3.7-plus | 27,3 s | 21,1 s | 0,022 $ | 0,32 |
| z-ai/glm-5.1 | 9,4 s | 11,2 s | 0,062 $ | 0,97 |
| z-ai/glm-5.2 | – | 13,9 s | 0,048 $ | – |
| z-ai/glm-4.7-flash | 31,6 s | – | – | 0,06 |
| qwen/qwen3.5-35b-a3b | 3,5 s | – | – | 0,31 |

Folgerungen für `EMPFEHLUNG`: „schnell“ = erstes Token nach höchstens 7 s im langen
Lauf, „günstig“ = Eingabe höchstens 0,10 $/M. Gestrichen: qwen3.7-plus (21 s),
glm-4.7-flash (32 s), qwen3.8-flash (teurer und langsamer als qwen3.7-flash; die alte
Marke „günstig“ neben 0,54 ¢ je Anfrage widersprach dem „schnell“ neben 0,12 ¢).
Gemini 3.7 Flash durch 3.8 Flash ersetzt (gleicher Preis, kürzere Zeit). Aus Brave Leos
Liste übernommen: GLM (5.3 Flash und 5.3 statt Leos 4.7 Flash und 5.1, beide dort
gemessen langsamer), Nemotron 3 Nano 30B, Claude Haiku 4.5; Qwen 3.5 35B nicht, weil
qwen3.7-flash billiger ist und 1M Kontext hat. Kein Modell überschritt die 30 s, nach
denen Chrome einen untätigen Service Worker beendet; der Wachhalter in
`handleChatPort` ist trotzdem eingebaut, weil ein Denkmodell mit hoher Stufe die
Grenze reissen kann.

## Chat durch die Extension: acht Modelle, Reasoning high (06.09.2026)

Ergänzung zur Tabelle oben: dort lief die API direkt, hier der ganze Weg der Extension
(Content-Script → Port → Service Worker → OpenRouter), headless mit Playwright, Knopf
„In Kürze“, Transkript des NK-Videos 9D-xzper0wQ, Reasoning high.

| Modell | Dauer bis Ende | Zeichen |
|---|---|---|
| openai/gpt-5.6-luna | 11,1 s | 788 |
| deepseek/deepseek-v4-flash | 8,1 s | 812 |
| google/gemini-3.8-flash | 15,1 s | 954 |
| z-ai/glm-5.3-flash | 9,1 s | 895 |
| nvidia/nemotron-3-nano-30b-a3b | 10,1 s | 451 |
| anthropic/claude-haiku-4.5 | 49,4 s | 471 |
| qwen/qwen3.7-flash | 61,5 s | 1083 |
| openai/gpt-5-nano | 85,8 s | 494 |

Alle acht ohne Fehlerelement und ohne pageerror. Die Marken „schnell“ in der
Empfehlung gelten für Reasoning minimal; mit high denken Haiku, Qwen Flash und
GPT-5 Nano 50 bis 86 s, bevor Text kommt – länger als Chromes 30-s-Leerlaufgrenze für
den Service Worker. Der Wachhalter in `handleChatPort` ist damit kein Vorsichtscode
mehr, sondern notwendig.

## Android-App – was gemessen ist und was nicht (18.09.2026)

**Gemessen, in der Entwicklungsumgebung, an den entpackten Paketen und an der erzeugten
Vorlage – nicht aus Doku abgeschrieben:**

- Versionen am 17./18.09.2026: `@capacitor/core|cli|android` **8.5.2**,
  `@capacitor/preferences` 8.0.1, `@capacitor/filesystem` 8.1.3,
  `@capacitor/app-launcher` 8.0.1, `@capgo/capacitor-share-target` 8.0.53 (MPL-2.0,
  peer `@capacitor/core >=8.0.0`). `@capacitor/cli` verlangt `node >=22`.
- Aus dem von `cap add android` erzeugten Projekt: **minSdk 24, compileSdk 36,
  targetSdk 36**, AGP **8.13.0**, Gradle-Wrapper **8.14.3**, `MainActivity` in Java,
  `launchMode="singleTask"`, Permissions ab Werk nur `INTERNET`.
- **pnpm-Workspace und Capacitor vertragen sich ohne Hoisting.** `cap add android` fand
  alle vier Plugins über die pnpm-Symlinks (`@capacitor/app-launcher`,
  `@capacitor/filesystem`, `@capacitor/preferences`, `@capgo/capacitor-share-target`).
  Kein `shamefully-hoist`, kein `node-linker=hoisted`. Bedingung: die Plugins stehen als
  direkte Abhängigkeit in `app/package.json`, und `cap` läuft aus `app/`.
- **Edge-to-Edge steht in Capacitor 8 woanders.** Nicht `android.adjustMarginsForEdgeToEdge`
  (das lehnen die Typen von 8.5.2 ab), sondern `plugins.SystemBars.insetsHandling`
  (`"native" | "css" | "disable"`, Vorgabe `"css"`) plus
  `initialViewportFitValueHint`. Abgelesen an `@capacitor/cli/dist/declarations.d.ts`.
- Der Spike-Build: 26 Module, `dist` rund 100 kB, ohne Minifier (sonst wäre der Grep in
  `verify-app-bundle.sh` blind).
- **Die APK baut** (GitHub Actions, 18.09.2026, `ubuntu-latest`, Temurin 21): `cap sync`
  plus `./gradlew assembleDebug` laufen ohne Eingriff durch, 2 Minuten 54. Das
  eingecheckte `android/`-Gerüst ist also vollständig. Stufe 2 von
  `verify-app-bundle.sh` – der Grep in die **entpackte APK** – ist damit ebenfalls
  gelaufen und bestanden: kein Native Messaging, kein fremder Endpunkt, beide erlaubten
  Gegenstellen vorhanden. Gemessen wurde nur der Bau, nicht das Verhalten: auf einem
  Runner läuft die App nicht, und YouTube antwortet Runner-IPs ohnehin oft mit
  `LOGIN_REQUIRED`.

**Ungeprüft – steht und fällt mit der Messung am Gerät:**

- Ob der signierte visionOS-Player-Call aus `CapacitorHttp` heraus JSON liefert. `yt-dlp`
  schafft ihn aus einem reinen HTTP-Client, aus einer Extension-Seite kam HTML – die App
  liegt dazwischen und ist nicht vorhersagbar. Das ist Messung A.
- Ob `openrouter.ai` und `api.eu.mistral.ai` CORS für den Origin `https://localhost`
  erlauben und ob `fetch` im System-WebView wirklich streamt (Messung B). Fällt Mistral
  durch, ist „Antwort kommt am Stück" die ehrliche Anzeige – kein Proxy, kein stilles
  Umschalten auf OpenRouter (§1, §3).
- Ob YouTube `https://localhost` als Embedder annimmt oder mit Fehler 153 antwortet
  (Messung C). `referrerpolicy` am iframe und das `<meta name="referrer">` sind gesetzt.
- Ob `getCurrentTime()` während eines Werbeeinschubs die Werbezeit meldet (Messung C).
- Ob die YouTube-App den Parameter `t=` aus einem `AppLauncher.openUrl` beachtet
  (Messung E).
- Ob Chromiums WebView-Ton als `USAGE_MEDIA` läuft – Voraussetzung dafür, dass der
  spätere Ton-Weg den eigenen Player überhaupt mitschneiden kann.

**Was dabei schon feststeht, ohne Gerät:** die Web Speech API gibt es im Android-WebView
nicht, der Weg aus `audio-live.ts` (Tab-Ton + `webkitSpeechRecognition`) ist dort also
keine Option. Und `setPlaybackRate` im eingebetteten Player nimmt nur Werte aus
`getAvailablePlaybackRates()` – der 8×-Trick der Erweiterung fällt weg, mehr als 2× wird
es nicht.

## `playwright install` hängt beim Entpacken, nicht beim Laden (18.09.2026)

Auf diesem Rechner (Apple M5, arm64, macOS 25.6) kommt `pnpm exec playwright install
chromium` nie zurück. Gemessen, weil zwei Hintergrundläufe zwei Stunden standen:

- **Netz ist es nicht.** `curl` holt dasselbe Archiv (130 MB) in gut zwei Minuten,
  ein Bereichsabruf liefert 2 MB in 1,2 s. Die Fortschrittsanzeige des Installers
  erreicht 100 %.
- **Platte ist es auch nicht.** `unzip` entpackt genau dieses Archiv in **1,6 s** zu
  303 MB.
- **Der Installer bleibt danach stehen.** Im Zielordner liegen 38 Dateien (624 kB),
  dann passiert nichts mehr – auch nicht nach neun Minuten, auch nicht mit
  `--force`, auch nicht ohne Sandbox des Bash-Werkzeugs. Abgebrochen wird er nur
  durch `timeout` (Exit 124).
- **Folge, wenn man ihn laufen lässt und abbricht:** ein halb entpacktes
  `Chromium.app` ohne `Chromium Framework`. Der Start stirbt dann mit `SIGABRT` und
  einer `dlopen`-Meldung – das sieht nach kaputtem Browser aus, ist aber der
  abgeschnittene Entpackvorgang.

Weg drumherum: Archiv mit `curl` holen, mit `unzip` an seinen Platz legen, die
Markierungen `INSTALLATION_COMPLETE` und `DEPENDENCIES_VALIDATED` daneben
anlegen. Schritt für Schritt im Kopf von `extension/scripts/ladeprobe.mjs`.
Danach lief die Ladeprobe für beide Builds durch: Extension geladen, Sidebar
gemountet, 0 unerwartete Meldungen.

**Die eigentliche Lehre ist aber nicht Playwright.** Beide Läufe standen zwei Stunden,
weil sie ohne Zeitgrenze gestartet wurden und eine `until`-Warteschleife ohne Timeout
auf den ersten wartete. Jeder lange Lauf gehört über `lauf.sh` mit `timeout`; ein
Wartezustand ohne obere Schranke ist kein Wartezustand, sondern ein Hänger.

## Code-Review des Android-Branches: drei Prüfer, derselbe Auftrag (21.09.2026)

DeepSeek (`dsh`), Codex (`gpt-5.6-sol`, medium) und Kimi (`k3`) bekamen wortgleich
denselben Auftrag (`_system/reviews/auftrag-codereview-android-branch-2026-09-21.md`):
109 Dateien, rund 4.000 Zeilen Diff gegen `main`. Rohausgaben in
`_system/reviews/laeufe-2026-09-21/`.

| | DeepSeek | Codex medium | Kimi k3 |
|---|---|---|---|
| Laufzeit | 3 min 20 s | 9 min 13 s | 20 min 04 s |
| Befunde gesamt | 7 | 6 | 8 |
| davon am Code bestätigt | 5 ganz, 1 teils | 5 | 7 |
| nur von diesem Prüfer, bestätigt | 2 | 4 | 4 |
| schwersten Fehler gefunden | ja | **nein** | ja |

**Der schwerste Fehler:** Das Teilen-Ziel der App las `text`/`subject`/`url`, das Plugin
sendet `title`/`texts`/`files`. Jede geteilte Video-ID wäre „KEINE" gewesen – Messung D
hätte am Gerät ein Artefakt gemessen. DeepSeek und Kimi fanden das, beide durch Lesen der
Plugin-Quelle in `node_modules`; Codex las alle 109 Dateien des Diffs, aber keine
Abhängigkeit, und fand es nicht.

**Nur Kimi:** zwei Blindstellen in `check.sh`; Doppelklick auf den Player hängt; Reste der
Capacitor-Vorlage (google-services im Gradle, FileProvider auf die Wurzel des externen
Speichers); zwei veraltete Stellen in `CLAUDE.md`.
**Nur Codex:** APK-Rechte wurden nie aus der APK gelesen (jetzt Stufe 2b mit `aapt2`);
`check.sh` prüfte Gegenstellen per Verbots- statt Positivliste; `videoIdAusText`
akzeptierte `notyoutube.com`; falscher Paketname im Instrumentationstest; fremdes
`iframe_api`-Skript im selben Dokument wie die Schlüsselfelder (offen, Architekturfrage).
**Nur DeepSeek:** Regex nimmt bei doppeltem `v=` das letzte; Teilstring-Treffer bei der
`INTERNET`-Prüfung.

Ein Widerspruch: DeepSeek meldete eine Cookie-Regression beim Abruf von `base.js`, Kimi
belegte „identisches Verhalten". Beide haben recht – der Pfad ist in der Praxis relativ
und damit same-origin; der Unterschied träte erst bei einem absoluten fremden Host auf.
Abgesichert, weil es eine Zeile kostet.

**Ein Fehlalarm, erst am 27.09.2026 erkannt.** Kimi meldete, der Kaltstart über das
Teilen-Ziel liefere nie ein Ereignis, weil das Share-Plugin nur `onNewIntent` auswertet –
belegt am Quelltext des Plugins. Das stimmt für das Plugin, aber nicht für die App:
`BridgeActivity.load()` in `@capacitor/android` 8.5.2 ruft selbst
`onNewIntent(getIntent())`, der Start-Intent kommt also an. Die am 21.09. eingebaute
Weiterleitung in `MainActivity` lieferte das Ereignis beim Kaltstart deshalb **doppelt**
(Capacitor hält Ereignisse ohne Zuhörer als Liste fest) und ist wieder entfernt. Die
Lehre für den Prüfervergleich: ein Befund, der an einer Abhängigkeit belegt ist, muss
auch an der Schicht darüber geprüft werden – das hat weder Kimi noch die Bewertung getan.

## Kommentare über youtubei/v1/next (26.09.2026)

Gemessen an `dQw4w9WgXcQ`, `9bZkp7q19f0`, `jNQXAC9IVRw`, `aqz-KE-bpKQ`, ohne Anmeldung
aus Node und angemeldet-los aus der gebauten Erweiterung (headless Chromium):

- Starttoken im `itemSectionRenderer` mit `sectionIdentifier: comment-item-section`
  der Watch-Seite; zwanzig Kommentare je Abruf. Der Text steht in
  `frameworkUpdates.entityBatchUpdate.mutations[].payload.commentEntityPayload`, der
  Baum trägt nur `commentKey`/`toolbarStateKey`.
- Formatierung als Läufe mit `startIndex`/`length` in UTF-16-Einheiten (😭 = 2):
  `styleRuns` (fett = `weightLabel: FONT_WEIGHT_MEDIUM`, `italic: true`),
  `commandRuns` (Zeitmarken als `watchEndpoint`, Erwähnungen, Links),
  `attachmentRuns` (Emojis als Bild; bei Unicode-Emojis ist `label` das Zeichen selbst,
  bei Kanal-Emojis ein Name wie `:yt-smile:`). Durchgestrichen nicht beobachtet.
- **„Top-Kommentare“ endet früh:** `aqz-KE-bpKQ` lieferte über Top 1128
  Hauptkommentare, über „Neueste“ 3775. Mit Antworten 5175 – genau so viele wie
  `yt-dlp --write-comments` (5175, YouTube zeigt „5.180“). 626 Abrufe, 123 s.
- Antworten haben einen eigenen Token unter `commentRepliesRenderer.subThreads`,
  „Mehr Antworten ansehen“ einen weiteren; `replyLevel` 2 kommt vor.

## Welche YouTube-Adressen die Sidebar bekommen (27.09.2026)

Gebaute Erweiterung, headless Chromium, nicht angemeldet. Transkript = Zeilen im
Transkript-Tab nach 12 s.

| Adresse | Sidebar | Transkript |
|---|---|---|
| `/watch?v=`, mit `&t=`, mit `&list=` | ja | ja |
| `youtu.be/…`, `/v/…`, `attribution_link`, `m.youtube.com` | ja (YouTube leitet auf `/watch` um) | ja |
| `/live/<id>` (Aufzeichnung) | **bis 0.9.2 nein**, jetzt ja | ja |
| laufender Livestream (`jfKfPfyJRdk`) | ja | „keine Untertitel“ |
| `/shorts/`, `/embed/`, `youtube-nocookie.com`, `music.youtube.com` | nein, gewollt | – |

## Dislikes aus Aufrufen und Likes schätzen (29.09.2026)

Daten: YouTube-Dislike-Archiv Ende 2021 (archive.org, ClickHouse-Spiegel
`clickhouse-public-datasets.s3.amazonaws.com/youtube/original/files/`), zwei Teildateien
vom 27.11.2021. Filter: ≥ 1000 Aufrufe, ≥ 50 Stimmen, ≥ 1 Like. Gelernt an 46 849
Videos, geprüft an 41 888 anderen. Skripte: `docs/tests/dislike-modell/`.

Dislike-Anteil (Median) je Like-Rate: 0,1 % → 19,8 %, 0,32 % → 9,6 %, 1 % → 5,1 %,
3,2 % → 2,6 %, 10 % → 1,4 %, 25 % → 0,5 %.

| Variante | Anteil-Fehler Median | Dislikes auf Faktor 1,5 | auf Faktor 2 |
|---|---|---|---|
| fester Anteil für alle (Basis) | 2,26 pp | 32 % | 51 % |
| Stufentabelle (0,1 in log10) | 1,88 pp | 38 % | 59 % |
| Logit-Gerade, kleinste Quadrate über alle | 1,77 pp | 36 % | 57 % |
| dieselbe + log10(Aufrufe) | 1,79 pp | 35 % | 57 % |
| **Logit-Gerade durch die Mediane (gewählt)** | 1,88 pp | 38 % | 59 % |

Gewählt: `logit = −5,6911 − 1,3943 · log10(Likes/Aufrufe)`. Die Kleinste-Quadrate-Gerade
liegt bei hohen Like-Raten zu tief (10 % → 0,84 % statt 1,4 %), weil Videos ohne jeden
Dislike den Logit nach unten ziehen. Aufrufe als zweite Grösse bringen nichts.
Grenze: Daten von 2021; ob sich das Like-Verhalten seither verschoben hat, ist ungemessen.

Auf der Seite, ungerundet: Likes aus `aria-label` des Like-Knopfs („bisher 110.047
positive Bewertungen“ / „along with 110,047 other people“), Aufrufe aus der Infozeile
vor dem „•“ („23.400.861 Aufrufe • 10.11.2014“). Gemessen an `aqz-KE-bpKQ`, de und en.
Ergebnis dort: Schätzung ≈ 9538 (92 % positiv), Return YouTube Dislike 18.609 (86 %).
