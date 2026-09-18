# Status – chrome-youtube-summary-chat

## Offene To-Dos (oberstes zuerst)

1. **Spike-APK am Mac bauen und messen** – Einstieg:
   [docs/uebergabe-android-2026-09-18.md](docs/uebergabe-android-2026-09-18.md),
   Ablauf der sieben Messungen in `app/README.md`. Ohne Messung A (trägt der
   Transkript-Weg auf Android?) wird an der App-Oberfläche nicht weitergebaut.
2. **Windows-Installer ausführen**, sobald ein Windows-Rechner zur Hand ist – jetzt inkl.
   venv, sherpa-onnx und Modell-Download (ungetestet, 04.09.2026).
3. Kleine Messung: `provider="directml"` (Windows) bzw. `"cuda"` (Linux) in der
   sherpa-Route – eine Zeile, drei Läufe, ungemessen. Auf dem Mac laut Michael nicht
   relevant.
4. Optional: Store-Build einreichen.
5. Offen aus Fables Entwurf: Zielsprache und Übersetzen-Knopf zu einem Auswahlfeld
   verschmelzen – nur, wenn gewünscht.

## Nachtrag 18.09.2026 – Workspace-Umbau und Android-Spike

Ziel: eine eigenständige Android-App mit der Funktion der Erweiterung – Teilen-Ziel für
YouTube-Links, Transkript, dieselben Schnellbefehle, Chat, Web-Recherche, dieselbe
KI-Anbindung. Zwei Dinge sind dabei zuerst entschieden worden, bevor eine Zeile
Oberfläche entstand.

### Entscheidung 1: Capacitor, nicht Kotlin

Begründung liegt in der Änderungshistorie dieses Projekts, nicht im Allgemeinen: am
häufigsten geändert werden die Prompts (0.9.0, 0.9.1) und die beiden Clients. Ein
Kotlin-Port hätte `prompts.ts` ein zweites Mal, in zwei Sprachen – die Drift zwischen de
und en ist hier schon einmal ein Befund gewesen. Der Player wäre in beiden Fällen
derselbe: IFrame-API im WebView, Googles eigener Weg seit der Abkündigung der Android
Player API.

Was damit **nicht** geht und auch mit Kotlin nicht ginge: Anmeldung. Google sperrt
Sign-in in eingebetteten WebViews (403 `disallowed_useragent`), und der WebView hat
seinen eigenen Cookie-Topf. Also kein Premium im eingebetteten Player, also Werbung.
Wer ohne Werbung springen will, geht über den Deep-Link in die YouTube-App – deshalb ist
der Knopf Pflichtpfad und nicht Kür.

### Entscheidung 2: ein Repo, ein Kern

`shared/` als pnpm-Workspace-Paket, rund 2.700 Zeilen laufen unverändert in beiden
Zielen. Vier Nähte statt einer Abstraktion: `chat.ts` (die §1-Verzweigung, jetzt an einer
Stelle statt im Service Worker), eine `Http`-Naht im Transkript-Abruf, Vorgaben und
Schlüsselnamen in `settings.ts`, und der Chat-Strom wird in `translate-cues.ts`
injiziert statt importiert. `shared/scripts/check.sh` hält den Kern sauber – inklusive
der Prüfung, dass `provider === "mistral"` an genau einer Stelle steht.

Die Erweiterung verhält sich unverändert; deshalb kein Versionssprung für den Umbau.

### Was gemessen wurde, hier, ohne Gerät

`pnpm -r run compile` grün, selfcheck 23/23 (neu: die Lesart geteilter Links),
`shared/scripts/check.sh` bestanden, beide Extension-Builds gebaut,
`verify-store-bundle.sh` bestanden, **Ladeprobe bestanden** gegen `build-full` und
`build-store` – die fünfte Prüfung aus CLAUDE.md ist jetzt ein Skript
(`extension/scripts/ladeprobe.mjs`) statt Handarbeit: sie leitet `www.youtube.com` per
`--host-resolver-rules` auf einen lokalen Stub um und sammelt `pageerror` ein. Wichtig
dabei: `channel: "chromium"`, die Headless-Shell lädt gar keine Extensions – ohne das
hätte die Probe bestanden, ohne etwas zu messen.

Für die App: Typprüfung grün, Bundle gebaut, `verify-app-bundle.sh` Stufe 1 bestanden,
`cap add android` erzeugt und eingecheckt. Der Actions-Lauf hat danach **die APK
gebaut** (2:54) und Stufe 2 gegen die entpackte Datei bestanden – der Gradle-Weg trägt
also, bevor am Mac überhaupt jemand anfängt. Die fertige Debug-APK hängt als Artefakt am
Lauf; sie lässt sich auch direkt installieren, statt sie am Mac neu zu bauen. Fables Angabe zu `adjustMarginsForEdgeToEdge`
war überholt – in 8.5.2 läuft Edge-to-Edge über `plugins.SystemBars.insetsHandling`,
abgelesen an den Typen, nicht geraten.

### Was offen ist – und ohne Gerät offen bleibt

Die App ist in der Cloud weder baubar noch startbar: `dl.google.com` und `youtube.com`
sind dort gesperrt. Der Spike hat genau deshalb sieben Messungen, damit eine einzige
Installation reicht (Liste in `app/README.md`). Die wichtigste ist A: trägt der
signierte Player-Call aus einem Nicht-Browser-Client? Trägt er nicht, ist der Rückfall
ein unsichtbarer WebView auf youtube.com-Origin – dann ändert sich der Aufbau, und gut,
dass die Oberfläche noch nicht gebaut ist.

### Offene To-Dos aus diesem Schritt

1. Spike-APK am Mac bauen, installieren, A bis F messen, Ergebnisse nach
   `docs/messungen.md` (mit Gerät, Android- und WebView-Version).
2. Danach erst: Oberfläche der App (Sidebar-Komponenten nach `shared/src/components`,
   Schnellbefehle, Chat, Verlauf), Speicher über Dateien statt Preferences.
3. Ton-Weg (MediaProjection + AudioPlaybackCapture → OpenRouter-STT) nur, wenn A trägt
   und die Oberfläche steht; höchstens 2× Tempo, der 8×-Trick der Erweiterung entfällt.

## Nachtrag 04.09.2026 (Nachmittag) – Download-Knopf gebaut, Codex-Review, React-Produktionsbuild, Parakeet-Bewertung

### Videodownload: sichtbarer Teil fertig, uncommittet

Knopf (Icon `FileVideo`) in der Werkzeugleiste des Transkript-Tabs neben „Neu
transkribieren (Audio)", Dialog als Fläche über der Sidebar (`absolute inset-0 z-30`)
aus vorhandenen `Button`-Komponenten plus nativen Radio-Knöpfen. Ablauf: Klick lädt nur
die Formatliste (`ask("videoFormats")` → Service Worker → `videoFormate`), vorgewählt ist
die grösste Höhe ≤ `downloadHeight`, der Download startet erst mit „Herunterladen"
(Port `"download"` → `handleDownloadPort` → `videoLaden`). Rechtshinweis ein Satz
(de/en). Optionsseite: Auflösung und Zielordner im Abschnitt „Audio-Fallback".
`verify-store-bundle.sh` prüft neu Test 2d (Download-Bezeichner fehlen im Store) mit
Gegenprobe im full-Build. Betroffene Dateien: Sidebar.tsx, TranscriptView.tsx,
background.ts, chat-client.ts, fallback.ts, i18n.ts, Options.tsx, verify-store-bundle.sh,
yt_summary_host.py, wxt.config.ts.

**Zwei Fehler im Backend vom Vormittag behoben:** `videoFormate`/`videoLaden` schickten
kein `type: "transcribe"` (der Host-Verteiler hätte „Unbekannter Nachrichtentyp"
geantwortet), und `list_formats` schickte vor der Antwort eine `progress()`-Zeile –
`sendNativeMessage` nimmt genau eine Antwort, die Formatliste wäre nie angekommen.

**Codex-Review (gpt-5.6-sol, xhigh) fand vier Punkte, alle behoben und gemessen:**

- **yt-dlp lief nach „Abbrechen" verwaist weiter.** Host: `run()` startet Kinder jetzt in
  eigener Prozessgruppe, ein Abbruch-Wächter liest stdin bis EOF (Chrome schliesst es beim
  Trennen des Ports) und beendet die Gruppe per SIGTERM; SIGTERM-Handler ebenso. Gemessen:
  1080p-Download gestartet, stdin nach 6 s geschlossen, Host Exit 1, kein yt-dlp/ffmpeg
  mehr in `pgrep`. Gilt damit auch für den Audio-Fallback.
- **Abbruch während `import`/`getSettings` im Service Worker** startete den Host trotzdem –
  Flag `abgebrochen` davor.
- **Verspätete Antworten alter Anfragen** (Videowechsel, erneutes Öffnen) konnten den neuen
  Dialog überschreiben; „Abbrechen" liess den Status auf `laeuft`. Laufzähler `dlLauf`,
  Unmount-Cleanup, Abbrechen setzt auf `wahl` zurück.
- **Grössenschätzung** zählte alle Höhen als Tonspur allein (10,3 MB für jede Höhe, weil
  eine unbekannte Videogrösse 0 nie verdrängt wurde) – dann als kleinste Spur, jetzt als
  grösste reine Videospur je Höhe plus beste Tonspur, Anzeige „ca.". Big Buck Bunny 360p:
  Schätzung 34,4 MB, tatsächliche Datei 25,6 MB (bestvideo nahm nicht den grössten
  Codec). Ohne Videogrösse steht „Grösse unbekannt", nicht die Tonspur.

Codex' Einwand, die grep-Muster seien nicht minifizierungsfest, greift nicht:
`minify: false` in wxt.config.ts, genau deshalb. Der bedingte Knopf und der `case
"videoFormats"` („In diesem Build nicht enthalten.") bleiben im Store-Build als leere
Hüllen, wie `runFallbackJob` und `hostStatus` – kein Weg zum Helfer, geprüft.

**Echter Lauf des Hosts** gegen `aqz-KE-bpKQ` (Big Buck Bunny, CC-BY): `list_formats`
liefert sechs Höhen, `download_video` 360p liefert den Pfad als letzte stdout-Zeile
(`--print after_move:filepath` funktioniert), Datei 25.581.771 Bytes.

**Visueller Test (headless, Chromium via Playwright, 1600×900, `uiScale` 110):** Knopf
26×26 px an der erwarteten Stelle, Dialog deckt den Header, X und „Schliessen" treffbar,
„Herunterladen" ohne Auswahl `disabled`, Umlaute und Gedankenstrich korrekt, Dark Mode
lesbar. Ohne registrierten Host zeigte der Dialog nur Chromes Rohmeldung „Specified
native messaging host not found." – `videoFormate` nutzt jetzt dieselbe Aufbereitung
(`hostFehler()`) wie der Audio-Weg. Ungeprüft: Ladezustand (Fehler kam nach 0,3 s),
Radio-Auswahl und laufender Download im Browser, Drag-Griff.

### Standardroute war nirgends installierbar – Installer richtet sie jetzt ein

Befund aus der Parakeet-Bewertung: `parakeet-primeline` (Standard auf allen drei
Plattformen, sherpa-onnx auf der CPU – **eine CoreML-Route gibt es in diesem Projekt
nicht**, der FluidAudio-Weg war nur der Messprototyp) erwartete `sherpa_onnx`/`numpy` im
System-Python und vier von Hand aus HuggingFace geholte Modelldateien; weder Installer
noch README erwähnten beides. Jetzt: `install-macos.sh` (deckt Linux mit, fünf
`~/.config/…`-Ziele) und `install-windows.ps1` legen ein venv neben dem Modellordner an
(`~/Library/Application Support/yt-summary-chat/venv` bzw. `%LOCALAPPDATA%`/XDG – bewusst
nicht im Projektordner, der liegt in der Dropbox), installieren `sherpa-onnx numpy` (uv,
sonst pip), laden die vier Dateien per `curl -fL --retry 3` als `.part` (Ordner und Repo
werden aus dem Host importiert, nicht geraten), Wrapper zeigt aufs venv. `selfcheck.py`
prüft venv und Modell per subprocess gegen das venv-Python (8 statt 6 Prüfungen). **Auf
diesem Mac durchgelaufen:** Dateigrössen byte-genau wie HF (Encoder 652.282.298 Bytes),
zweiter Lauf lädt nichts erneut, echter Lauf von `transcribe_primeline` auf 45 s TEDx
`9CZBIaaiPRI` liefert deutschen Text in 1,8 s.

**Codex-Review des Installer-Aufbaus (acht Befunde, alle behoben und gemessen):** Der
Wrapper fixierte nur den Python-Pfad, der Host berechnete den Modellordner zur Laufzeit
neu aus `HOME`/`LOCALAPPDATA`/`XDG_DATA_HOME` – jetzt schreibt der Installer
`YT_SUMMARY_BASIS` in den Wrapper, `primeline_ordner()` nimmt sie zuerst. `selfcheck.py`
berechnete das venv selbst statt das des Wrappers zu prüfen – liest jetzt `run-host.sh`
bzw. `run-host.bat` und prüft genau dieses Python; ohne Wrapper schlägt es mit „noch nicht
gelaufen" fehl (getestet). Vorhandene Dateien galten ungeprüft als gültig – jetzt
Grössenvergleich gegen `Content-Length` per HEAD vor dem Überspringen und nach dem Laden;
Negativtest: `tokens.txt` um 7 Bytes gekürzt, Installer lädt sie neu, `cmp` inhaltsgleich.
Windows: `-Encoding OEM` statt ASCII (Umlaute im Pfad), `$LASTEXITCODE` nach venv und pip,
`-UseBasicParsing`, drei Versuche. Host: leeres oder relatives `XDG_DATA_HOME` fällt auf
`~/.local/share` zurück (getestet). Ungeprüft: der gesamte Windows-Pfad (kein pwsh auf
diesem Mac, nicht einmal Syntax), GNU-`stat`-Zweig unter Linux, Start durch Chrome selbst
über den Wrapper. Michaels Vorgabe „auf dem Mac nicht relevant, hier
ist CoreML Standard" beruhte auf einer falschen Annahme und wurde ihm gemeldet.

### 06.09.2026: Version 0.9.1 – Behauptungen zurück und lesbar, Listenform in allen Presets

Michael: „In Kürze und Zusammenfassung, zwei statt einem, ist das berechtigt? In Kürze
sehr knapp, Zusammenfassung fast keine Zusammenfassung mehr“ und „bei Behauptungen
wird nicht strukturiert, nur fette Wörter im Text, bitte Leerzeilen“. Er benutzt
Behauptungen also – zurückgeholt (die Streichung von 0.9.0 war auf mein „a“-Lesen
gestützt), und die Ursache der fehlenden Struktur behoben: die Prompts verlangten
„eine Zeile je Eintrag“, react-markdown ohne remark-breaks zieht einzelne
Zeilenumbrüche aber zu einem Absatz zusammen. Jetzt: Behauptungen je ein Absatz mit
Leerzeile (Behauptung fett, dann Etikett-Satz); Fakten, Kapitel, Begriffe als
Aufzählungspunkte „- “; Pro/Contra mit Markern und Schlussabschnitt; Vergleich mit
Schluss als eigenem Absatz; Lernfragen mit Leerzeile nach jedem Zitatblock (Codex:
sonst hängt die nächste Frage im Blockquote). Zusammenfassung gestrafft: höchstens
vier Absätze zu drei bis fünf Sätzen, damit die Stufen In Kürze (≤ 6 Sätze) ·
Zusammenfassung (≤ 20 Sätze) · Ausführlich (offen) auseinanderliegen. Elf Knöpfe.

Codex offen gelassen (niedrig): de/en-Prompts sind nicht mehr inhaltsgleich (en fehlt
u. a. die Abgrenzung Angabe/Behauptung, körperliche Abläufe in Anleitung, die
Überlaufregel in Ausführlich); Hinweistexte ebenso. Kein Nutzer hier arbeitet auf en.

**Versionsregel nachgeschärft (Michael):** „function“ nur für neue Fähigkeit, Kacheln
und Prompts sind „fix“. 0.9.0 hätte 0.8.2 heissen müssen; bleibt so, weil ein Rewrite
mehr kostet als der Schönheitsfehler.

### 06.09.2026: Version 0.9.0 – zehn Schnellbefehle statt dreizehn

Michael: „a“ auf die Empfehlung – Behauptungen, Verweise und Positionen gestrichen
(Prompts de/en, i18n, Sidebar-Reihen, README). Zwei Reihen zu fünf: In Kürze ·
Zusammenfassung · Ausführlich · Kapitel · Fakten / Anleitung · Pro/Contra · Vergleich ·
Begriffe · Lernfragen. Die gestrichenen Prompts stehen in Commit cc26a71.

**„Nur Luna geht“, Stand nach Michaels Einwand:** er hatte den Tab neu geladen, das
„context invalidated“ war also nicht die Ursache seines Chat-Versuchs. Der Befund
„Frage im Chat, keine Antwort, keine Meldung“ passt exakt auf den alten stillen Pfad:
Port getrennt ohne „done“ → `resolve()` → leere Antwort ohne Fehlermarke. Was den Port
trennt, ist offen; seit 0.8.1 erscheint dort ein Fehlertext, und der Wachhalter hält
den Service Worker. Nachgemessen mit Reasoning high und 65k Token: luna 1,7 s,
deepseek-v4-flash 5,3 s, gemini-3.8-flash 6,1 s, glm-5.3-flash 9,5 s bis zum ersten
Token – kein 30-s-Fall. qwen3.7-flash antwortete mit **HTTP 429 „temporarily
rate-limited upstream“**; so ein Fehler wurde auch vorher angezeigt, ist aber ein
realer Ausfallgrund bei Billigmodellen. Nächster Schritt liegt bei Michael: mit 0.9.0
ein zweites Modell probieren und den Fehlertext aus der Sidebar schicken.

### 05.09.2026: Version 0.8.1 – „Nur Luna geht“ war ein totes Content-Script

Michaels Fehlertext: `Uncaught Error: Extension context invalidated` aus content.js.
Ursache: nach dem Update in chrome://extensions lebt das alte Content-Script im
offenen YouTube-Tab weiter, aber `chrome.runtime.connect` wirft. Der Wurf kam
synchron aus `startChat()` vor dem `try` – im Chat stand die Frage, sonst nichts, der
Knopf blieb auf Stopp. Kein Modellproblem: Luna war vor dem Update getestet worden,
die anderen danach. Fix: `startChat` im try, Meldung „Die Erweiterung wurde
aktualisiert oder neu geladen. Bitte die Seite neu laden (F5).“; Trennung des Ports
ohne „done“ ist jetzt ein Fehler statt eines stillen Endes; Codex-Befund:
`startFallback`/`startDownload` warfen ebenso synchron, jetzt Ablehnung statt
hängendem „läuft“. Offen gelassen (Codex, niedrig): Banner ohne Klick bei
Kontextverlust, `lastError` beim Disconnect.

**Versionsfehler:** 0.6.0 → 0.8.0 in einem Commit war falsch (0.7.0 war zwischendurch
nur uncommittet gesetzt und dann für dieselbe Änderung noch einmal erhöht). Regel in
CLAUDE.md: ein Commit, ein Sprung. Nichts gepusht (58 Commits voraus), eine
Umnummerierung per Rewrite wäre möglich, nur auf Michaels Ja.

### 05.09.2026: Version 0.8.0 – Modellmenü im Chat, Empfehlungsliste gemessen, Mistral-Modellliste war leer, Schnellbefehl „Zusammenfassung“

**Modellmenü im Chat (Michaels Wunsch, Vorbild Brave Leo):** unter dem Eingabefeld
steht klein das aktive Modell, ein Klick öffnet die Empfehlung mit Marken (schnell,
günstig, schlau), 1M-Marke und Preis je Anfrage, „Alle Modelle …“ führt in die
Einstellungen; bei Mistral führt der Knopf direkt dorthin. Eigene Komponente
`ModellMenue` ohne Radix, Klick-ausserhalb über `composedPath` (Shadow DOM). Headless
geprüft: 13 Einträge, Auswahl schreibt `settings.model`, Knopf zeigt danach das neue
Modell, keine pageerrors. `EMPFEHLUNG` trägt jetzt Marken-Arrays statt einer Marke;
Preis-Helfer und `isLiteModel` aus Options.tsx nach `lib/openrouter.ts` gezogen.

**Codex-Review 0.8.0 (drei Befunde, eingearbeitet):** Wachhalter startet erst mit
„start“ und ein zweites „start“ auf demselben Port wird ignoriert (sonst zweiter
bezahlter Request); das Modellmenü schliesst, sobald ein Stream beginnt; Esc und
Auswahl geben den Fokus an den Auslöser zurück, Liste mit `role=listbox`. Codex
bestätigt: der API-Aufruf setzt seit Chrome 110 den 30-s-Zähler zurück, der
Download-Port braucht keinen Wachhalter (Native-Messaging-Port hält selbst wach).

**„Nur luna geht, deepseek flash nicht“ – nicht reproduzierbar.** Alle 18 Kandidaten
antworteten mit dem Anfragekörper der Extension, kurz und mit 60.000 Token
(Tabelle in docs/messungen.md). Ohne Michaels Fehlertext ist die Ursache offen;
Kandidaten: Reasoning-Stufe hoch bei einem Denkmodell (lange ohne Token, Service
Worker stirbt nach 30 s – dagegen jetzt ein Wachhalter im Chat-Port), oder eine
Kontoeinstellung bei OpenRouter (Provider-Ausschluss, Datenrichtlinie), die den
DiktaGo-Schlüssel nicht betrifft. Empfehlungsliste nach Messung neu: GLM 5.3 Flash und
5.3, Nemotron 3 Nano, Claude Haiku 4.5 dazu, Gemini 3.8 Flash statt 3.7, qwen3.7-plus,
glm-4.7-flash und qwen3.8-flash raus (Widerspruch „günstig“ teurer als „schnell“).

**Michaels Test von 0.6.0:** „Modelle laden“ lieferte 0 Modelle, in EU wie global, der
Chat blieb bei „kein Modell gewählt“ stehen. OpenRouter lief. Ursache im Code, nicht
beim Schlüssel: Mistrals `/v1/models` führt Aliase (`mistral-small-latest`) als eigene
Einträge, und die `aliases`-Felder sind **symmetrisch** – der Grundeintrag nennt das
Alias, der Alias-Eintrag nennt den Grund. Mein Filter strich alles, was irgendwo als
Alias stand, also alles. Jetzt `modelleAusListe()`: eine Gruppe je `id + aliases`,
daraus genau ein Eintrag, bevorzugt der mit Datumssuffix. Selbsttest mit symmetrischer
Fixture (22 Prüfungen). Nach dem Laden wird das neueste Modell vorgewählt, wenn keins
gesetzt ist. Ein Lauf mit echtem Schlüssel steht weiter aus (kein Key hier).

**Schnellbefehle:** „Fazit“ heisst jetzt **In Kürze**, „Kernaussagen“ ist durch
**Zusammenfassung** ersetzt (Michaels Wunsch: schlicht zusammenfassen, mehrere Absätze,
Thema fett vorneweg): drei bis sechs Absätze, je Absatz ein Thema als fette Kurzaussage,
danach drei bis fünf Sätze, ohne Zeitstempel und Listen. Schlüssel `summary_medium`
unverändert, de/en, README angepasst. Der alte Listen-Prompt steht in Commit 021ed23.

**Redundanzprüfung der 13 Knöpfe, Empfehlung an Michael (Entscheidung offen):**
streichen Behauptungen (Grenze zu Fakten ist für Nutzer nicht erkennbar, status.md
04.09. hatte sie schon nachgeschärft), Verweise (Namen von Büchern, Studien, Werkzeugen
fallen in Fakten oder in eine Chatfrage), Positionen (Ausführlich und Pro/Contra nennen
bei mehreren Personen ohnehin, wer was vertritt). Bleiben zehn.

**Nach der Kompaktierung nachgetragen:** 0.6.0 ist Commit 021ed23. Hook-Verhalten steht
jetzt im Memory (`hooks-blockieren-kommandotext`): `geheimnis-schutz` schlägt auf
Wörter wie `key`, `token`, `process.env` im Kommandotext an, `fokus-schutz` auf
App-Bundle-Pfade und `open` ohne `-g` auch in Heredocs – Skripte und Codex-Prompts
deshalb per Write-Tool als Datei anlegen. Codex-Läufe mit „Reconnecting… 5/5“ liefern
leere Berichte, dann mit `model_reasoning_effort=medium` wiederholen.

### 05.09.2026: Version 0.6.0 – Mistral AI als zweiter Anbieter (Datenschutzoption, EU-Endpunkt)

**Michaels Auftrag hebt Regel 1 bewusst auf:** „Mistral unabhängiger zweiter Anbieter, das
ist der Sinn der Sache. OpenRouter ist Standard und üblich in jedem Fall, Mistral nur als
Option 2 für Datenschutzbewusste." Regel 1 lautet jetzt: genau zwei Gegenstellen, kein
Fallback zwischen beiden, keine generische Abstraktion – ein Schalter `settings.provider`,
zwei Clients (`lib/openrouter.ts`, `lib/mistral.ts`), der Service Worker verzweigt an einer
Stelle. Was nur OpenRouter kann (Web-Plugin, Reasoning-Regler, Preise, STT), fehlt bei
Mistral sichtbar (Schalter gesperrt mit Tooltip, Service Worker wirft
`WEB_ONLY_OPENROUTER`), nicht heimlich.

**Datenschutzfrage geklärt (agy-Recherche, Quellen in
[docs/recherche-agy-openrouter-mistral-2026-09-05.md](docs/recherche-agy-openrouter-mistral-2026-09-05.md)):**
Provider-Pinning bei OpenRouter (`provider: {order: ["mistral"]}`) legt nur fest, wer die
Antwort rechnet. Prompt und Antwort laufen trotzdem durch OpenRouters US-Infrastruktur
(Cloudflare, Google Cloud, Upstash – von OpenRouter selbst als Subprozessoren mit Zugriff
auf „Prompts & Completions" genannt); Vertragspartner OpenRouter Inc. (Delaware),
Gerichtsstand New York, EU-Route (`eu.openrouter.ai`) nur für Enterprise. Direkt bei
Mistral: Vertragspartner Mistral AI SAS (Paris), einstufig, kein Drittlandtransfer.
**Mistral hat einen echten EU-Endpunkt `api.eu.mistral.ai`** (Inferenz garantiert in der
EU, rund 10 % Aufpreis) neben dem globalen `api.mistral.ai` und einem US-Endpunkt; beide
hier per curl mit 401 bestätigt. Michaels „EU-Zugangspunkt als Standard" ist damit
`mistralRegion: "eu"` als Voreinstellung, umschaltbar. Mistral bewahrt API-Eingaben
standardmässig 30 Tage zur Missbrauchserkennung auf, kein Training, ZDR beantragbar.
Fable online lag also richtig, ohne dass er einen Schalter übersehen hätte.

**Gebaut (Opus-Agent, danach EU-Region von der Hauptsitzung ergänzt):** `lib/mistral.ts`
(`listModels`, `testKey` über `/v1/models`, `streamChat` SSE mit `data: [DONE]`, reine
Parserfunktionen `verarbeiteSse`/`deltaText`; API-Fakten aus Mistrals OpenAPI-Spec
verifiziert: `data[].id`, `aliases`, `capabilities.completion_chat`, `delta.content` als
String oder Chunk-Array, `usage` im letzten Chunk, keine Preise). Settings `provider`,
`mistralApiKey`, `mistralModel` (leer bis „Modelle laden", kein geratener Default),
`mistralRegion`. Optionsseite: Abschnitt „Anbieter" oben (OpenRouter Standard / Mistral
AI – EU-Anbieter, Datenschutzoption), Abschnitt „Mistral-Zugang" mit Endpunkt-Auswahl,
Passwortfeld, „Schlüssel prüfen", „Modelle laden", Modell-Select, Hinweistext.
`host_permissions` um beide Mistral-Endpunkte. `selfcheck.ts` prüft den SSE-Parser (21
Prüfungen). Fehlertext der API im Wortlaut in der UI (`HTTP 401 – Invalid API Key`,
gemessen mit Platzhalter-Key). Ungeprüft: echter Chat gegen Mistral (kein Schlüssel hier).

**Codex-Review des Einbaus (fünf Befunde, alle behoben):** OpenRouters Modellliste wurde
auch bei gewähltem Mistral geladen (Sidebar und Optionsseite) – jetzt nur bei OpenRouter,
bei Mistral keine einzige Anfrage an OpenRouter, auch keine Metadaten. SSE-Parser
verarbeitete `data:`-Zeilen einzeln statt ereignisweise (Leerzeile als Grenze, mehrere
`data:`-Zeilen mit `\\n` verbunden, wie die SSE-Spezifikation verlangt) und liess den
Restpuffer bei Stream-Ende liegen – beides korrigiert, Selbsttest um Ereignis ohne
Leerzeile, `\\r\\n` und zweizeiliges JSON erweitert. Regionswechsel: „Modelle laden" und
„Schlüssel prüfen" schicken die Region mit, statt sie aus dem noch nicht geschriebenen
Storage zu lesen. Übersetzungsverlauf speichert die Route jetzt als `mistral`, nicht als
`openrouter`. Codex' Security-Scan: keine sicherheitsrelevanten Befunde, keine
Kreuzverwendung von Schlüsseln.

### 05.09.2026: Version 0.5.0 – Ordnerdialog, Zielordner-Anzeige mit ~, „vor jedem Download fragen"

Michaels Vorgaben nach dem ersten echten Download: Ordner und Dateiname getrennt
anzeigen, Ordner ab `~`, darunter klein „Downloadordner anpassen" mit Sprung zu den
Einstellungen; in den Einstellungen ein Dateiwähler statt Tippfeld („niemand tippt Pfad
ein und das ist Risiko") und ein Schalter „vor jedem Download fragen". Umsetzung: Der
Host liefert im `downloaded`-Ergebnis `dir` (per `kurzer_pfad()`, `~/Downloads`) und
`name`; neue Host-Nachricht `chooseFolder` → `choose_folder()` mit dem Dialog des Systems
(`osascript … choose folder`, PowerShell `FolderBrowserDialog`, `zenity --directory`),
Abbruch = `path null`, kein Fehler. Eine Chrome-Extension kann keinen absoluten Pfad aus
`<input webkitdirectory>` lesen, deshalb zwingend über den Helfer. Optionsseite:
Zielordner nur lesbar, „Ordner wählen …", „Standard" (leer = Downloads des Systems),
Schalter `downloadAsk`. Sidebar: bei `downloadAsk` erst der Dialog, dann der Download mit
dem gewählten Ordner als `target` (schlägt die Einstellung im Service Worker). Nach
„Gespeichert" zwei Zeilen (Ordner, Datei), Ordner-Knopf daneben, darunter der Link zu den
Einstellungen. Test 2d prüft `ordnerWaehlen` und `type: "chooseFolder"`. Ungeprüft: die
Dialoge selbst (würden hier ein Fenster nach vorn holen), Windows und Linux.

### 05.09.2026: Version 0.4.1 – ein gemeinsamer Fortschritt über Ton und Bild

Michaels Wunsch: Hinweise „Ton wird geladen", dann „Bild wird geladen", dann
„zusammengefügt" – und die Frage, ob ein gemeinsamer Balken überhaupt geht. Er geht:
`download_video` holt vor dem Download `--dump-single-json` für genau den gewählten
Formatausdruck (ein Metadaten-Abruf, 1 bis 2 s) und kennt damit `requested_formats`
samt Grösse und Spurart (`vcodec == "none"` = Ton). Der Formatausdruck lautet jetzt
`bestaudio+bestvideo[height<=H]` – yt-dlp lädt in dieser Reihenfolge, die kleine Tonspur
zuerst. `--progress-template "download:FORT=%(info.format_id)s
%(progress.downloaded_bytes)s"` liefert je Zeile Spur und Bytes; der Host rechnet
(fertige Spuren + laufende Bytes) / Gesamt. Gemessen bei Big Buck Bunny 720p: Tonspur
0 → 12 %, Bildspur 12 → 100 %, 46 Meldungen, 18 s; Container hat Ton als Spur 0, Bild
als Spur 1 (ffprobe), spielt normal. `--no-quiet` nötig, weil `--print` yt-dlp stumm
schaltet und die `[Merger]`-Zeile sonst fehlt. Ohne bekannte Grössen (beide 0) gibt es
keine Zahl statt einer falschen.

### 05.09.2026: Version 0.4.0 – Download-Fortschritt und „Im Ordner zeigen"

Michaels Wahl aus 16 gerenderten Kandidaten: **Icon Nr. 1 `Download`** (statt
`FileVideo`). Neu: `download_video` startet yt-dlp mit `--newline --progress` und liest
stdout zeilenweise; jede `[download] NN%`-Zeile wird als `percent` gemeldet (gemessen:
78 Meldungen 0 bis 100 % bei Big Buck Bunny 360p), `[Merger]` als „Bild und Ton werden
zusammengefügt". stderr läuft in denselben Strom (zwei Pipes, eine gelesen, blockieren
ab 64 KB). Der Pfad ist nicht mehr „letzte Zeile", sondern der letzte Kandidat ohne
Klammerpräfix, den das Dateisystem als Datei bestätigt. Bild- und Tonspur zählen
nacheinander je 0 bis 100 (bewusst, `ponytail:`-Kommentar). Nach „fertig" steht neben
dem Pfad ein Ordner-Knopf (`FolderOpen`): `kind: "reveal"` → `reveal_file()` → `open -R`
(macOS), `explorer /select,` (Windows), `xdg-open` auf den Ordner (Linux); der Host
prüft `is_file()`, Argumentliste ohne Shell. Gespeichert wird in `downloadTarget`
(Optionsseite), leer bedeutet den Downloads-Ordner des Systems – nicht der Browser
entscheidet, sondern der Helfer. Test 2d prüft zusätzlich `kind: "reveal"|videoZeigen`.
**Codex-Review (zweiter Anlauf, der erste brach mit Verbindungsabriss ab):** sechs
Punkte, drei davon umgesetzt: `--print "after_move:PFAD=%(filepath)s"` statt Zeilenform-
Heuristik; `finally` beendet yt-dlp, wenn die Schleife durch eine Ausnahme abbricht
(BrokenPipe in `progress()` nach Port-Trennung), Windows über `taskkill /T`;
`reveal_file` nimmt nur Dateien im eingestellten Zielordner (`target` kommt aus den
Settings im Service Worker, nicht aus dem Content-Script). Erfolgreicher Reveal löscht
einen alten Fehlertext. Gemessen nach den Änderungen: 29 Meldungen bis 100 %, Pfad aus
dem Präfix, Datei ausserhalb des Zielordners abgewiesen. **Panne beim Test:** ein
Testfall rief `reveal_file` mit echtem Ziel auf und öffnete damit ein Finder-Fenster auf
`/etc/hosts` im Vordergrund – Michael gemeldet. Ungeprüft: Explorer und xdg.

### 05.09.2026: Version 0.3.2 – Download-Knopf in den Kopf, Web-Schalter ans Eingabefeld

Michaels Befund nach dem Neuladen: kein Download-Knopf sichtbar (er sass in der
Werkzeugleiste des Transkript-Tabs, die erst mit geladenem Transkript erscheint), und die
Weltkugel wechselte beim Klick die Farbe nicht und stand schlecht. Jetzt: **Download-Knopf
(`FileVideo`) im Header links vom Zahnrad**, in allen Tabs und ohne Transkript sichtbar,
weiterhin nur im `full`-Build (`onVideoDownload` hängt an `__FALLBACK__`); aus
TranscriptView entfernt. **Web-Schalter direkt links neben dem Senden-Knopf** im
Eingabefeld – er gilt für die nächste getippte Frage, also gehört er dorthin, nicht in
die Werkzeugzeile darunter, die ohne Nachrichten fast leer ist. An-Zustand jetzt
`bg-primary/15 text-primary ring-1 ring-primary`; das vorherige `bg-secondary` war im
hellen Thema vom Kartengrund nicht zu unterscheiden, daher „ändert Farbe nicht".
Headless geprüft (Screenshots im Sitzungs-Scratchpad): Knopf sichtbar, `aria-pressed`
wechselt, Ring sichtbar, Dialog öffnet. Dabei gefunden: `sendNativeMessage` verwirft bei
fehlendem Host die Promise statt `lastError` zu setzen, die Rohmeldung stand im Dialog –
`videoFormate` fängt das jetzt und läuft durch `hostFehler()`.

### 05.09.2026: Version 0.3.1 – Versionskonvention war über drei Commits vergessen

Michaels Einwand: die Versionsnummer blieb bei 0.2.0, obwohl Vergleich-Preset, Tabellen,
Videodownload, Installer und React-Produktionsbuild dazukamen. Die neuen Funktionen
wären 0.3.0 gewesen, der Ladefehler-Fix macht daraus 0.3.1 – so steht es jetzt in
`wxt.config.ts` und `package.json`; die Pflicht steht in CLAUDE.md unter „Prüfungen".
Ausserdem festgehalten: Michaels Fehlermeldung nach dem Fix nannte `content.js:57725`,
der neue Build hat 56.023 Zeilen – der Browser lief noch mit dem alten Bundle. Eine
entpackte Erweiterung übernimmt geänderte Dateien erst nach „Aktualisieren" in
`chrome://extensions`; die sichtbare Versionsnummer ist genau dafür da.

### 05.09.2026: Extension lud nicht mehr – Ursache der React-Umstellung, behoben

Michaels Meldung: keine Sidebar mehr. Headless reproduziert (Playwright-Chromium 1208):
`pageerror: (0, import_jsx_dev_runtime.jsxDEV) is not a function`. Ursache: Der
WXT-Hook `vite:build:extendConfig` stellte nur den define-Wert auf Produktion, Vites
eigenes `isProduction` blieb falsch, weil WXT `NODE_ENV` auf den Modusnamen setzt – der
React-Plugin übersetzte JSX deshalb weiter über `jsx-dev-runtime`, dessen `jsxDEV` in
der Produktionsfassung `undefined` ist. Erster Render wirft, kein Mount. **Lösung:**
`NODE_ENV=production` vor jedem `wxt`-Aufruf in package.json (WXT übernimmt eine gesetzte
Variable per `??=`), der Hook bleibt für den define-Wert. Beide Builds 1,76 MB, kein
`react/jsx-dev-runtime` mehr im Bundle, Sidebar mountet (Screenshot geprüft), alle vier
Prüfungen grün. `verify-store-bundle.sh` Test 4 prüft jetzt zusätzlich, dass
`react/jsx-dev-runtime` fehlt – der erste Test 4 hatte genau diesen Bruch nicht gesehen.
Lehre für den Aufbau: eine Bundle-Prüfung, die nur Dateinamen zählt, ersetzt keinen
Ladeversuch; der headless-Repro-Lauf (`scratchpad/repro.py`, Konsole und `pageerror`
einsammeln) gehört vor jede Fertigmeldung mit Build-Änderung.

### React lief bisher als Entwicklungsfassung – behoben

Befund aus dem visuellen Test: Konsole „Download the React DevTools", Bundle enthielt
`react-dom-client.development.js`. Ursache: WXT ersetzt `process.env.NODE_ENV` im
Bundle durch den Modus-Namen (`"full"`/`"store"`), und seine Vorgabe gewinnt gegen ein
eigenes `define` **und** gegen die Umgebungsvariable (beides gemessen). Lösung: WXT-Hook
`vite:build:extendConfig` in wxt.config.ts setzt den Wert nach dem Zusammenführen und nur
beim Bauen – ein erster Versuch als Vite-Plugin in `configResolved` hätte laut Codex auch
`wxt dev` auf Produktion gezwungen. Content-Script 2.249.539 → 1.834.590 Bytes.
`verify-store-bundle.sh` prüft das als Test 4 in beide Richtungen (Produktionsmarker
vorhanden, `react-dom-client.development.js` abwesend) für beide Builds.

### Testbrowser-Befund

**Google Chrome 152 ignoriert `--load-extension`** (auch mit
`--disable-features=DisableLoadExtensionCommandLineSwitch`); Chrome for Testing 148 hängt
ohne `--use-mock-keychain` und liefert headless keine Screenshots. **Funktioniert:
Playwright-Chromium 145** (`~/Library/Caches/ms-playwright/chromium-1208`, `headless=True`,
`--load-extension`, CDP-Port). Frisches Profil zeigt YouTubes Consent-Dialog, dessen
Backdrop die Sidebar links 65 px verdeckt – vor Screenshots „Alle ablehnen".

### Parakeet: kein Rebuild in diesem Projekt

Bewertung durch einen Opus-Agenten gegen den DiktaGo-Stand (HF-API abgefragt am
04.09.2026): **Nichts Neues seit 03.09.** – ValentinWeyer unverändert seit 07.08., kein
deutsches, kein primeline-, kein CoreML-Derivat neu; nur v3-Varianten (ONNX-q8, TensorRT,
GGUF), die hier bei 58 % WER lagen. **6-Bit-Palettisierung nicht kopieren:** FluidInference
hat das Rezept selbst durch `Encoder_v2` (int8 linear per-channel, 594 MB) ersetzt
(Token-Korruption, FluidAudio#760), DiktaGos Reihe Q misst 6-Bit 2,80 Punkte schlechter
als int4; der WER-Verlust 6-Bit gegen fp16 ist nirgends gemessen. DiktaGo hat Modelle
(`~/Library/Application Support/DiktagoMessungen/modelle/`), Harness
(`DiktaGo/_system/messungen/parakeet-ted/`, inkl. Swift-Testprogramm gegen FluidAudio
0.15.6) und Rezepte (`docs/recherche-parakeet-coreml-2026-09-03.md`); dort läuft
`v3-encv2` als erster Test, ob Encoder-Präzision WER überhaupt bewegt – **abwarten und
übernehmen, nicht parallel bauen.** E5RT-Warnung/CPU-Fallback gehört zu DiktaGo (dort
löst es einen realen Blockabbruch). Zwei Befunde für unseren Weg: ValentinWeyers Fassung
bricht unter FluidAudio bei Blöcken über 15 s ab (`max_audio_seconds: 15.0`), matt-2012
nicht; auf gemischtem DE/EN-Material kehrt sich die Rangfolge um (v3 9,47 %, primeline
24,35 %) – primeline lässt englische Passagen weg, beide Modelle müssen wählbar bleiben.
Was in diesem Projekt real offen ist, steht oben als To-Do 2 und 4.

## Stand 04.09.2026 (zweiundzwanzigster Durchgang) – fairer Vergleich, Tabellen im Chat, Downloadweg erforscht

**Nutzervorgabe für die weitere Arbeit, wörtlich:** „kein whisper, das bringt nichts.
konzentration auf parakeet! und dessen derivate." Whisper-Wege werden nicht mehr
weiterverfolgt oder gemessen – die bestehende OpenRouter-Route bleibt als bezahlter
Cloud-Weg im Code, wird aber nicht mehr verglichen oder ausgebaut. Bei einem deutschen
Parakeet-Derivat gilt **ValentinWeyer als bevorzugte Wahl** (deckt sich mit der
Empfehlung unten). Kontext: DiktaGo erforscht parallel einen eigenen Rebuild des
allgemeinen Parakeet-CoreML-Wegs – bei Überschneidungen dort nachsehen, bevor hier neu
gebaut wird.

### Fairer Vergleich ValentinWeyer gegen matt-2012: Gleichstand bestätigt

Nach Michaels Einwand („primeline matt-2012 scheint gewonnen zu haben, korrekt?") wurde
das Messschema mit Fable 5.1 abgestimmt und neu gefahren: fünf Runden, ABBA-Reihenfolge,
jedes Modell im eigenen Prozess, erster Vortrag je Runde als Aufwärmlauf verworfen,
5 s Pause gegen thermische Drift, Median statt Mittel.

| | Wortfehler | Anteil | Tempo (Median, ohne Aufwärmlauf) |
|---|---|---|---|
| matt-2012 | 457 von 5434 | 8,41 % | 369x |
| ValentinWeyer | 461 von 5434 | 8,48 % | 345x |

**Beide Modelle sind über fünf Runden vollständig deterministisch** (je ein Ergebnis-Hash
über alle Runden). Der Unterschied von vier Wörtern (0,074 Prozentpunkte) ist laut Fable
statistisch nicht von null zu unterscheiden. Alle sechs Abweichstellen zwischen den
beiden sind ausschliesslich Getrennt-/Zusammenschreibung („misslingens" gegen
„misslings", „mitzusagen" gegen „mit zu sagen") – keine inhaltlichen Fehler. **Fazit
unverändert: Gleichstand, die Empfehlung bleibt ValentinWeyer** wegen der mitgelieferten
`conversion_metadata.json`.

Ein Auswertungsfehler ist dabei aufgetreten und behoben: Der Aufwärmlauf nutzt dieselbe
Datei wie der erste Messlauf; der erste Parser hängte beide Blöcke unter demselben
Namen aneinander, wodurch die Fehlerzahl kurzzeitig auf 33 % sprang.

### Sind die beiden Konvertierungen optimal gebaut? Nein – Einschätzung von Fable

Volles Gutachten: [docs/gutachten-fable-primeline-optimierung-2026-09-03.md](docs/gutachten-fable-primeline-optimierung-2026-09-03.md).
Kurz: Beide sind fp16 bei 1,2 GB, keine nutzt Quantisierung. 6-bit-Palettisierung könnte
auf ~480 MB drücken (wie v3), bei 0,1–0,3 WER-Punkten Verlust – ohne Training, in
Minuten mit `coremltools.optimize`. Die E5RT-Warnung beim Laden ist ein
Leistungsdefekt (eine Operation läuft auf CPU statt ANE), kein Datendefekt. Ein
Engineering-Fork lohnt sich (1–3 Tage), ein Modell-Fork (Neutraining) nicht. **Kein Fork
geplant**, siehe Gutachten für die Begründung.

### Weitere deutsche Parakeet-Varianten geprüft – keine besser für unseren Zweck

`Mediform/parakeet-medical-de` (117 h medizinische Daten, 11,3 % WER in der Fachdomäne)
und `johannhartmann/parakeet_de_med` (976 synthetische Arztbriefe, PEFT, 3,3 % in der
Fachdomäne) sind Domänenspezialisten für medizinische Texte – auf YouTube-Vorträgen
vermutlich schlechter, nicht besser, ungetestet. `nvidia/stt_de_fastconformer_hybrid_large_pc`
ist ein eigenständiges 115M-Modell (nicht Parakeet-Architektur), 5,4 % auf Common Voice.

**Öffentliche Vergleichstabelle** (`flozi00/asr-german-mixed-evals`) bestätigt die
Modellwahl: Auf Tuda-De (realitätsnahe Aufnahmen, am nächsten an YouTube-Material) liegt
primeline mit 4,11 % vor jedem Whisper-Modell; bei vorgelesener Hörbuchsprache liegen
Whisper-Fine-Tunes knapp vorn. `2_95_WER.nemo` (primelines Checkpoint-Dateiname) ist
jetzt geklärt: 2,95 % ist der Gesamtdurchschnitt über Tuda-De, MLS und Common Voice 19.0.

### Zwei neue Chat-Bausteine: Vergleich-Preset und adaptive Tabellen

Nach Michaels Vorbild (Brave Leo, zwei Screenshots: breite Tabelle vs. Kartenansicht):
[Markdown.tsx](extension/components/Markdown.tsx) bekam eine eigene Tabellenkomponente,
die per `ResizeObserver` die **Containerbreite** misst (nicht die Fensterbreite, weil die
Sidebar in der Breite verstellbar ist) – ab 380 px eine gewöhnliche Tabelle, darunter
eine Karte je Zeile mit vorangestellter Spaltenüberschrift.

Neues Preset **Vergleich** (13. Knopf, Reihe 2 neben Pro/Contra): Tabelle mit
Merkmal-Spalte und je einer Spalte pro verglichener Sache, danach „Kurz gesagt" mit
einem Satz je Seite und „Unterschied, der zählt" als Schlusszeile. Sagt das Video zu
einer Seite nichts, steht „nicht gesagt" statt eines Umkehrschlusses.

**Visuell geprüft am 04.09.2026** (headless, `uiScale` 110): bei 500 px passen alle fünf
Knöpfe in eine Zeile, bei der Standardbreite von 440 px steht „Vergleich" allein in einer
dritten Zeile. **Michaels Entscheidung: hinnehmen** – 13 Knöpfe in drei Reihen gehen bei
440 px nicht ohne Umbruch, und die Breite ist verstellbar.

### Videodownload: Machbarkeit und Recht erforscht, Backend gebaut, UI offen

Vollständige Recherche mit Quellen:
[docs/gutachten-agy-video-download-2026-09-03.md](docs/gutachten-agy-video-download-2026-09-03.md).
Kurz: **rechtlich nicht risikofrei** (OLG Hamburg 21.11.2024, seit BGH-Beschluss
Oktober 2025 rechtskräftig – YouTubes Rolling Cipher ist eine wirksame technische
Schutzmaßnahme nach § 95a UrhG), aber ein öffentliches GitHub-Repo mit `yt-dlp`-Aufruf
ist etablierte Praxis (yt-dlp selbst liegt seit 2020 dort). Store-Einreichung ist
ausgeschlossen (Googles Programmrichtlinie nennt Downloads geschützter Inhalte
ausdrücklich). Rein browserseitig ist es technisch nicht praktikabel (n-sig-Verschleierung,
PO-Tokens, DASH-Muxing sprengt den Service Worker) – der Weg läuft zwingend über den
Native-Host, wie der Audio-Fallback.

**Gebaut:** `list_formats`/`download_video` in
[yt_summary_host.py](native-host/yt_summary_host.py) (Selbsttest grün), Brücke
`videoFormate`/`videoLaden` in [fallback.ts](extension/lib/fallback.ts), neue
Einstellungen `downloadHeight` (Default 720p) und `downloadTarget`. Nur im
`full`-Build erreichbar (§2, §4a in [CLAUDE.md](CLAUDE.md)).

**Offen: der sichtbare Teil.** Download-Knopf in der Sidebar und der Auflösungsdialog
(zeigt die tatsächlich verfügbaren Höhen mit Größe) sind noch nicht gebaut. Danach die
vier Pflichtprüfungen (`compile`, `check`, beide Builds, `verify-store-bundle.sh`,
`selfcheck.py`) und ein visueller Test im Browser.

## Stand 03.09.2026 (einundzwanzigster Durchgang) – deutsches Modell gemessen, eingebaut, Standard gewechselt

### Ergebnis über drei deutsche TEDx-Vorträge (5434 Referenzwörter, 40 Minuten)

| Modell | Weg | WER | Tempo |
|---|---|---|---|
| **primeline matt-2012** | CoreML / ANE (Swift, FluidAudio) | **8,4 %** | **352x** |
| **primeline ValentinWeyer** | CoreML / ANE | **8,5 %** | 289x |
| primeline (OpenVoiceOS) | onnx-asr, CPU | 9,2 % | 27x |
| primeline (x-ian) | sherpa-onnx, CPU | 9,3 % | 32x |
| parakeet v3 | CoreML / ANE | 30,2 % | 241x |
| parakeet v3 (ONNX) | onnx-asr, CPU | 57,2 % | 26x |
| parakeet v3 (GGUF) | NeMo-Speech.cpp, Metal | 58,0 % | 38x |
| parakeet v3 (GGUF) | NeMo-Speech.cpp, CPU | 58,5 % | 24x |

Tempo = Audiosekunden je Rechensekunde, Apple M5, seriell gemessen, Ladezeit separat.
Vollständige Reihe samt Einzelwerten in [docs/messungen.md](docs/messungen.md).

### Der Grund für den Abstand ist nicht die Erkennung, sondern die Sprache

**parakeet v3 übersetzt deutsche Vorträge ins Englische.** Bei `JBRv-EAv2IA` (deutscher
TEDx-Vortrag mit englischen Zitaten) schreibt v3 „Spring and the network. This is the
phrase that we hear." – die Referenz lautet „Spring und das Netz wird erscheinen. Das
sind so geflügelte Phrasen, die wir immer wieder hören." Auf allen drei Wegen
reproduziert. Ohne englische Zitate (`ted.wav`) liegt v3 bei 5,9 %.

**Das lässt sich nicht abstellen.** NVIDIAs Modellkarte: „The model automatically detects
the language of the audio and transcribes it without requiring additional prompting."
Gemessen: `nemo-speech --language de` liefert bitgleich dieselbe englische Ausgabe.
FluidAudios `language:` steuert nur einen Latein-gegen-Kyrillisch-Schriftfilter. Im
FluidAudio-Quelltext steht das Phänomen ausdrücklich beschrieben – „the spontaneous-speech
translation phenomenon where the model falls back to its English prior" – mit einer
Gegenmaßnahme, die **nur für Französisch** freigeschaltet ist (`englishBlocklistApplies`
prüft `language == .french`).

### Was eingebaut wurde

- Neue Route **`parakeet-primeline`** in [yt_summary_host.py](native-host/yt_summary_host.py)
  über sherpa-onnx: läuft auf macOS, Windows, Linux und Intel-Macs mit denselben
  Modelldateien, liefert Wort-Zeitstempel, 670 MB.
- **Standard gewechselt**: `sttRoute` steht in [storage.ts](extension/lib/storage.ts) jetzt
  auf `parakeet-primeline` statt `parakeet-mlx`.
- Optionsseite: beide lokalen Routen mit ihrer Eignung beschriftet, dazu der Hinweis, dass
  v3 für englischen und anderssprachigen Ton weiterhin richtig ist und **beide Modelle
  nebeneinander bestehen** dürfen. Installationszeile `pip install sherpa-onnx numpy`.

### Warum sherpa-onnx und nicht onnx-asr

Gleichwertig in der Qualität (9,3 gegen 9,2 %), aber sherpa-onnx ist schneller (32x gegen
27x), liefert **Wort-Zeitstempel** (2864 bis 5052 Marken je Vortrag; onnx-asr liefert
keine), bringt VAD mit, erlaubt CUDA und DirectML über denselben `provider`-Schalter und
wird aktiver gepflegt (01.09.2026 gegen 15.07.2026). Ohne Zeitstempel gäbe es nach
Projektregel 3 keine Sprungmarken.

### Empfehlung für den Mac

**Beste Qualität und Geschwindigkeit: primeline über CoreML/ANE** (8,4 %, 352x). Das
verlangt allerdings ein eigenes Swift-Binary mit FluidAudio neben dem Python-Host – der
Prototyp `anevergleich` existiert, ein ausgeliefertes Binary nicht. **Noch nicht gebaut,
Entscheidung offen.**

Bis dahin ist die eingebaute sherpa-onnx-Route auch auf dem Mac die richtige Wahl: 9,3 %
gegen 8,4 % ist ein knapper Prozentpunkt, und 32x reichen für ein Zehn-Minuten-Video
(rund 20 Sekunden). Zwischen den beiden primeline-Konvertierungen entscheidet nichts –
0,1 Prozentpunkt ist Rauschen; ValentinWeyer liefert die `conversion_metadata.json` mit.

### Grenzen dieser Messung, ehrlich benannt

- Die Referenzen sind **lektorierte** TED-Untertitel: Füllwörter und Wiederholungen
  fehlen dort, wörtlich transkribierende Modelle werden dafür bestraft. Die absoluten
  Werte sind deshalb höher als die reine Erkennungsleistung; der Vergleich *zwischen*
  den Modellen bleibt gültig, weil alle gegen dieselbe Referenz laufen.
- Die ONNX-Wege schneiden hart bei 120 bzw. 300 Sekunden ohne Überlappung, FluidAudio
  segmentiert intern besser. Geschätzter Nachteil 0,1 bis 0,3 Prozentpunkte zulasten
  der ONNX-Wege.
- **Windows, Linux und CUDA sind nicht gemessen** – dafür fehlt die Hardware. Belegt ist
  nur, dass `onnxruntime` Räder für `win_amd64`, `win_arm64`, `manylinux x86_64/aarch64`
  und `macosx x86_64` veröffentlicht und sherpa-onnx `provider="cuda"` kennt.
- Die Prüfung durch Codex und Fable wurde auf Wunsch abgebrochen, bevor Berichte vorlagen.

## Stand 03.09.2026 (zwanzigster Durchgang) – primeline vs. v3 auf der ANE, Plattformweg für Windows/Linux gefunden

### Ergebnis, das die Empfehlung trägt

Auf der Apple Neural Engine (FluidAudio/CoreML) schlägt das deutsche Spezialmodell
**primeline** (3,0 % Wortfehler) sowohl `parakeet v3` (5,9 %) als auch
`whisper-large-v3` (4,1 %) auf demselben deutschen Referenztext. Beide geprüften
primeline-Konvertierungen (`ValentinWeyer` und `matt-2012`) liegen gleichauf. Volle
Messreihe in [docs/messungen.md](docs/messungen.md).

**Folge für die Erweiterung:** primeline als zweites, deutsch-optimiertes Modell
anbieten – nicht als Ersatz für v3, das für Englisch und alle anderen Sprachen das
richtige Standardmodell bleibt. Vorschlag für den Helfer-Dialog: Erkennt YouTube am
Video eine deutsche Originalsprache und werden Untertitel gebraucht, fragen
„Für bessere Qualität auf Deutsch: spezialisiertes Modell laden (primeline, 1,2 GB)
oder das allgemeine Modell verwenden (parakeet v3, 480 MB, bereits geladen)?" –
mit dem klaren Hinweis, dass **beide Modelle nebeneinander bestehen bleiben** und v3
für andere Sprachen weiterhin genutzt wird. **Noch nicht umgesetzt, Entscheidung
über den genauen Dialogtext steht bei Michael offen.**

### Reale Modellgrössen (abgerufen über die HuggingFace-API, nicht geschätzt)

| Modell | CoreML (ANE) | ONNX int8 |
|---|---|---|
| parakeet v3 | 482 MB | 670 MB |
| primeline (ValentinWeyer) | 1224 MB | – |
| primeline (matt-2012) | 1211 MB | – |
| primeline (OpenVoiceOS, ONNX) | – | 672 MB |

### Sprachvorgabe bei FluidAudio ist für die WER wirkungslos

`language: "de"` statt `nil` an `AsrManager.transcribe` ändert bei v3 nichts an der
Fehlerzahl (weiterhin 80 von 1353 Wörtern) – der Parameter steuert nur die
Schriftfilterung für nicht-lateinische Schriften, nicht die Wortgenauigkeit.

### Plattformweg für Windows, Linux und Intel-Mac gefunden

`onnxruntime` (PyPI, Version 1.29.0) liefert fertige Räder für `win_amd64`,
`win_arm64`, `manylinux x86_64`, `manylinux aarch64`, `macosx x86_64` (Intel) und
`macosx arm64` – ein einziger Weg über `onnx-asr` bzw. `sherpa-onnx` für alle vier
Zielplattformen, mit denselben ONNX-Modelldateien wie oben. Auf macOS/Apple Silicon
lokal getestet: `onnx-asr` lädt `nemo-parakeet-tdt-0.6b-v3` mit `quantization="int8"`
und dem primeline-ONNX-Ordner gleichermassen; `onnxruntime` meldet dort
`CoreMLExecutionProvider` als schnellsten verfügbaren Provider. **Noch nicht
gemessen: echte Windows/Linux-Läufe und eine CUDA-GPU-Messung** – dafür fehlt hier
die Hardware, wird als ungetestet geführt, nicht geschätzt.

### Offen aus dieser Sitzung

- Weitere deutschsprachige TEDx-Referenzvideos mit von Hand erstellter
  Untertitelspur werden gesucht, um den 3,0-%-Wert an einem zweiten, längeren Text
  gegenzuprüfen – Suche lief beim Sitzungsende noch (127 Kandidaten geprüft, siehe
  `scratchpad/finde-referenzen.py`, liegt ausserhalb des Projekts und ist nach
  Sitzungsende weg).
- Serielle End-zu-Ende-Geschwindigkeitsmessung aller Wege in einer Tabelle steht
  noch aus (parallel gemessene Werte sind nicht vergleichbar).
- Testbrowser Chrome (Debug-Port, Profilkopie) läuft noch offen für die
  Weiterarbeit an dieser Frage.

## Stand 03.09.2026 (neunzehnter Durchgang) – Modellsuche neu gebaut, Tempo 8x, STT-Wege vermessen

### Die Modellsuche ist jetzt ein eigenes Feld, kein Radix-Select mehr

Drei Anläufe, zwei davon gescheitert – nachzulesen in
[docs/messungen.md](docs/messungen.md). Radix setzt den Fokus neu, sobald sich die Liste
ändert; im Feld blieb ein einzelner Buchstabe stehen. Das Abfangen der Tasten am Content
machte daraus eine Anzeige ohne Cursor („nicht überschreibbar“). Michaels Verweis auf
Contao war der Ausweg: dort ist es eine echte Combobox, kein aufgebohrtes Auswahlfeld.

Neu in [ModellWahl.tsx](extension/entrypoints/options/ModellWahl.tsx): Auslöser-Knopf,
Panel mit gewöhnlichem `<input>`, Pfeiltasten/Enter/Esc, Klick-daneben über `mousedown`
(bei `click` verschluckt das schliessende Panel die Auswahl). Im Browser geprüft: tippen,
dreimal Rücktaste, alles markieren und überschreiben, Auswahl per Eingabetaste.

### Live-Weg: Tempo 8x statt 4x

Gemessen an `JTFq1MM9bYA`, 120 s Videozeit, whisper-large-v3-turbo mit `language: "de"`:
4x, 6x und 8x liefern gleich gute Ergebnisse (8x sogar einen Satz mehr als 4x), ab 12x
kommen die ersten Fehler, 16x ist unbrauchbar. **Ende zu Ende für 5:06 jetzt 43,5 s statt
109 s.** Der Player schafft bis 15,89x.

Zwei Nebenbefunde: Ohne Sprachvorgabe hielt Whisper deutschen Ton für Englisch und
übersetzte halb – deshalb übernimmt der Live-Weg ab dem zweiten Stück die im ersten Stück
erkannte Sprache. Und der Ton bleibt stumm (`GainNode(0)`), das Tempo wird über
`preservesPitch = false` erreicht.

### Zahlen im System-Prompt: keine Tausendertrennzeichen, in keiner Sprache

Michaels Vorgabe, wörtlich: „weg mit diesen fucking tausendertrennern“. Aus „1,500
dollars“ wird auf Deutsch „1500 Dollar“ und auf Englisch „1500 dollars“. Der Punkt als
englisches Dezimalzeichen bleibt eine Zahl und wird nur im Zeichen getauscht: „3.5 hours“
→ „3,5 Stunden“. Ist die Lesart nicht eindeutig, bleibt die Zahl **unverändert**.

Zur Vorgeschichte, damit die Fehldeutung nicht wiederkehrt: Das Beispiel „11,587 Dollar“
in einer früheren Prompt-Fassung (Commit d688efc) stammte aus **einer Modellausgabe**,
nicht aus einem Transkript. Ich hatte es zweimal falsch gelesen und beim zweiten Mal ein
Transkript dazu erfunden; git hat das aufgeklärt.

### Lernfragen mit Zitatblock, Fazit ohne Sprungmarken

Frage und Antwort waren im Fliesstext nicht zu trennen. Jetzt steht die Antwort als
Zitatblock unter der Frage. Beim Fazit steht die Formvorgabe („Fliesstext ohne
Überschriften, ohne Aufzählung und ohne Zeitstempel“) jetzt **am Ende** des Prompts –
Michaels Beobachtung, Gemini setze dort Sprungmarken, liess sich zwar nicht reproduzieren
(beide Modelle 0 Zeitmarken), die Härtung bleibt.

### Spracherkennung: der Laufzeitweg wiegt schwerer als das Modell

Vollständige Zahlen in [docs/messungen.md](docs/messungen.md). Kurz: dasselbe Modell
`parakeet v3` liefert 15,7 % Wortfehler über `parakeet-mlx` mit Standard-Chunking, 8,5 %
ohne Chunking und 5,9 % über FluidAudio/CoreML – so, wie DiktaGo es lädt. Das deutsche
Spezialmodell **primeline erreicht auf demselben Weg 3,0 %** und ist damit besser als
whisper-large-v3 (4,1 %).

**Folge für den Helfer:** `sttRoute: parakeet-mlx` läuft derzeit mit der schlechtesten
Voreinstellung. Mindestens `--chunk-duration 0` setzen; besser wäre der Wechsel auf
FluidAudio, der aber ein Swift-Binary neben dem Python-Host bedeutet. **Noch nicht
umgesetzt, Entscheidung offen.**

## Stand 03.09.2026 (achtzehnter Durchgang) – Version 0.2.0, drei Wege gemessen, vier neue Schnellbefehle

**Versionsnummern ab jetzt geführt**, Schema `major.function.fix`. Die Version steht im
Kopf der Optionsseite mit dem Build dahinter („0.2.0 full“ / „0.2.0 store“), damit beim
Testen sichtbar ist, was im Browser steckt. 0.1.1 waren die zwei Befunde unten, 0.2.0
sind die vier neuen Schnellbefehle.

### Ende-zu-Ende in Michaels angemeldetem Profil, alles per Klick in der Seitenleiste

Testaufbau: Chrome mit einer Kopie von Michaels Profil (angemeldet), Debug-Port 9222,
`--mute-audio`, Erweiterung aus `build-full`. Video `JTFq1MM9bYA` (5:06, deutsch, **ohne
jede Untertitelspur**, mit `yt-dlp --list-subs` geprüft).

| Weg | ab Klick | Kosten | Qualität |
|---|---|---|---|
| Helfer + `openai/whisper-large-v3-turbo` (OpenRouter) | **13,5 s** | bezahlt | beste Wortgenauigkeit, aber grobe Blöcke (bis 19 s je Cue) |
| Helfer + `parakeet-tdt-0.6b-v3` (MLX, lokal) | **16,6 s** | 0 | einzelne Wortfehler („Michela“, „herlen“), Zeitmarken fein |
| Live 4x im Tab (Store-Weg, Whisper) | **109 s** | bezahlt | gut, feine Zeitmarken |

Der Store-Weg ist also **achtmal langsamer** als der Helfer, liefert aber die besten
Sprungmarken – und ist im Store-Build der einzige Weg. Zusätzlich geprüft: 46-s-Video in
16 s, Fortschrittsanzeige („Erkennt … 03:15 / 05:06“) und Abbrechen-Knopf laufen.

Der Chat-Weg wurde im selben Aufbau geprüft: Untertitel gelesen, „Fazit“ geklickt,
inhaltlich korrekte deutsche Zusammenfassung in der Seitenleiste.

### Zwei Befunde repariert (0.1.1)

- **„Keine Untertitel“ brauchte über 20 Sekunden.** Ursache: Meldet der Player gar keine
  Spur, lief trotzdem der zweite Weg über YouTubes Transkript-Panel und verwartete dort
  seine 8 + 12 Sekunden. Jetzt bricht `loadTranscript` sofort ab, wenn die Spurenliste
  leer ist. **Gemessen: 4,0 s statt über 20 s.**
- **Fehlender Native-Host meldete sich technisch.** Der Fehlertext war vorhanden (mein
  früherer Befund „stiller Fehlschlag“ war ein Messfehler: mein Ausleseskript zeigte nur
  die letzten 200 Zeichen der Seitenleiste). Ergänzt ist jetzt der Handlungssatz, was zu
  tun ist. Ursache im Testaufbau: **Chrome sucht das Host-Manifest im Ordner des jeweiligen
  Profils** – eine Instanz mit eigenem `--user-data-dir` sieht die Installation im
  Standardprofil nicht. Im Testprofil per Symlink gelöst.

### Vier neue Schnellbefehle (0.2.0)

Codex (sol, high) und Fable 5.1 haben unabhängig voneinander dieselben Lücken benannt:
Aneignen und Weiterverfolgen fehlten ganz. Neu, von Michael ausgewählt: **Begriffe**
(Glossar aus den Erklärungen des Sprechers), **Verweise** (Bücher, Studien, Personen,
Werkzeuge), **Lernfragen** (8 bis 12 Fragen mit Antwort und Zeitmarke), **Positionen**
(bei Gesprächen: wer was vertritt). Damit zwölf Knöpfe in drei Reihen.

Am System-Prompt behoben: der Widerspruch zwischen Prompt („eine Minute“) und Code
(`MIN_MARKEN_ABSTAND = 30`), die Zahlenregel (Rundung stand gegen „keine Umrechnung“, und
englisches „11,587 dollars“ blieb als Komma stehen), der tote Satz zur
Übersetzungsfunktion, die Meta-Aussage über die Oberfläche (Modelle erwähnen fehlende
Zeitstempel trotzdem), „Erfinde nichts“ steht jetzt an erster Stelle. Bei den Presets:
Doppelung im Schluss von „Kernaussagen“, die Grenze zwischen „Fakten“ und „Behauptungen“
in beiden Prompts, ein Kürzungshinweis in „Ausführlich“ gegen stillen Verlust bei langen
Videos, körperliche Abläufe in „Anleitung“ (Position, Kontaktpunkt, Druck, Dauer).

### Der eingefrorene System-Prompt in Michaels Profil ist weg

Am 02.09.2026 über den Debug-Port von Vivaldi nachgesehen: das Feld `systemPrompt` steht
gar nicht mehr im gespeicherten Einstellungsobjekt, damit greift der aktuelle Standard.
Der frühere Befund hat sich mit der Änderung in `storage.ts` erledigt, die den Prompt nur
noch speichert, wenn er vom Standard abweicht.

## Stand 02.09.2026 (siebzehnter Durchgang) – Modellauswahl, acht Schnellbefehle, Wörterbuch

### Empfohlene Modelle stehen oben, das Slug-Feld ist weg

`EMPFEHLUNG` in [lib/openrouter.ts](extension/lib/openrouter.ts) führt elf Modelle mit
einer Marke (Standard, Sweet Spot, günstig, schnell, schlau); sie bilden die erste Gruppe
des Auswahlfelds, darunter folgt die vollständige Liste nach Anbietern. Die Gruppe
„Zuletzt erschienen" ist entfallen, das Feld „Eigener Modell-Slug" ebenfalls – wer ein
seltenes Modell will, findet es über das Filterfeld.

Am 02.09.2026 gegen die Live-Liste geprüft: alle elf Slugs existieren und überstehen den
Filter (Kontext ≥ 128k, Ausgabe nur Text). Preise je Anfrage, gerechnet mit 30.000 Token
Eingabe und 2.000 Ausgabe: 0,0012 $ (Qwen3.7 Flash) bis 0,2000 $ (Claude Opus 5).
Standardmodell ist jetzt `openai/gpt-5.6-luna` (0,0084 $) statt Gemini 3.5 Flash Lite.

Nicht aufgenommen, weil sie je Anfrage das Hundert- bis Siebenhundertfache kosten, ohne
hier besser zu antworten: `openai/o1-pro` (5,70 $), `openai/gpt-5.4-pro` und
`gpt-5.5-pro` (je 1,26 $), `openai/o3-pro` (0,76 $), `anthropic/claude-fable-5.1`
(0,40 $), `openai/gpt-4-turbo` (0,36 $).

Preise unter einem Cent stehen jetzt in Cent (`0,84 ¢`) statt als „< 0,01 $" – acht der
elf Empfehlungen lagen sonst preisgleich da.

### Acht Schnellbefehle in zwei Reihen

```
Fazit · Kernaussagen · Ausführlich · Kapitel      das ganze Video, in vier Formen
Fakten · Behauptungen · Anleitung · Pro/Contra    ein Ausschnitt für einen Zweck
```

Neu sind **Behauptungen** (bis zu 15 Behauptungen, je mit Belegart: Gemessen, Quelle,
Gezeigt, Erfahrung, Unbelegt – der Vorlauf zur Weltkugel), **Anleitung** (nummerierte
Schritte mit Befehlen, Werten und Zeitstempel) und **Pro/Contra** (zwei Listen, dazu
„Für wen", „Alternativen", „Nicht geprüft"). Prompts von Fable, deutsch und englisch.

Gemessen im Browser: zwei Reihen à vier Knöpfen, je 31 px hoch, nötige Breite 339 und
366 px – bei der Standardbreite von 500 px bricht nichts um. Ausgeblendet wird kein
Knopf: passt er nicht zum Video, sagt sein Prompt das in einem Satz.

### Wörterbuch gegen verhörte Eigennamen

In den Optionen ein Textfeld, eine Zeile je Eintrag:
`Cloud Code => Claude Code` ersetzt, `DiktaGo` setzt nur die Schreibweise durch, `#`
leitet einen Kommentar ein. Gespeichert wird der Text, nicht die geparste Liste – so
bleiben Reihenfolge und Kommentare erhalten.

Angewendet wird auf **jedes** Transkript, egal woher es kommt, und zwar zeilenweise beim
Übernehmen: dadurch steht die richtige Schreibweise auch im Export, im Prompt und in der
Übersetzung, und kein Begriff wird über eine Zeilengrenze hinweg ersetzt. Zusätzlich
nennt der System-Prompt die Begriffe, die im Transkript tatsächlich vorkommen.

Übernommen sind nur DiktaGos Stufen 1 und 2. Die Fuzzy-Stufen (ein vertauschter
Buchstabe, Kölner Phonetik) brauchen das Realwort-Veto über NSSpellChecker; im Browser
gibt es keine Rechtschreibprüfung als API. Ohne dieses Veto wurde in DiktaGos eigener
Messung an 25.193 Wörtern aus „Kind" ein „Contao" und aus „Bild" ein „Build".

Die kanonische Schreibweise ist am Wortanfang verankert, nicht am Wortende – sonst
scheitert sie an jeder deutschen Endung. Am echten Transkript geprüft: aus
„Neuroenergetische" wird „NeuroEnergetische", die Endung bleibt stehen. Bei den
Ersetzungspaaren bleibt die Verankerung an beiden Enden, sonst griffe „the" in „theater".

### Store-Audioweg: gebaut und in Michaels Chrome belegt

`lib/audio-live.ts` erzeugt ein Transkript aus dem laufenden Ton, ohne Download – der
Knopf „Transkript per Spracherkennung erstellen" steht in **beiden** Builds und ist im
Store-Build der einzige Weg, wenn Untertitel fehlen.

Belegt am 02.09.2026 in einer Kopie von Michaels angemeldetem Chrome-Profil (Zahlen in
[docs/messungen.md](docs/messungen.md)): 30 Sekunden Aufnahme deckten 85,2 Videosekunden
ab, Whisper meldete 85,15 Sekunden – die Rückrechnung über den WAV-Kopf trifft auf
0,05 Sekunden. Sprache korrekt erkannt, 13 Segmente, sauberer Fachtext.

**Codex hat den Aufbau gegengelesen und fünf Löcher gefunden, alle behoben:**

1. Die WAV-Rate wurde gerechnet statt gemessen. Bei einem Stocker oder einem Rate-Reset
   enthält ein „120-Sekunden-Stück" weniger Videozeit, und alles verschiebt sich – ohne
   Fehlermeldung. Jetzt entsteht die Rate aus Abtastwerten je tatsächlich vergangener
   Videosekunde. In der Probe wurden statt der gerechneten 11.025 Hz tatsächlich
   15.489 Hz gebraucht.
2. Nach einer Werbung wurde das Tempo nicht neu gesetzt, und der Stückbeginn blieb auf
   der Laufzeit der Werbung stehen – die folgenden Sprungmarken hätten um deren Länge
   danebengezeigt.
3. Ein Stück ohne Segmente verlor seinen Text, sobald ein anderes Stück welche lieferte:
   ein lückenhaftes Transkript, das vollständig aussieht.
4. Die vom Modell erkannte Sprache wurde weggeworfen; sie steht jetzt in
   `Transcript.lang` und damit auch der Übersetzung zur Verfügung.
5. Endet die Tonspur mitten im Lauf, kam nur noch Stille an. Jetzt sagt die Meldung, was
   passiert ist, statt „geschützt oder stumm" zu behaupten.

Dazu aus der Probe selbst: Whisper läuft am Stückende über (letztes Segment bei 114,9 s
in einem 85,2-Sekunden-Stück) – die Zeiten werden geklemmt.

### Was am Store-Weg noch aussteht

Der Ende-zu-Ende-Lauf über den Knopf in der Seitenleiste, also Knopfdruck bis fertiges
Transkript im Tab. Er braucht eine freie Internetleitung und wurde deshalb verschoben.

### Ursprüngliche Architekturentscheidung (Fable)

- `video.captureStream()` im Content-Script, **nicht** `chrome.tabCapture`: letzteres
  verlangt eine Extension-Invocation per Toolbar-Klick, ein Klick in der Sidebar zählt
  nicht.
- Faktor 4 beim Abspielen (`preservesPitch = false`), das Ergebnis ist rückrechenbar.
  Faktor 8 ist gemessen ausgeschieden (siehe [docs/messungen.md](docs/messungen.md)).
- Transkribiert wird über OpenRouter, nicht über Whisper-WASM.
- Vier Fälle abzufangen: `ratechange` durch den Nutzer, Werbung (`.ad-showing`),
  SPA-Navigation, und Widevine-Stille bei geschützten Inhalten.

## Stand 02.09.2026 (nachts, sechzehnter Durchgang) – drei Lesestufen

Der Transkript-Tab hat **drei Stufen statt zwei**, in denen die Verdichtung von links
nach rechts zunimmt:

| Stufe | Symbol | Zeit | Aufgabe |
|---|---|---|---|
| Untertitel | `Captions` | je Zeile | zitieren |
| Absätze | `AlignLeft` | je Absatz | mitlesen |
| Lesetext | `BookOpenText` | keine | lesen |

Der **Kopieren-Knopf liefert, was zu sehen ist** – kein dritter Knopf, kein
Modus-Sonderfall. Herunterladen bleibt der Vollbestand mit Zeitmarken, damit jede
sinnvolle Kombination genau einen Ort hat. Der Tooltip nennt die Stufe.

Leseabsätze bauen auf den Absätzen der zweiten Stufe auf (sammeln bis 150 Wörter, früher
schliessen an einer Sprechpause ab drei Sekunden ab 50 Wörtern). Gemessen: 218 Cues → 36
Absätze → 12 Leseabsätze mit 159 bis 207 Wörtern. Geprüft im Selfcheck (13 Prüfungen).

Die zwei Sprachfelder der Kopfzeile tragen jetzt ihr Symbol davor – Untertitelsymbol vor
der Spurwahl, Übersetzen-Symbol vor der Zielsprache. **Fable riet stattdessen, Knopf und
Zielsprache zu einem einzigen Auswahlfeld zu verschmelzen** („Übersetzen …" als
Ruheeintrag, Sprachwahl löst aus, spart 32 px). Der ausdrückliche Wunsch war die Variante
mit zwei Symbolen; Fables Alternative liegt als Option auf dem Tisch.

**Presets gegen ein echtes Video gemessen** (`9D-xzper0wQ`, gemini-3.5-flash-lite):
Kapitel liefert 8 Sprungmarken mit sauberen Überschriften, Fakten 16 Sprungmarken nach
Themen gruppiert, Argumente 6. Ein Mangel: das **Fazit rät bei unsicheren Angaben in
Klammern** („viermonatige (bzw. viertägige/vierwöchige) Kurs"), während das
Fakten-Preset an derselben Stelle korrekt „Vier Wochenenden [04:26]" schreibt.

## Stand 02.09.2026 (nachts, fünfzehnter Durchgang) – Transkript-Tab neu

Der Transkript-Tab hat jetzt **zwei Lesearten und zwei Inhalte**, jede Achse mit genau
einem Schalter: Untertitelzeilen oder Fliesstext in Absätzen, Original oder Übersetzung.
Ein Dreierschalter, der beides mischt, wäre der unklare Zustand, den es hier nicht geben
soll.

**Die Übersetzung läuft im Tab, nicht im Chat.** Sie landet zeilenweise in `texts[]`,
behält die Zeitspalte, lässt sich abbrechen und danach fortsetzen (Tooltip nennt dann
„Übersetzung fortsetzen · 37/218"). Der Übersetzen-Knopf im Chat ist weg – das war nie
eine Chat-Funktion. Die **Zielsprache steht neben dem Knopf** und schreibt in die
Einstellungen zurück; ein deutsches Transkript ins Englische zu übersetzen war vorher
gar nicht erreichbar. Steht das Ziel auf der Quellsprache, ist der Knopf aus.

Dazu ein **Zeit-Sync**: das Fadenkreuz springt zur laufenden Stelle und läuft mit, bis
der Nutzer selbst scrollt. Und eine **Suche** in der Ansichtszeile, deren Trefferzahl
Fundstellen zählt, nicht gefilterte Zeilen.

Vier Fehler, die dabei ans Licht kamen und behoben sind, stehen mit ihren Messwerten in
[docs/messungen.md](docs/messungen.md): die Spurauswahl nahm die automatische statt der
redigierten Spur, der Stopp-Knopf hing (`port.onDisconnect` feuert nur am anderen Ende),
die **Options-Seite rendete gar nichts** (vier Hooks hinter dem frühen Return), und ein
Zeitstempel-Klick während einer Anzeige spulte die Werbung.

Geprüft im headless-Testbrowser an `9D-xzper0wQ`: Spurwahl „Deutsch" (218 statt 364
Zeilen), Fliesstext 36 Absätze, Suche 17 Treffer, Übersetzung Deutsch ➔ Englisch mit
Abbruch bei 37/218, Folgemodus scrollt auf 2016 px und schaltet beim Scrollen ab,
Options-Seite meldet `downloadable` mit gesperrtem Schalter und Ladeknopf.

## Stand 02.09.2026 (nachts, vierzehnter Durchgang) – Zielsprachen als Liste

Der Tooltip des Übersetzen-Symbols nennt jetzt beide Sprachen ausgeschrieben:
**„Transkript mit KI übersetzen: Englisch ➔ Deutsch"** – Kürzel wären dort keine
Erleichterung, der Text ist ohnehin lang.

Die Zielsprache war ein **Freitextfeld**, in dem ein Tippfehler still zu „de" wurde. Sie
ist jetzt eine Auswahlliste aus zwölf Sprachen (`ZIELSPRACHEN` in `lib/tracks.ts`,
westeuropäisch plus Polnisch, Tschechisch, Ungarisch, Russisch, Türkisch) und
`languageToCode` liest gegen dieselbe Liste – eine Quelle statt zweier.

**Offen:** eine Zielsprachwahl direkt im Transkript-Tab, damit man ein deutsches
Transkript ohne Umweg über die Optionen ins Englische übersetzen kann. Sie gehört in
dieselbe Kopfzeile, die gerade neu entworfen wird (Untertitel/Fliesstext, Zeit-Sync) –
deshalb zusammen mit dieser Umstellung.

## Stand 02.09.2026 (nachts, dreizehnter Durchgang) – zwei Wege ins Netz

Die Internetsuche hat jetzt **zwei Bedienstellen mit verschiedenen Aufträgen**:

**Der Schalter rechts unter dem Eingabefeld** (Weltkugel mit Zustand) gilt für die nächste
getippte Frage: Transkript und Netz zusammen. Er bleibt an, bis er ausgeschaltet wird.
Angezeigt wird im Chat die reine Frage, gesendet wird sie samt Kontextzeile mit Titel und
Kanal – aus dieser Nachricht bildet OpenRouters Web-Plugin seine Suchanfrage.

**Die Weltkugel unter einer Antwort** schlägt zu einer **schon beantworteten** Frage nach.
Der Auftrag verbietet dort ausdrücklich die Wiederholung: „Diese Frage wurde bereits
anhand des Transkripts beantwortet. Wiederhole diese Antwort nicht und schreib auch nicht
noch einmal, was im Transkript fehlt. Schreib nur, was die Suche ergibt." Genau dafür
drückt man den Knopf – man hat gerade gelesen, dass im Transkript nichts dazu steht.
Tooltip: „Im Netz nachschlagen zur letzten Frage".

`webSearchPrompt` ist damit weggefallen, an seine Stelle treten `webKontext` (die
Kontextzeile, beide Wege) und `webLookupPrompt` (das Nachschlagen).

## Stand 02.09.2026 (nachts, zwölfter Durchgang) – Spurwahl, Kurznamen, Übersetzen-Symbol

### „German (auto-generated) (automatisch)" ist Geschichte

Der Zusatz kam doppelt: YouTube schreibt „auto-generated" in den Namen, die Extension
hängte „(automatisch)" an. Im zweiten Anlauf kam er noch einmal doppelt, weil Kürzel und
Name ihn beide setzten („en (auto) · Englisch (auto)") – jetzt steht er genau einmal am
Ende der Zeile. Dazu `white-space: nowrap` samt Auslassungspunkten am Kasten und an
`selectedcontent`: der gewählte Text brach sonst unter das Feld. Die Wahrheit steht im Flag `auto`. Neues Modul
`lib/tracks.ts`: es steht nur noch der ausgeschriebene Name in der Sprache der Oberfläche
– **„Deutsch (auto)"**, nicht „German (auto-generated) (automatisch)" – über
`Intl.DisplayNames`, YouTubes Rohname nur als Rückfall. Die Liste ist alphabetisch nach
diesem Namen sortiert; bei 31 Spuren ist YouTubes eigene Reihenfolge nicht
nachvollziehbar. Die Sprachkürzel sind auf Wunsch wieder raus, `kurzcode` und `kurzname`
bleiben im Modul für den Fall, dass sie an anderer Stelle gebraucht werden.

### Gestaltetes Dropdown statt Browser-Grau

Chrome kann seit Version 135 auch die aufgeklappte Liste gestalten
(`appearance: base-select`, `::picker(select)`), im Testbrowser 152 bestätigt
(`CSS.supports` → true). Damit bleibt es beim **nativen `select`**: Tastatur, Typ-Sprung
und Escape bringt der Browser mit – bei einem Video mit 31 Spuren zählt das –, und die
Liste liegt im Top Layer, also nicht im `overflow-hidden` der Karte gefangen. Eine eigene
Listbox wären rund 120 Zeilen Fokuslogik ohne Gewinn. Wo `base-select` fehlt, greift das
davorstehende `appearance: none`: der Kasten sieht richtig aus, nur die Liste bleibt die
des Browsers.

**Nur eine Spur:** gleiche Höhe und Stelle, aber ohne Rahmen und Pfeil. Ein ausgegrautes
Auswahlfeld lädt zu einem Klick ein, der nichts bewirkt; ohne Rahmen liest es sich als
Beschriftung, und das ist die Wahrheit. Die Kopfzeile steht auf fester Höhe (`h-9`,
gemessen 40 px bei uiScale 110) und springt in keinem der beiden Fälle.

### Übersetzen-Symbol im Transkript

`Languages` an erster Stelle rechts, Tooltip „Transkript übersetzen → Deutsch". Es
übersetzt **immer das Transkript**, auch wenn im Chat eine Antwort steht – im
Transkript-Tab ist alles andere überraschend. Der Unterschied zum Spurwechsel links ist
strukturell: links steht die Quelle, rechts stehen die Aktionen darauf; der Spurwechsel
tauscht den Transkript-Tab aus, die Übersetzung wird eine Chat-Antwort.

### Zusatz zum Prompt gehört zu den Schnellbefehlen

Er steht jetzt unter den Preset-Knöpfen und erscheint mit ihnen; unten stand er dauerhaft
im Weg, obwohl er selten gebraucht wird.

### Recherche: auch der Kanal geht in die Suchanfrage

Titel allein reicht nicht immer – „Fable 5.1" wird erst mit dem Kanalnamen eindeutig.
Beides steht in der Nachricht, aus der OpenRouters Web-Plugin seine Suchanfrage bildet.

## Stand 02.09.2026 (nachts, elfter Durchgang) – Internetrecherche zur Frage

Unter jeder Antwort steht jetzt eine **Weltkugel**: sie schickt dieselbe Frage noch einmal
los, diesmal mit Internetsuche.

**Der Videotitel steht dabei in der Nachricht, nicht im System-Prompt.** OpenRouters
Web-Plugin bildet seine Suchanfrage aus dem Inhalt der letzten Nutzernachricht – eine
Rückfrage wie „Ist Fable besser in Sprache?" ist für eine Suchmaschine ohne den Titel
wertlos, mit ihm findet sie das Modell, um das es im Video geht. Der Auftrag verlangt
zusätzlich, zwischen dem zu unterscheiden, was das Video behauptet, und dem, was die
Quellen sagen.

Technisch `plugins: [{ id: "web", max_results: 5 }]` an derselben Chat-Anfrage, also
**kein zweiter Anbieter und kein eigener Suchdienst** – Projektregel 1 bleibt unberührt.
Die Fundstellen kommen als `annotations` mit `url_citation` im Stream zurück und stehen
als Linkliste unter der Antwort; ohne sie wäre nicht nachprüfbar, worauf die Antwort
beruht.

**Der Knopf erscheint bei jedem Modell**, nicht nur bei Gemini: OpenRouter führt die Suche
selbst aus und reicht die Treffer an das gewählte Modell weiter. Die Kosten von rund
0,007 $ je Anfrage stehen im Tooltip.

**Nicht geprüft:** ein echter Recherchelauf – dafür braucht es den Key.

## Stand 02.09.2026 (nachts, zehnter Durchgang) – Suche und Spurwahl im Transkript

Über der Transkriptliste steht jetzt eine **Suchzeile**: sie filtert die Zeilen auf die
Treffer, hebt den Begriff hervor und zeigt die Trefferzahl, ein X leert sie wieder.
Gemessen: bei „cool" bleiben von 6 Zeilen 2 übrig, mit 2 Hervorhebungen. Die Suche
erscheint nur bei einem Transkript mit Zeitstempeln – ohne Zeilen gibt es nichts zu
filtern.

Die **Spurwahl war schon da, aber auf 60 % Breite gestutzt** und damit abgeschnitten. Sie
steht jetzt über die volle Breite (`flex-1`), die Werkzeugsymbole daneben bleiben
schrumpffrei. Sie erscheint weiterhin nur, wenn das Video mehr als eine Spur hat – bei
einer Spur steht dort die Quelle.

## Stand 02.09.2026 (nachts, neunter Durchgang) – volle Höhe, Schnellbefehle, Farben hell

### Die Karte nimmt jetzt die ganze sichtbare Höhe

`h-[calc(100vh-80px)]` an einer **unskalierten Hülle**, das gezoomte Kind steht auf
`h-full`. Der Grund steht in [docs/messungen.md](docs/messungen.md): `zoom` multipliziert
Viewport-Einheiten mit, Prozentwerte nicht – `h-[72vh]` am gezoomten Element waren bei
uiScale 110 in Wahrheit 79 vh. Gemessen bei 913 px Fensterhöhe: Karte von 68 bis 901 px,
833 px hoch, Nachrichtenbereich 673 px (vorher 512).

Nicht `sticky`: eine Karte über die volle Höhe würde beim Scrollen die Empfehlungen
darunter verdecken, und YouTubes Kopfzeile blendet sich in manchen Layouts aus – dann
stünde ein 56-px-Loch. Die Karte scrollt mit dem Video weg, wie der Player selbst.

### Die Knopfleiste klappt sich weg

Sichtbar, solange der Chat leer ist; sobald etwas darin steht, verschwindet sie und ein
Zauberstab-Symbol in der Kopfzeile holt sie zurück. Nach jedem Senden klappt sie wieder
ein. Bewusst **nicht gespeichert**: der Zustand leitet sich aus `messages.length` ab und
fällt beim Videowechsel zurück – ein gespeicherter Wert brächte verwaiste Einträge für
den seltenen zweiten Preset-Klick, der so genau einen Klick kostet.

### Eingabezeile und Sendeknopf kleiner

Feld und Knopf stehen auf 32 px statt 38 (`py-[5px]`, `size-8`), das Symbol im Knopf auf
18 px, das Zusatzfeld darüber auf 24 px mit gestricheltem Rand. Schrift bleibt bei 14 px –
dieselbe wie der Chattext, sonst springt der Text beim Absenden in eine andere Grösse.

**Das Symbol ist jetzt ein Pfeil statt des Papierfliegers.** Nachgemessen: die Bounding-Box
von `Send` ist zentriert, die Masse des Dreiecks aber nicht – Schwerpunkt bei (13, 11)
statt (12, 12), das Symbol wirkt nach oben rechts versetzt. `ArrowUp` ist in beiden Achsen
symmetrisch.

### Hell folgt jetzt auch YouTube

`#FFFFFF` Grund, `#F2F2F2` für Chips und Knöpfe, `#0F0F0F` Text, `#606060` sekundär,
`#E5E5E5` Ränder. Der warme Beigeton aus DiktaGo ist raus – neben YouTubes neutralem Grau
las er sich als Fremdkörper. Gemessen: unsere Knöpfe `rgb(242, 242, 242)`.

## Stand 02.09.2026 (nachts, achter Durchgang) – Kopieren mit zwei Formaten

Der Kopier-Knopf legt jetzt **Markdown und HTML nebeneinander** in die Zwischenablage
(`ClipboardItem` mit `text/plain` und `text/html`). Das Zielprogramm nimmt sich, was es
braucht: Word, Pages und Google Docs greifen zum HTML und behalten Überschriften, Listen
und Fettdruck, ein Editor bekommt den Markdown-Text.

**Das ist keine Mac-Besonderheit.** Chromium bildet die beiden MIME-Typen auf die nativen
Formate ab – `CF_HTML` plus `CF_UNICODETEXT` unter Windows, `NSPasteboard` unter macOS,
MIME-Targets unter X11/Wayland. Derselbe Aufruf, dieselbe Wirkung auf allen drei Systemen.
Gemessen in Chrome 152: nach dem Klick liegen beide Typen in der Zwischenablage,
`text/plain` 140 Zeichen und `text/html` 193 Zeichen desselben Inhalts.

Das HTML kommt aus dem **bereits gerenderten Markup**, nicht aus einem zweiten
Markdown-Umwandler – was auf dem Schirm steht, landet unverändert in der Zwischenablage.
Zwei Eingriffe dabei: die Zeitstempel sind im Chat `<button>`-Elemente und werden durch
ihren Text ersetzt (ein Knopf in Word ist sinnlos, seine Zeitangabe nicht), und
Klassenattribute fallen weg, weil ihre Stile im Shadow DOM bleiben. Ein `<meta charset>`
davor, sonst kommen Umlaute in manchen Zielen als Fragezeichen an.

Das Transkript kopiert weiterhin nur Text – dort gibt es keine Formatierung, die ein
zweites Format tragen würde.

## Stand 02.09.2026 (nachts, siebter Durchgang) – Eingabefeld, Rot, Schriftmasse

**Das Eingabefeld beginnt einzeilig und wächst mit dem Text**, bei acht Zeilen ist
Schluss und es scrollt. Umgesetzt mit `field-sizing: content` – seit Chrome 123 dafür
gebaut, kein Mitzählen in JavaScript. Gemessen: leer 42 px, eine Zeile 42 px, drei Zeilen
86 px, langer Text 176 px mit Scrollbalken.

**Rot ist jetzt `#E1002D`**, YouTubes eigenes Badge-Rot, hell wie dunkel – vorher `#C4302B`
hell und `#FF4438` dunkel. Betrifft den Sendeknopf, die Zeitstempel und den Fokusring.

**Fliesstext ist Roboto 14 px auf 20 px Zeilenhöhe** – YouTubes Mass unter dem Video.
Gemessen an `.md-body`: 14px / 20px / Roboto. Vorher 14 px auf 1.5 (= 21 px).

## Stand 02.09.2026 (nachts, sechster Durchgang) – Zustände, Farben, Spalt

### Offen und breit sind jetzt zwei Dinge

Neuer Schlüssel `local:wide` neben `local:collapsed`. Das Symbol in der Werkzeugleiste
holt die Sidebar in **YouTubes eigener Spaltenbreite** (`wide` bleibt aus), das Aufklappen
in der Seite und der Ziehgriff verbreitern sie. Gemessen bei 1600 px Fenster:

| Zustand | Spalte | Player |
|---|---|---|
| frisch installiert (eingeklappt) | 489 px | 1063 px |
| über das Symbol geöffnet | 440 px | 1063 px |
| in der Seite aufgeklappt | 744 px | 808 px |

**Eingeklappt ist ab jetzt der Normalzustand** (`collapsedItem` fällt auf `true` zurück):
die Seite sieht aus wie YouTube, bis jemand die Sidebar holt.

### Der Spalt beim Einklappen

`entferneSpaltenbreite()` hat die Regel entfernt, aber kein `resize`-Event gefeuert – die
Spalte fiel zurück, der Player behielt seine kleine Grösse, dazwischen stand eine Lücke.
YouTube meldet dem Player seine Grösse in JavaScript und nur auf Anlass hin; das gilt für
beide Richtungen, nicht nur beim Setzen.

### Dunkel folgt YouTube, nicht DiktaGo

`#0F0F0F` Grund und `#F1F1F1` Text sind exakt die Werte des Bereichs unter dem Video,
dazu `#272727` für Knöpfe und Chips und `#AAAAAA` für sekundären Text. Die Fläche der
Sidebar steht auf `#1A1A1A` – eine Spur heller als die Seite, damit sie sich abhebt,
ohne aufzufallen. Der warme Braunton aus DiktaGo bleibt in der hellen Farbwelt, im Dunkeln
las er sich als Fremdkörper.

## Stand 02.09.2026 (nachts, fünfter Durchgang) – Knopf „Fakten", Prompts nachgeschärft

Neuer Preset-Knopf **Fakten**. Reihenfolge jetzt: Fazit · Kapitel · Argumente · Fakten ·
Ausführlich · Übersetzen, rechts „Leeren".

**Die Abgrenzung, die den Knopf trägt:** Fazit, Argumente und Ausführlich sind um
*Aussagen* gebaut, Fakten ist um *Angaben* gebaut – um das, was sich unabhängig von der
Meinung des Sprechers prüfen lässt. „14 Stunden Akkulaufzeit im Test" ist eine Angabe,
„der Akku ist gut" ist eine Aussage. Gegen Argumente grenzt es die Auswahl ab: Argumente
nimmt eine Zahl, wenn sie eine Aussage trägt, Fakten nimmt sie, wenn sie prüfbar ist.

Zwei Regeln, ohne die das Preset im Betrieb verwischt: jede Angabe braucht ihren Bezug
(„48 MP" allein ist wertlos), und was der Sprecher selbst als Schätzung oder Gerücht
kennzeichnet, behält dieses Etikett – sonst wäscht die Liste Vermutungen zu Fakten. Bei
einem Video ohne harte Fakten sagt das Preset das in einem Satz und listet, was es gibt;
kein leeres Ergebnis, kein Auffüllen mit Meinungen (Projektregel 3).

**Fünf Form-Reste aus dem System-Prompt entfernt** – derselbe Fehler wie beim ersten Mal,
nur kleiner: die Eröffnung „die das Ansehen ersetzen kann" ist wörtlich der Leser von
*Ausführlich* und zog Fazit und Fakten Richtung Vollständigkeit; „Du fasst zusammen"
machte aus einer Chatfrage eine Zusammenfassung; die Verfahrens-Regel war eine
Tiefenvorgabe; „markiere klar" nannte kein Kriterium; der Zeitstempel-Hinweis „am Anfang"
verlangte einen Vorspann, den jedes Preset verbietet – und die Oberfläche zeigt die
Meldung ohnehin selbst.

**Weitere Nachschärfungen:** Das Budget von *Argumente* stand auf 200 bis 300 Wörtern,
obwohl der Kommentar darüber „Budget in Sätzen statt Wörtern" verspricht – Modelle zählen
keine Wörter, Satzbudgets je Element sind lokal prüfbar. *Argumente* und *Ausführlich*
schrieben `[mm:ss]` fest und widersprachen damit bei Videos über einer Stunde dem
Transkript, das `[hh:mm:ss]` liefert; ein `[15:12]` statt `[1:15:12]` springt an die
falsche Stelle. Die Schreibweise kommt jetzt überall aus dem Transkript. *Ausführlich*
hatte „kein Wortlimit" – ein Budget ohne Bezugsgrösse, gelesen als „so lang wie das
Transkript"; jetzt folgt der Umfang der Zahl der Sachfragen. *Kapitel* hatte als einziges
Preset kein Kriterium für den Schnitt (Kapitelzahl schwankte) und kein Kontrastpaar
(Inhaltssätze wurden Nacherzählung).

Dazu: Bei einem Transkript ohne Zeitstempel war der angehängte System-Hinweis immer
deutsch, auch bei englischer Oberfläche – die einzige Stelle, an der die Sprachen
mischten.

**Nicht geprüft:** Alle Presets sind weiterhin nur gegen den Wortlaut geprüft, nicht
gegen ein echtes Video – dafür braucht es einen OpenRouter-Lauf.

## Stand 02.09.2026 (nachts, vierter Durchgang) – Ziehgriff

Zwischen Video und Sidebar sitzt jetzt ein Griff am linken Innenrand der Karte: ziehen
setzt die Breite live, losgelassen wird sie einmal gespeichert. Gemessen: 620 → 744 px
gezogen, Wert steht danach in den Einstellungen.

Zwei Fallen dabei, beide gemessen:

- Der Griff lag zuerst 12 px **ausserhalb** der Karte – die Karte hat `overflow-hidden`,
  er war abgeschnitten und nicht anklickbar. Jetzt liegt er innen, 8 px breit.
- `setPointerCapture` wirft, sobald die Zeiger-ID nicht mehr aktiv ist, und riss den
  ganzen Handler mit. Die Bewegung hängt jetzt am `window` – ohne Capture verlöre ein
  acht Pixel breiter Griff den Zeiger sofort.

**Eingeklappt gibt die Spalte ihre Breite zurück** (gemessen: 620 → 489 px, Player von
932 auf 1063). Sonst stünde neben dem schmalen Balken eine leere Fläche, während das
Video klein bleibt. Gesteuert über `collapsedItem.watch` im Content-Script.

Die Breitenlogik liegt jetzt in `lib/spalte.ts`, weil sie zwei Aufrufer hat – das
Content-Script beim Laden und die Sidebar beim Ziehen.

## Stand 02.09.2026 (nachts, dritter Durchgang) – Breite, Platz, Enter, Optionen

### YouTubes Spalte lässt sich verbreitern, aber nur mit zwei Variablen

Gemessen: `--ytd-watch-flexy-sidebar-width` rechnet YouTube beim Laden einmal per
JavaScript aus (489 px bei 1600 px Fenster) und fasst sie danach nicht mehr an.
`--ytd-watch-flexy-max-player-width` steuert den Player. Wer nur den Player deckelt,
bekommt eine Lücke; wer nur die Spalte setzt, bekommt Überlappung. Beide zusammen per
`!important` auf `ytd-watch-flexy` funktionieren sauber (600/700/850 px getestet, Player
904/804/654 px, kein Überlauf). Danach muss einmal ein `resize`-Event gefeuert werden,
weil YouTube die Player-Grösse nur auf Anlass hin neu rechnet.

**Korrigiert nach Fables Prüfung, erneut gemessen:** Die Spaltenbreite allein genügt,
`--ytd-watch-flexy-max-player-width` wird nicht mehr angefasst. Sie ist keine Breiten-,
sondern eine **Höhendeckelung** (`calc((100vh - Kopf - Ränder) * 16/9)`); eine eigene
`100vw`-Formel hebt sie auf. Gemessen bei 1600x600: mit meiner Doppelregel stand der
Player 884x663 px gross und ragte aus dem Fenster, mit der einfachen Regel sind es
645x484 px. Den Rest erledigt Flexbox – bei 1010 px Fensterbreite schrumpft die Spalte
von selbst auf 498 px und der Player hält seine Mindestbreite von 480 px.

Auch `min(…, 46vw)` ist weg. Der Selektor lautet jetzt
`ytd-watch-flexy[is-two-columns_]:not([theater]):not([fullscreen]):not([fixed-panels])`:
unter rund 1000 px Fensterbreite gibt es keine rechte Spalte (gemessen bei 990 px:
`#secondary` verschwindet samt Sidebar), und bei `fixed-panels` – Live-Chat als
fixiertes Panel – ginge die Breite doppelt in Padding und Panel ein.

Neue Einstellung `columnWidth` (Regler 400–900). Default ist 500 px – knapp über
YouTubes eigenem Wert von 400 bis 490 px je nach Fenster: spürbar mehr Platz, ohne dass
das Video sichtbar schrumpft. 620 px war als Vorgabe zu wuchtig.

### Der Chat hatte 141 px Platz

Die Karte hatte `max-h-[75vh]` ohne eigene Höhe und schrumpfte damit auf ihren Inhalt –
der Nachrichtenbereich blieb bei `min-h-32`. Jetzt `h-[72vh] min-h-[440px]`, gemessen
512 px Nachrichtenbereich bei 913 px Fensterhöhe.

### Enter zum Senden war tot – Nebenwirkung des Tastaturschutzes

`stopPropagation()` in der Capture-Phase am `window` hält das Event auch vom Ziel fern,
also feuert kein React-Handler im Shadow DOM. Enter und Escape sind jetzt ausgenommen;
beide sind keine Video-Kürzel von YouTube. Gemessen mit synthetischen Events am
`textarea`: von Leertaste, „k" und Enter erreicht nur Enter YouTubes document-Listener,
und das Eingabefeld ist danach leer – der Sende-Handler läuft wieder.

### Der Klick aufs Symbol tat nichts

Kein `default_popup`, kein `chrome.action.onClicked` – der Listener war beim Rückbau der
Seitenleiste mit entfernt worden. Jetzt: auf einer Watch-Seite klappt er die Sidebar auf
oder zu (über `collapsedItem`, die Sidebar hört per `watch` darauf), sonst öffnet er die
Einstellungen.

### Die Options-Seite war ein schmaler Dialog

`options_ui.open_in_tab` in `wxt.config.ts` ist wirkungslos – WXT nimmt den Wert aus dem
Entrypoint. Gebaut wurde `false`, also der eingebettete Dialog in `chrome://extensions`.
Jetzt steht `<meta name="manifest.open_in_tab" content="true">` in
`entrypoints/options/index.html`, gebaut kommt `true` heraus. Dazu: Inhalt bis 1280 px
breit, und `html`/`body` bekommen die Hintergrundfarbe – vorher blieb der Bereich neben
der zentrierten Spalte im Dunkelmodus weiss.

### Preset-Prompts stehen nicht mehr im Chat

Ein Klick auf „Fazit" schickte den vollen Anweisungstext und zeigte ihn auch an.
`ChatMessage` hat jetzt ein optionales `label`: gesendet wird der Prompt, angezeigt der
Name des Knopfes. Dazu ein sichtbarer Knopf **Leeren** (Besen-Symbol) in der Knopfleiste,
der die Unterhaltung zu diesem Video verwirft; der versteckte Papierkorb unten ist weg.

## Stand 02.09.2026 (nachts, später) – Schriftgrösse gefunden, Seitenleiste zurückgebaut

### Die winzige Schrift: eine einzige Regel, und ich habe an ihr vorbeigemessen

`.md-body` in `@layer components` stand als einzige Stelle noch auf `font-size: 0.875rem`
– bei YouTubes `html{font-size:10px}` also **8,75 px statt 14**. Die Tailwind-Klassen
daneben waren längst auf Pixel umgestellt; gemessen habe ich die Klassen, gerendert wurde
der Text in `.md-body`. Michaels Schätzung „4–5 pt" war zutreffend, meine Messung nicht.
Jetzt 15 px, im Browser bestätigt: Wurzel-Container 16 px, `textarea` 15 px, bei
`html`-Wurzel 10 px.

Zusätzlich `-webkit-font-smoothing: antialiased` entfernt – gemessen rendert YouTube mit
`auto`. Auf macOS zeichnet antialiased die Striche dünner, der Text wirkt leichter und
damit kleiner. Jetzt beidseitig `auto`.

### Chromes Seitenleiste ist vollständig zurückgebaut

Grund ist **Vivaldi-Bug VB-123452** (in 8.1 offen, per Recherche bestätigt): Vivaldi
trägt jede Extension mit der Permission `sidePanel` ungefragt in seine Panel-Leiste ein
und öffnet dort beim Installieren ein leeres Panel. Das ist aus der Extension heraus nicht
abschaltbar – der einzige Weg ist, die Permission nicht zu deklarieren. Michaels Vorgabe:
„verhindere, dass die erweiterung links in die vivaldi panes rutscht."

Damit sind die Abschnitte „Was der Umzug gekostet hat" und „Symbol und Vivaldi" weiter
oben Historie: es gibt keine `lib/transcript-bridge.ts` und keine `PanelApp` mehr, das
Content-Script fragt YouTube wieder direkt, und das Symbol öffnet nur noch die
Einstellungen.

`uiPlacement: "both"` war zusätzlich ein echter Fehler und nicht bloss Ballast: beide
Instanzen mounten dieselbe `Sidebar` und hören auf `chrome.storage.local.onChanged` –
zwei Transkript-Abrufe pro Video und ein Schreibkonflikt auf `local:conv:<videoId>`.

Als Ausgleich für die schmale Spalte: Regler **Schriftgrösse der Oberfläche**
(`uiScale`, Default 110 %, 90–220 %, wirkt als `zoom` am Wurzel-Container) und ein Knopf
**Cache leeren** in den Optionen.

### Zusammenfassungen: der System-Prompt war der Verursacher

„Kurz/Mittel/Lang" lieferte dreimal dasselbe Protokoll in drei Grössen. Nicht die Presets
waren schuld, sondern der System-Prompt: er verlangte „Abschnitte in der Reihenfolge des
Videos", Vollständigkeit und Zeitstempel-Dichte und übersteuerte jede
Verdichtungsanweisung. Widersprechen sich beide, gewinnt der längere und konkretere Text.

Form gehört seither ausschliesslich in die Presets. **Der ursprüngliche System-Prompt kam
wörtlich aus Michaels Auftrag – diese Änderung ist bewusst und wird hier offengelegt.**

Die drei Stufen unterscheiden sich jetzt im Zweck statt in der Länge, die Knöpfe heissen
**Fazit · Argumente · Ausführlich** (mit Tooltip, was jede Stufe liefert). Techniken in
den Prompts: Leser statt Aufgabe, Aussage statt Thema mit Kontrastpaar, Verbot der
Nacherzähl-Wendungen („das Video behandelt"), Reihenfolge nach Gewicht statt nach Ablauf,
Satzbudget vom Input entkoppelt, Zeitstempel an eine Funktion gebunden.

**Noch nicht gemessen:** die neuen Presets gegen ein echtes Video mit dem neuen
System-Prompt. Ein Test mit dem alten System-Prompt hätte nichts über die Presets gesagt.

### Geprüft nach dem Umbau

`tsc`, `pnpm run check` (12 Prüfungen), `pnpm run build`, `pnpm run build:store`,
`verify-store-bundle.sh` (bestanden), `native-host/selfcheck.py` (6 Prüfungen) – alle
grün. Im headless-Chrome auf einer echten Watch-Seite: Sidebar eingebettet vorhanden,
Breite 489 px, Roboto, Transkript mit Zeitstempeln geladen, Knöpfe „Fazit · Argumente ·
Ausführlich". Manifest ohne `side_panel`, Permissions nur `storage` und `nativeMessaging`.

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

1. **Fazit-Prompt schärfen**: unsichere Angaben weglassen statt in Klammern raten
   (gemessen am Video `9D-xzper0wQ`, siehe unten).
2. **Windows-Installer ausführen**, sobald ein Windows-Rechner zur Hand ist.
3. Optional: Store-Build einreichen.
4. Offen aus Fables Entwurf: Zielsprache und Übersetzen-Knopf zu einem Auswahlfeld
   verschmelzen – nur, wenn gewünscht.

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
