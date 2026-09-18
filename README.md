# YouTube Summary Chat

Chrome-Extension (Manifest V3), die auf YouTube-Videoseiten eine Chat-Sidebar in die
rechte Spalte oberhalb der Empfehlungen einhängt: mit dem Transkript chatten,
zusammenfassen, in Kapitel gliedern, übersetzen. Alle Zeitstempel sind anklickbar und
springen im Player an die Stelle.

Zwei Anbieter, einer davon gewählt: **OpenRouter** (Standard) oder **Mistral AI** direkt
(EU-Anbieter, Datenschutzoption). Kein dritter Cloud-Dienst, kein eigenes Backend, kein
Proxy, keine Telemetrie. Was bei Mistral fehlt, steht unter
[Anbieter wechseln](#anbieter-wechseln-openrouter-oder-mistral-ai).

**Android-App: im Entstehen.** In `app/` liegt eine eigenständige App (Capacitor), die
sich den Kern – KI-Clients, Prompts, Transkript-Abruf – über `shared/` mit der
Erweiterung teilt. Sie ist als Teilen-Ziel für YouTube-Links gedacht. Stand heute ist sie
ein **Messgerät**, kein Produkt: sie prüft auf einem echten Gerät die Annahmen, die
über ihren Aufbau entscheiden. Einstieg:
[docs/uebergabe-android-2026-09-18.md](docs/uebergabe-android-2026-09-18.md), Bedienung
in [app/README.md](app/README.md). Was daran ungeprüft ist, steht unter
[Was nicht geprüft ist](#was-nicht-geprüft-ist).

---

## Zwei Builds aus einer Codebase

| | `full` (GitHub, unpacked) | `store` (Chrome Web Store) |
|---|---|---|
| Untertitel-Transkript aus der Seite | ja | ja |
| Spracherkennung aus dem laufenden Ton | ja | ja |
| Tonspur herunterladen und transkribieren | ja | **nein** |
| Untertitel über yt-dlp holen | ja | **nein** |
| Permission `nativeMessaging` | ja | nein |
| Fallback-Code im Bundle | ja | **nein, nachgemessen** |

Der Unterschied ist der **Download**: den untersagen die Programmrichtlinien des Stores
ausdrücklich. Was im Arbeitsspeicher passiert, ist erlaubt – deshalb steht die
Spracherkennung aus dem laufenden Ton in beiden Builds, und im Store-Build ist sie der
einzige Weg zu einem Transkript, wenn Untertitel fehlen.

Der Store-Build enthält den Fallback nicht nur unsichtbar, sondern gar nicht: das
Build-Flag `__FALLBACK__` wird als Boolean-Literal eingesetzt, Rolldown entfernt den
toten Zweig samt der nur dort importierten Module. Nachprüfbar:

```bash
cd extension && pnpm run build && pnpm run build:store && ./scripts/verify-store-bundle.sh
```

Das Skript prüft das gebaute Bundle, nicht den Quelltext, und macht eine Gegenprobe gegen
den `full`-Build – sonst würde ein Test bestehen, der überhaupt nichts misst.

---

## Bedienung

Die Oberfläche sitzt **in der YouTube-Seite**, in der rechten Spalte über den
Empfehlungen. Sie lässt sich am Kopf einklappen, bleibt beim Wechsel zwischen Videos
stehen und folgt YouTubes Hell/Dunkel-Einstellung. Ein Klick auf das Symbol in der
Werkzeugleiste öffnet die Einstellungen.

**Breite:** Die Spalte ist ab Werk 500 px breit statt YouTubes 400 bis 490. Ziehen am
linken Rand der Sidebar verstellt sie, der Player weicht entsprechend zurück; eingeklappt
bekommt YouTube seine eigene Breite zurück. Der Regler in den Einstellungen tut dasselbe.
Wem die Schrift zu klein ist, stellt dort die **Schriftgrösse der Oberfläche** höher
(Default 110 %, Bereich 90–220 %).

**Modell wechseln im Chat:** Unter dem Eingabefeld steht klein das aktive Modell. Ein
Klick öffnet die empfohlene Auswahl mit Marken (schnell, günstig, schlau), Kontextgrösse
und dem ungefähren Preis je Anfrage; „Alle Modelle …“ führt in die Einstellungen. Die
Empfehlung ist gemessen, nicht geraten: jedes Modell hat am 05.09.2026 mit dem
Anfragekörper der Erweiterung und einem Prompt von rund 65.000 Token geantwortet,
„schnell“ heisst erstes Token nach höchstens 7 s. Bei Mistral AI führt der Knopf in die
Einstellungen, weil die Modellliste dort geladen wird.

**Das Symbol in der Werkzeugleiste** holt die Sidebar auf einer Videoseite hervor oder
klappt sie weg – in YouTubes eigener Spaltenbreite. Ausserhalb einer Videoseite öffnet es
die Einstellungen.

Die elf Knöpfe unterscheiden sich im Zweck, nicht in der Länge. Die obere Reihe
nimmt das ganze Video, die mittlere schneidet einen Zweck heraus, die untere hilft beim
Aneignen und Weiterverfolgen:

- **In Kürze** – was behauptet wird und wozu es kommt, höchstens sechs Sätze, ohne Zeitstempel.
- **Zusammenfassung** – zwei bis vier Absätze, je einer pro Thema, das Thema fett vorneweg.
- **Ausführlich** – jede Sachfrage als eigener Abschnitt, mit Zahlen, Namen, Zeitstempeln.
- **Kapitel** – Sprungmarken entlang des Videos, mit Aussage statt Themennamen.
- **Fakten** – Zahlen, Namen, Daten und Zitate als Liste, je Angabe ein Zeitstempel als Beleg.
- **Behauptungen** – bis zu 15 Behauptungen, je ein Absatz: die Behauptung fett, dann
  ihre Belegart (Gemessen, Quelle, Gezeigt, Erfahrung, Unbelegt) mit Zeitstempel.
- **Anleitung** – die Schritte in der Reihenfolge des Nachmachens, mit Befehlen, Werten
  und Zeitstempeln; was der Sprecher nur zeigt und nicht ausspricht, wird nicht erraten.
- **Pro/Contra** – Argumente beider Seiten mit ihren Belegen, dazu „Für wen",
  „Alternativen" und „Nicht geprüft", soweit das Video sie hergibt.
- **Vergleich** – stellt die im Video verglichenen Dinge als Tabelle gegenüber, dazu
  eine Kurzfassung je Seite und der eine Unterschied, an dem eine Entscheidung hängt.
  Vergleicht das Video nichts, sagt die Antwort das und bietet die Zusammenfassung an.
- **Begriffe** – Fachbegriffe, Methoden und Verfahren mit der Erklärung, die der Sprecher
  selbst gibt; erklärt er einen Begriff nicht, steht das da, statt Wissen zu ergänzen.
- **Lernfragen** – acht bis zwölf Fragen zum Stoff, jede mit der Antwort aus dem Video
  und der Zeitmarke, an der sie steht.

Passt ein Knopf nicht zum Video, sagt seine Antwort das in einem Satz – ausgeblendet wird
keiner, denn das liesse sich nur raten.

Die Leiste weicht, sobald etwas im Chat steht; das Zauberstab-Symbol in der Kopfzeile holt
sie zurück.

**Unter jeder Antwort** stehen Kopieren, Herunterladen und eine **Weltkugel**: sie
recherchiert dieselbe Frage im Internet, mit dem Videotitel als Kontext – eine Rückfrage
wie „ist das besser?" wäre für eine Suchmaschine sonst wertlos. Das kostet rund 0,007 $
je Anfrage zusätzlich, die Fundstellen stehen als Links unter der Antwort.

**Kopieren legt zwei Formate ab:** Markdown als Text und dasselbe als formatiertes HTML.
Word, Pages und Google Docs nehmen das HTML und behalten Überschriften, Listen und
Fettdruck, ein Editor nimmt den Markdown-Text. Das gilt auf allen drei Systemen, nicht nur
auf dem Mac.

**Im Transkript-Tab** filtert eine Suchzeile die Zeilen und hebt den Begriff hervor; hat
das Video mehrere Untertitelspuren, steht darüber die Sprachwahl.

**Tabellen in Antworten** passen sich der Spaltenbreite an: ab rund 380 px eine
gewöhnliche Tabelle, darunter eine Karte je Zeile mit vorangestellter
Spaltenüberschrift – eine dreispaltige Tabelle bliebe in der schmalen Sidebar sonst
unlesbar.

Eine Ausgabe in Chromes Seitenleiste gab es zwischenzeitlich; sie ist entfernt, weil
Vivaldi jede Extension mit der Permission `sidePanel` ungefragt in seine Panel-Leiste
einträgt (Bug VB-123452) – aus der Extension heraus nicht verhinderbar.

---

## Installation

### Voraussetzungen

Node 20+, pnpm. Für den Audio-Fallback zusätzlich Python 3.10+, yt-dlp und ffmpeg;
sherpa-onnx und das deutsche Modell (rund 670 MB) richtet der Installer selbst ein.

### Bauen

```bash
cd extension
pnpm install
pnpm run build
```

Das Ergebnis liegt sichtbar im Projekt: **`build-full/`** (und `build-store/`), nicht in
einem versteckten Ordner.

Für die Store-Variante:

```bash
pnpm run build:store
```

### Laden

1. `chrome://extensions` öffnen
2. Entwicklermodus einschalten
3. „Entpackte Erweiterung laden“ → **`build-full`** (der Ordner mit der `manifest.json`)
4. Symbol anheften, dann auf einer YouTube-Videoseite anklicken

Der `full`-Build bringt einen öffentlichen Schlüssel im Manifest mit und hat deshalb
immer dieselbe Extension-ID: **`abblpkhijcggklokijkhfbkgeljmimpm`**. Ohne den würde Chrome
die ID aus dem Installationspfad ableiten, und die Native-Messaging-Registrierung wäre
nach jedem Verschieben des Ordners ungültig.

### API-Key eintragen

Einen Key auf [openrouter.ai/keys](https://openrouter.ai/keys) anlegen, in den
Einstellungen der Extension eintragen und mit „Testen“ prüfen – der Knopf fragt
`/api/v1/key` ab und zeigt Verbrauch und Limit.

Der Key liegt in `chrome.storage.local` und geht ausschliesslich an `openrouter.ai`.

### Anbieter wechseln: OpenRouter oder Mistral AI

Ganz oben in den Einstellungen steht der Abschnitt **Anbieter** mit zwei Wahlmöglichkeiten:
„OpenRouter (Standard)“ und „Mistral AI – EU-Anbieter, Datenschutzoption“. Bei Mistral
gehen alle Chat-Anfragen direkt an Mistral, nicht über OpenRouter – voreingestellt an den
EU-Endpunkt `api.eu.mistral.ai` (Inferenz garantiert in der EU, laut Mistral rund 10 %
Aufpreis), umschaltbar auf den globalen `api.mistral.ai`; der Schlüssel
kommt von [console.mistral.ai](https://console.mistral.ai), wird mit „Schlüssel prüfen“
gegen `/v1/models` getestet, und „Modelle laden“ füllt die Modellauswahl aus derselben
Liste (nur Chat-Modelle, keine abgekündigten). Ohne gewähltes Modell schickt die Sidebar
nichts ab und sagt das. Der jeweils andere Zugang bleibt gespeichert, der Wechsel ist ein
Klick.

**Was bei Mistral fehlt – bewusst, nicht heimlich:**

- **Internetsuche.** Sie ist OpenRouters Web-Plugin. Der Schalter am Eingabefeld ist bei
  Mistral gesperrt und trägt den Hinweis „nur mit OpenRouter“; die Weltkugel unter den
  Antworten erscheint nicht.
- **Kostenanzeige.** Mistrals API liefert keine Preise und keinen Betrag je Antwort; es
  werden nur die Token gezeigt, kein geratener Betrag.
- **Reasoning-Regler.** Ein OpenRouter-Parameter; Mistral bekommt ihn nicht gesetzt.
- **Spracherkennung aus dem laufenden Ton** und der OpenRouter-Weg des Audio-Fallbacks
  laufen weiter über OpenRouter und brauchen dessen Schlüssel. Wer nur Mistral eingetragen
  hat, sieht das am Knopf.

Kein Fallback zwischen den beiden: fällt der gewählte Anbieter aus, steht die Fehlermeldung
im Chat, es wird nicht still umgeschaltet.

---

## Native Messaging einrichten (nur `full`)

Nötig nur, wenn Videos ohne Untertitel über die Tonspur transkribiert werden sollen.

Der Installer erledigt auf allen Plattformen dasselbe: Er legt ein eigenes Python-venv
an und installiert dort `sherpa-onnx` und `numpy` (ein venv, weil Homebrew-Python kein
`pip install` ins System erlaubt und der Host so nicht davon abhängt, welches `python3`
Chrome gerade findet), lädt die vier Dateien des deutschen Modells
`x-ian/sherpa-onnx-parakeet-primeline-de-int8` von Hugging Face (rund 670 MB, davon
652 MB Encoder; bereits vorhandene Dateien werden übersprungen) und schreibt einen
Wrapper, der den Host mit dem venv-Python startet. Beides liegt ausserhalb des Projekts
an einem festen Ort – das Modell, damit es nur einmal geladen wird, das venv, damit es
weder in git noch in einen Dropbox-Sync gerät:

| Plattform | Basisordner (darin `venv/` und `parakeet-primeline-de/`) |
|---|---|
| macOS | `~/Library/Application Support/yt-summary-chat/` |
| Windows | `%LOCALAPPDATA%\yt-summary-chat\` |
| Linux | `$XDG_DATA_HOME/yt-summary-chat/` (sonst `~/.local/share/yt-summary-chat/`) |

### macOS und Linux

```bash
brew install yt-dlp ffmpeg             # Linux: Paketverwaltung der Distribution
uv tool install parakeet-mlx -U        # nur für die Route Parakeet MLX, nur Apple Silicon
cd native-host && ./install-macos.sh
```

Danach Chrome einmal neu starten. Das Skript legt das Host-Manifest unter
`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` (Linux:
`~/.config/google-chrome/` bzw. `~/.config/chromium/`) an und erzeugt den Wrapper
`run-host.sh`, der zusätzlich einen brauchbaren `PATH` setzt – Chrome startet den Host
ohne Login-Profil, weshalb Homebrew und uv sonst schlicht fehlen. Ist `uv` vorhanden,
installiert das Skript die Pakete damit, sonst mit `pip`; das Ergebnis ist dasselbe.

Weicht die Extension-ID ab (eigener Build ohne den Schlüssel), als Argument übergeben:

```bash
./install-macos.sh <extension-id>
```

### Windows

```powershell
winget install yt-dlp.yt-dlp
winget install ffmpeg
cd native-host
powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
```

Gleicher Ablauf: venv und Modell unter `%LOCALAPPDATA%\yt-summary-chat\`, Batch-Hülle
`run-host.bat`, Registrierung über `HKCU`.

**Ungetestet** – siehe „Was nicht geprüft ist“.

### Prüfen

Die Options-Page zeigt den Host-Status grün oder rot samt Fehlertext und meldet, welches
Werkzeug fehlt. Direkt auf der Kommandozeile:

```bash
cd native-host && python3 selfcheck.py
```

Unter Windows: `py selfcheck.py`.

Die letzten beiden Prüfungen gelten der Standardroute: Sie lesen aus dem Wrapper
(`run-host.sh` bzw. `run-host.bat`), welches Python und welchen Basisordner Chrome
tatsächlich bekommt, starten genau dieses Python mit `import sherpa_onnx, numpy` und
verlangen die vier Modelldateien in genau diesem Ordner. Fehlt der Wrapper, sagt die
Ausgabe, dass der Installer noch nicht gelaufen ist.

---

## Transkript-Quellen

### Untertitel direkt von YouTube

Der Normalfall, in beiden Builds, ohne Zusatzsoftware und ohne Kosten. Er war nicht
selbstverständlich: die `baseUrl` aus dem HTML der Watch-Seite ist unbrauchbar – sie
beantwortet jeden Abruf mit **HTTP 200 und leerem Body**, anonym wie angemeldet, in allen
Formatvarianten.

Brauchbar ist nur die **signierte** URL aus einer Player-Antwort des visionOS-Clients.
Damit YouTube die herausgibt, müssen vier Dinge stimmen – fehlt eines, kommt
`playabilityStatus: LOGIN_REQUIRED` („Melde dich an, damit wir sehen, dass du kein Bot
bist"), selbst beim angemeldeten Nutzer:

1. `signatureTimestamp` aus YouTubes `base.js`
2. Header `X-Goog-Visitor-Id` mit dem `visitorData` der Seite
3. `userAgent` **im Kontext-Objekt** (ein Safari-String)
4. kein `key=`-Parameter an der URL

Am 01.09.2026 gemessen: 31 Spuren, signierte URL, **46.010 Zeichen** Untertitel-JSON,
**mit und ohne Cookies**. In der Sidebar: 286 Zeilen mit anklickbaren Zeitstempeln.

Bei Videos mit vielen Community-Untertiteln entscheidet YouTubes eigene Vorauswahl
(`defaultCaptionTrackIndex`), welche Spur „Auto" bedeutet – ohne sie landet man bei der
alphabetisch ersten, im Test Arabisch statt Englisch.

Welche Spur genommen wird, steuert die Einstellung „Untertitelsprache"; alle vorhandenen
Spuren stehen im Transkript-Tab zur Wahl. Auf `/shorts/`-Seiten hängt sich die Sidebar
gar nicht erst ein.

### Wenn das nicht reicht

Zwei Rückfälle, in dieser Reihenfolge, beide nur im `full`-Build und nur auf Klick:

**YouTubes Transkript-Panel im DOM.** Läuft automatisch als zweiter Versuch. Im Test hat
er nie geliefert – der Klick auf „Transkript anzeigen" öffnet weder programmatisch noch
mit echtem Nutzerklick etwas. Er bleibt drin, weil er nichts kostet. Zwei Fallstricke sind
darin abgesichert: YouTube hält zwei identische Segmentlisten im DOM (eine unsichtbar, ein
Selektor über das Dokument verdoppelt das Transkript still), und im Hintergrundtab lädt
das Panel nie – der Code wartet auf einen sichtbaren Tab und sagt das auch.

**Untertitel über yt-dlp.** Kostenlos, mit YouTubes Zeitstempeln, ohne Audio-Download:

```
yt-dlp --write-subs --write-auto-subs --sub-langs <Sprache> --sub-format json3 --skip-download
```

Gemessen: 286 Segmente, 18.430 Zeichen. Der Notnagel für den Fall, dass YouTube den
Browser-Weg wieder zumacht.

### Spracherkennung aus dem laufenden Ton (beide Builds, nur auf Klick)

Hat ein Video keine Untertitel, steht in beiden Builds der Knopf **„Transkript per
Spracherkennung erstellen"**. Das Video läuft dabei stumm mit vierfacher Geschwindigkeit,
der Ton wird über `video.captureStream()` im Arbeitsspeicher mitgelesen, in Stücken von
zwei Videominuten an OpenRouter geschickt und danach verworfen. Es entsteht keine Datei.

Der Zeitgewinn kommt aus `preservesPitch = false`: die beschleunigte Wiedergabe ist dann
eine reine Zeitkompression samt Frequenzverschiebung. Zurückgerechnet wird sie, indem die
WAV-Daten mit einem Viertel der Aufnahmerate deklariert werden – aus 44.100 aufgenommenen
Abtastwerten je Sekunde wird ein 11.025-Hz-Signal in Videozeit. Kein Resampling, keine
Signalverarbeitung.

Faktor 4 ist gemessen die Grenze (siehe [docs/messungen.md](docs/messungen.md)): das
Nutzband sinkt auf 6 kHz, was die Erkennung kaum trifft. Bei Faktor 8 blieben 3 kHz, und
die Wortfehlerrate sprang von 3,2 auf 33,0 Prozent, weil das Modell in die falsche Sprache
kippt. Erkannt wird mit `openai/whisper-large-v3-turbo` – die einzige Route, die über
OpenRouter Zeitstempel liefert.

Vier Fälle sind abgefangen: Werbung läuft im selben `<video>`-Element (die Erkennung
wartet sie ab und übernimmt weder ihren Ton noch ihre Länge), YouTube setzt die
Wiedergabegeschwindigkeit gelegentlich zurück (sie wird nachgezogen), ein Videowechsel
bricht den Lauf ab, und geschützter Ton kommt als Stille an (nach 15 Sekunden Stille
bricht der Lauf mit einer klaren Meldung ab). Wiedergabeposition, Tempo, Ton und
Pausenzustand werden danach in jedem Fall wiederhergestellt, auch bei Abbruch und Fehler.

Ein 30-Minuten-Video braucht so gut sieben Minuten. Der `full`-Build hat dafür den
schnelleren Weg:

### Audio-Fallback (nur `full`, nur auf Klick)

Im `full`-Build lädt yt-dlp auf Klick die Tonspur, ffmpeg wandelt sie nach Opus (Faktor 10
kleiner als WAV: fünf Minuten sind 0,9 MB statt 9,6 MB), dann übernimmt eine von vier
Routen. Der Host macht die gesamte Arbeit und liefert nur Text zurück – Native Messaging
begrenzt eine Nachricht auf 1 MB, base64-Audio sprengt das bei jedem Video von mehr als
ein paar Sekunden. Ab zehn Minuten wird in Abschnitte geteilt und der Zeitversatz addiert.

| Route | Ort | Preis | Zeitstempel |
|---|---|---|---|
| `openai/whisper-large-v3-turbo` | OpenRouter | ~$0,012/h | **ja**, Segmente |
| `nvidia/parakeet-tdt-0.6b-v3` | OpenRouter | ~$0,09/h | **nein** |
| `parakeet-mlx` (`parakeet-tdt-0.6b-v3`) | lokal, Apple Silicon | kostenlos | **ja**, Sätze |
| `parakeet-primeline` (Standard) | lokal, macOS/Windows/Linux, CPU | kostenlos | **ja**, je 120-s-Fenster |

**parakeet-primeline** ist die Voreinstellung: das deutsche Modell
`x-ian/sherpa-onnx-parakeet-primeline-de-int8` (ONNX int8, rund 670 MB), das über das
Python-Paket `sherpa-onnx` auf der CPU läuft. Der Installer legt dafür ein venv an und
lädt das Modell, beides in den Basisordner aus der Tabelle unter „Native Messaging einrichten“;
fehlt eines von beidem, meldet der Host das mit Ablageort und Bezugsquelle statt still zu
scheitern. Warum ein deutsches Spezialmodell: parakeet v3 erkennt die Sprache selbst und
kippt bei deutschen Vorträgen mit englischen Zitaten ins Englische; gemessen am
TEDx-Vortrag `9CZBIaaiPRI` liegt primeline bei 3,8 % Wortfehlern (Details in
[docs/messungen.md](docs/messungen.md)). Auf gemischtem DE/EN-Material kehrt sich das um,
deshalb bleiben beide Modelle wählbar.

Die drei übrigen sind am 01.09.2026 real gemessen, nicht aus der Dokumentation abgeschrieben:

- **whisper-large-v3-turbo** akzeptiert `response_format: "verbose_json"` zusammen mit
  `timestamp_granularities: ["segment"]` und liefert echte Segmente – bei fünf Minuten
  Vortragsaudio 46 Stück, erstes bei 4,36 s, letztes bei 297,9 s. Kosten für den Lauf:
  $0,000999. Funktioniert mit und ohne Provider-Pin auf Groq.
- **parakeet-tdt-0.6b-v3** lehnt `verbose_json` mit HTTP 400 ab, im Wortlaut: *„The
  selected model does not support response_format verbose_json. Use json instead."*
  Diese Route liefert nur Text. Die Sidebar bietet dafür konsequent keine Sprungmarken an
  und sagt das auch – sie tut nicht so, als gäbe es welche.
- **parakeet-mlx** (senstella/parakeet-mlx, Apache-2.0) schreibt
  `{"text": …, "sentences": [{text, start, end, duration, confidence, tokens}]}`;
  `start` und `end` kommen als **Strings**. 42 Sätze über dieselben fünf Minuten. Es gibt
  keinen HTTP-Server – der Host ruft das CLI direkt auf.

Die Preiseinheit weist OpenRouter nicht aus: derselbe Wert `pricing.prompt` steht mal für
Sekunden (whisper-turbo/DeepInfra `0.00000333`), mal für Minuten
(parakeet-v3/Together `0.0015`), mal für Stunden (whisper-turbo/Groq `0.04`). Die
Options-Page rechnet daher über eine Grössenordnungs-Heuristik auf $/h um und stellt den
Rohwert samt vermuteter Einheit daneben, damit die Zahl nachprüfbar bleibt.

### Wörterbuch gegen verhörte Eigennamen

Automatische Untertitel und Spracherkennung verhören Namen zuverlässig: aus „Claude Code"
wird „Cloud Code", aus „DiktaGo" wird „Dikta Go". Ein Prompt hilft dagegen nur der
Chat-Antwort – im Transkript selbst, das im Transkript-Tab steht und exportiert wird,
bliebe der Fehler stehen.

In den Einstellungen steht deshalb ein Wörterbuch, eine Zeile je Eintrag:

```
Cloud Code => Claude Code     ersetzt das Linke durch das Rechte
DiktaGo                       setzt nur diese Schreibweise durch
# Zeile mit Raute             Kommentar
```

Angewendet wird es auf jedes Transkript, egal aus welcher Quelle, und zwar zeilenweise
beim Übernehmen – dadurch stimmt die Schreibweise auch im Export, im Prompt und in der
Übersetzung, und kein Begriff wird über eine Zeilengrenze hinweg ersetzt. Zusätzlich
nennt der System-Prompt genau die Begriffe, die im Transkript tatsächlich vorkommen.

Übernommen sind die beiden sicheren Stufen aus DiktaGo. Dessen Fuzzy-Stufen (ein
vertauschter Buchstabe, Kölner Phonetik) fehlen bewusst: sie brauchen ein Veto der
Rechtschreibprüfung, das es im Browser nicht als API gibt. Ohne dieses Veto wurde in
DiktaGos eigener Messung an 25.193 Wörtern aus „Kind" ein „Contao" und aus „Bild" ein
„Build". Wer einen Begriff gegen ein echtes Wort durchsetzen will, trägt ein
Ersetzungspaar ein.

Die Schreibweise ist nur am Wortanfang verankert, damit deutsche Endungen sie nicht
verfehlen: aus „Neuroenergetische" wird „NeuroEnergetische", die Endung bleibt. Bei
Ersetzungspaaren gilt die Verankerung an beiden Enden – sonst griffe „the" in „theater".

### Nicht enthaltene Routen

- **Parakeet ONNX (Intel-Mac):** `achetronic/parakeet` veröffentlicht ausschliesslich
  `parakeet-linux-amd64` und `parakeet-linux-arm64` – kein darwin-Build. Ein Intel-Mac zum
  Testen stand nicht zur Verfügung. Intel-Nutzer nehmen die beiden Cloud-Routen.
- **DiktaGo:** Die App ist von aussen nicht ansprechbar. `Info.plist` enthält kein
  `CFBundleURLTypes`, sie läuft als `LSUIElement` ohne Fenster, und das einzige
  CLI-Target ist ein LLM-Benchmark ohne STT-Einstieg. Die lokale Route `parakeet-mlx`
  benutzt ohnehin dasselbe Modell (`parakeet-tdt-0.6b-v3`) und braucht DiktaGo nicht.

---

## Übersetzen

Zwei Wege, umschaltbar in den Einstellungen:

**OpenRouter (Standard).** Das komplette Transkript geht durch das Modell, Absätze und
Zeitstempel bleiben stehen, keine Zusammenfassung, keine Kürzung.

**Chrome lokal.** Chromes eingebaute Translator API (stabil ab Chrome 138), kostenlos, auf
dem Gerät, ohne Netz zum Anbieter. Übersetzt wird zeilenweise – nur der Text jeder
Untertitelzeile geht durchs Modell, der Zeitstempel wird gar nicht erst angefasst.
Zeitstempeltreue ist hier also strukturell garantiert statt nur erbeten. Dafür trifft ein
NMT-Modell Fachbegriffe schlechter als ein Sprachmodell, deshalb bleibt OpenRouter die
Vorgabe. Die Option erscheint nur, wenn die API vorhanden und das Sprachpaar verfügbar ist.

Der Aufruf läuft im Content-Script, nicht im Service Worker: die Translator API steht in
Web Workers nicht zur Verfügung.

**Eine Eigenheit, über die man stolpert:** solange das Sprachmodell noch nicht geladen ist,
verlangt `Translator.create()` eine **Nutzergeste**, sonst kommt
*„NotAllowedError: Requires a user gesture when availability is 'downloading' or
'downloadable'."* Jedes `await` vor dem Aufruf verbraucht die Geste des Klicks. Der
Übersetzen-Knopf ruft deshalb keinen dynamischen Import und keine Verfügbarkeitsprüfung
mehr auf – die läuft vorab – und `create()` ist der erste `await` im Handler.

Gemessen am selben 19-Minuten-Video: **286 Zeitstempel, 22.507 Zeichen** vollständige
deutsche Fassung, rund drei Minuten, davon 160 Sekunden Modell-Download beim ersten Mal.
Der Download-Fortschritt wird angezeigt, weil 160 Sekunden ohne Rückmeldung wie ein
Hänger aussehen.

---

## Permissions und warum

| Permission | Wofür | Build |
|---|---|---|
| `storage` | API-Key, Einstellungen, System-Prompt, Chatverlauf pro Video. Alles in `chrome.storage.local`, nichts verlässt das Gerät ausser den Modellanfragen selbst. | beide |
| `*://*.youtube.com/*` | Die Sidebar in die Videoseite einhängen, die Untertitelspuren der Seite lesen, die Wiedergabeposition beim Klick auf einen Zeitstempel setzen. | beide |
| `https://openrouter.ai/*` | Cloud-Gegenstelle Nummer eins (Standard): Chat, Modellliste, Key-Prüfung und – bei Videos ohne Untertitel – kurze Tonabschnitte aus dem Arbeitsspeicher zur Spracherkennung. | beide |
| `https://api.eu.mistral.ai/*`, `https://api.mistral.ai/*` | Cloud-Gegenstelle Nummer zwei (EU-Endpunkt voreingestellt) (nur wenn gewählt): Chat, Modellliste, Schlüsselprobe. Angesprochen wird sie ausschliesslich, wenn in den Einstellungen Mistral AI gewählt ist. | beide |
| `nativeMessaging` | Den lokalen Helfer für den Audio-Fallback starten. Nur nach ausdrücklichem Klick, nie automatisch. | nur `full` |

Es gibt keine weiteren Host-Permissions, kein `tabs`, kein `<all_urls>`, kein
`webRequest`, kein `scripting`.

**Nicht enthalten:** Telemetrie, Analytics, Tracking, Fehlerberichte an Dritte,
automatische Downloads.

---

## Was nicht geprüft ist

Ehrlichkeit vor Vollständigkeitsmeldung – diese Punkte sind gebaut, aber nicht verifiziert:

- **Die Android-App, vollständig.** Sie ist in dieser Entwicklungsumgebung weder baubar
  noch startbar: `dl.google.com` (Android-SDK) und `youtube.com` sind dort gesperrt.
  Gebaut, installiert und gemessen wird am Mac. Was der erste Lauf klären soll, steht in
  [docs/messungen.md](docs/messungen.md) unter „Android-App"; solange dort nichts mit
  Gerät und Android-Version steht, ist über das Verhalten der App nichts bekannt.
  Geprüft ist bisher nur, was ohne Gerät geht: Typprüfung, Bundle-Bau, der Grep gegen
  das gebaute Bundle und die Selbstprüfung des geteilten Kerns.

- **Ein echter Chat gegen Mistral AI.** Endpunkte, Antwortform und Stream-Format sind
  gegen Mistrals OpenAPI-Spec verifiziert, der SSE-Parser hat einen Selbsttest, und beide
  Endpunkte antworten ohne gültigen Schlüssel mit HTTP 401 „Invalid API Key“ – genau
  dieser Text erscheint in der UI. Ein Lauf mit gültigem Schlüssel (Modellliste laden,
  Antwort streamen, Token-Zähler) stand beim Bau nicht zur Verfügung.

- **Der DOM-Panel-Weg.** Gebaut, aber er hat in keinem Test geliefert. Er schadet nicht,
  trägt aber auch nichts.
- **Die Spracherkennung über den Knopf in der Seitenleiste.** Der Kern ist gemessen –
  Aufnahme, Rückrechnung und Erkennung liefen an einem echten Video, die Dauer stimmt auf
  0,05 Sekunden (siehe [docs/messungen.md](docs/messungen.md)). Der Weg vom Knopfdruck
  bis zum fertigen Transkript im Tab ist noch nicht am Stück durchlaufen.
- **Windows.** `install-windows.ps1` folgt Chromes dokumentiertem Verfahren, ist aber
  mangels Windows-Rechner nie ausgeführt worden – das gilt auch für venv, `pip install
  sherpa-onnx` und den Modell-Download per `Invoke-WebRequest`. Die lokale Route
  Parakeet MLX ist dort ohnehin nicht verfügbar (Apple Silicon); primeline läuft laut
  PyPI-Wheels (`win_amd64`) auch dort, gemessen ist es nicht.
- **Linux.** `install-macos.sh` trägt die Manifest-Pfade unter `~/.config/` und den
  Modellordner nach XDG mit; ausgeführt wurde es nur auf macOS.
- **Der Chrome Web Store.** Der Store-Build wird gebaut und geprüft, aber bewusst nicht
  eingereicht – Begründung und Wiederaufnahme-Bedingung in [status.md](status.md).
- **Der Videodownload.** Die Helfer-Seite (Formate abfragen, Datei laden) ist gebaut und
  der Selbsttest läuft, der Knopf samt Auflösungsdialog in der Sidebar noch nicht – siehe
  offene Punkte in [status.md](status.md). Nur im `full`-Build, rechtliche Einordnung in
  [docs/gutachten-agy-video-download-2026-09-03.md](docs/gutachten-agy-video-download-2026-09-03.md).

Verifiziert ist dagegen, jeweils mit Zahl statt Behauptung:

| Prüfung | Beleg |
|---|---|
| Beide Builds, Tree-Shaking-Nachweis | `verify-store-bundle.sh` bestanden, inkl. Gegenprobe |
| Untertitel direkt von YouTube, `full` und `store` | 286 Zeilen, 46.010 Zeichen JSON |
| Untertitel über den lokalen Helfer (Rückfall) | 286 Segmente, 18.430 Zeichen |
| Chat gegen OpenRouter aus der Sidebar | 4.278 Zeichen deutsche Antwort, 34 Zeitstempel, $0.00533 |
| Chrome-Übersetzung | 286 Zeitstempel, 22.507 Zeichen, kostenlos |
| Zeitstempel-Klick | `[05:01]` geklickt, Video danach bei 302 s |
| Alle drei STT-Routen end-to-end | siehe Tabelle oben |
| `/api/v1/key`, Modellliste live | 375 Modelle in der Options-Page |
| Sidebar-Platzierung, Dark-Mode, SPA-Wechsel | im Browser gesehen |
| Extension-Logik / Host | 18 bzw. 8 Prüfungen |

```bash
cd extension    && pnpm run check          # 18 Prüfungen
cd native-host  && python3 selfcheck.py    # 8 Prüfungen
```

## Herkunft

Neuentwicklung von null. Kein fremder Code übernommen, kopiert oder umgeschrieben.

Als visuelle Orientierung für Platzierung und Bedienlogik der Sidebar diente
[PaoloJN/youtube-ai-extension](https://github.com/PaoloJN/youtube-ai-extension) – rechte
Spalte oberhalb der Empfehlungen, ein- und ausklappbar. Das Repo steht unter AGPL-3.0;
daraus wurden weder Dateien noch Komponenten noch Codefragmente übernommen.

Genutzte fremde Werkzeuge (nicht eingebettet, sondern aufgerufen):
[yt-dlp](https://github.com/yt-dlp/yt-dlp) (Unlicense), ffmpeg,
[senstella/parakeet-mlx](https://github.com/senstella/parakeet-mlx) (Apache-2.0).

## Lizenz

MIT, siehe [LICENSE](LICENSE).
