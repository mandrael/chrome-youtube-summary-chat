# YouTube Summary Chat

Chrome-Extension (Manifest V3), die auf YouTube-Videoseiten eine Chat-Sidebar in die
rechte Spalte oberhalb der Empfehlungen einhängt: mit dem Transkript chatten,
zusammenfassen, in Kapitel gliedern, übersetzen. Alle Zeitstempel sind anklickbar und
springen im Player an die Stelle.

Ein einziger Anbieter: **OpenRouter**. Kein zweiter Cloud-Dienst, kein eigenes Backend,
kein Proxy, keine Telemetrie.

---

## Zwei Builds aus einer Codebase

| | `full` (GitHub, unpacked) | `store` (Chrome Web Store) |
|---|---|---|
| Untertitel-Transkript | ja | ja |
| Audio-Fallback ohne Untertitel | ja | **nein** |
| Permission `nativeMessaging` | ja | nein |
| Fallback-Code im Bundle | ja | **nein, nachgemessen** |

Der Store-Build enthält den Fallback nicht nur unsichtbar, sondern gar nicht: das
Build-Flag `__FALLBACK__` wird als Boolean-Literal eingesetzt, Rolldown entfernt den
toten Zweig samt der nur dort importierten Module. Nachprüfbar:

```bash
cd extension && pnpm run build && pnpm run build:store && ./scripts/verify-store-bundle.sh
```

Das Skript prüft das gebaute Bundle, nicht den Quelltext, und macht eine Gegenprobe gegen
den `full`-Build – sonst würde ein Test bestehen, der überhaupt nichts misst.

---

## Installation

### Voraussetzungen

Node 20+, pnpm. Für den Audio-Fallback zusätzlich Python 3, yt-dlp und ffmpeg.

### Bauen

```bash
cd extension
pnpm install
pnpm run build
```

Das Ergebnis liegt in `extension/.output/chrome-mv3-full/`.

Für die Store-Variante:

```bash
pnpm run build:store
```

### Laden

1. `chrome://extensions` öffnen
2. Entwicklermodus einschalten
3. „Entpackte Erweiterung laden“ → `extension/.output/chrome-mv3-full`

Der `full`-Build bringt einen öffentlichen Schlüssel im Manifest mit und hat deshalb
immer dieselbe Extension-ID: **`abblpkhijcggklokijkhfbkgeljmimpm`**. Ohne den würde Chrome
die ID aus dem Installationspfad ableiten, und die Native-Messaging-Registrierung wäre
nach jedem Verschieben des Ordners ungültig.

### API-Key eintragen

Einen Key auf [openrouter.ai/keys](https://openrouter.ai/keys) anlegen, in den
Einstellungen der Extension eintragen und mit „Testen“ prüfen – der Knopf fragt
`/api/v1/key` ab und zeigt Verbrauch und Limit.

Der Key liegt in `chrome.storage.local` und geht ausschliesslich an `openrouter.ai`.

---

## Native Messaging einrichten (nur `full`)

Nötig nur, wenn Videos ohne Untertitel über die Tonspur transkribiert werden sollen.

### macOS

```bash
brew install yt-dlp ffmpeg
uv tool install parakeet-mlx -U        # nur für die lokale Route
cd native-host && ./install-macos.sh
```

Danach Chrome einmal neu starten. Das Skript legt das Host-Manifest unter
`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` an und erzeugt einen
Wrapper, der einen brauchbaren `PATH` setzt – Chrome startet den Host ohne Login-Profil,
weshalb Homebrew und uv sonst schlicht fehlen.

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

**Ungetestet** – siehe „Was nicht geprüft ist“.

### Prüfen

Die Options-Page zeigt den Host-Status grün oder rot samt Fehlertext und meldet, welches
Werkzeug fehlt. Direkt auf der Kommandozeile:

```bash
cd native-host && python3 selfcheck.py
```

---

## Transkript-Quellen

### Der Untertitel-Weg – Stand der Messung

**Das ist der offene Punkt dieses Projekts.** Am 01.09.2026 in einer *nicht angemeldeten*
Chrome-Sitzung gemessen, drei Wege, alle erfolglos:

| Weg | Ergebnis |
|---|---|
| `baseUrl` aus `ytInitialPlayerResponse` direkt abrufen | HTTP 200, **Body leer** – bei `roh`, `fmt=json3`, `fmt=srv3` und `fmt=json3&c=WEB`, mit und ohne gesetzten Consent |
| YouTubes Transkript-Panel im DOM auslesen | Der programmatische Klick expandiert das Panel (`visibility=…EXPANDED`), löst aber **keinen einzigen Netzwerk-Request** aus. Zweimal kam es doch zustande, nicht reproduzierbar. |
| InnerTube `POST /youtubei/v1/get_transcript` mit vollständigen Headern (Client-Version, Visitor-ID, `params` aus `getTranscriptEndpoint`) | HTTP 400, *„Precondition check failed."* |

Die Spurliste selbst kommt weiterhin an – nur der Inhalt nicht.

**Nicht gemessen und deshalb offen: eine angemeldete Sitzung.** Das ist der Regelfall im
Alltag und der wahrscheinlichste Grund für das Verhalten. Bis das geprüft ist, gilt der
Untertitel-Weg als **implementiert, aber unbestätigt**.

Beide Wege sind gebaut und laufen nacheinander: erst der direkte Abruf, dann das Panel.
Scheitert beides, nennt die Fehlermeldung **beide Gründe im Klartext** statt nur „ging
nicht", und daneben steht ein „Erneut versuchen".

Zwei Fallstricke, die dabei aufgefallen und behoben sind:

- YouTube hält **zwei identische Segmentlisten** im DOM, eine sichtbar, eine nicht. Ein
  Selektor über das ganze Dokument verdoppelt das Transkript still – doppelte Kosten,
  durcheinandergeratene Zeitstempel. Gelesen wird nur die sichtbare Liste, zusätzlich
  wird nach Zeit und Text dedupliziert.
- In einem **Hintergrundtab** lädt YouTube den Panelinhalt nicht (zehn Anläufe über 141
  Sekunden: null Segmente). Ein per Mittelklick geöffnetes Video würde sonst mit „kein
  Transkript" scheitern. Der Code wartet deshalb, bis der Tab sichtbar ist.

Welche Spur genommen wird, steuert die Einstellung „Untertitelsprache"; die tatsächlich
vorhandenen Spuren stehen im Transkript-Tab der Sidebar zur Wahl (beim Panel-Weg alle,
die YouTube im Fussmenü führt – im Test 31 Sprachen).

Auf `/shorts/`-Seiten hängt sich die Sidebar gar nicht erst ein.

### Audio-Fallback (nur `full`, nur auf Klick)

Hat ein Video keine Untertitel, endet es im Store-Build mit einer sichtbaren Meldung. Kein
Platzhalter, keine erfundene Ausgabe.

Im `full`-Build lädt yt-dlp auf Klick die Tonspur, ffmpeg wandelt sie nach Opus (Faktor 10
kleiner als WAV: fünf Minuten sind 0,9 MB statt 9,6 MB), dann übernimmt eine von drei
Routen. Der Host macht die gesamte Arbeit und liefert nur Text zurück – Native Messaging
begrenzt eine Nachricht auf 1 MB, base64-Audio sprengt das bei jedem Video von mehr als
ein paar Sekunden. Ab zehn Minuten wird in Abschnitte geteilt und der Zeitversatz addiert.

| Route | Ort | Preis | Zeitstempel |
|---|---|---|---|
| `openai/whisper-large-v3-turbo` | OpenRouter | ~$0,012/h | **ja**, Segmente |
| `nvidia/parakeet-tdt-0.6b-v3` | OpenRouter | ~$0,09/h | **nein** |
| `parakeet-mlx` (`parakeet-tdt-0.6b-v3`) | lokal, Apple Silicon | kostenlos | **ja**, Sätze |

Alle drei sind am 01.09.2026 real gemessen, nicht aus der Dokumentation abgeschrieben:

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

---

## Permissions und warum

| Permission | Wofür | Build |
|---|---|---|
| `storage` | API-Key, Einstellungen, System-Prompt, Chatverlauf pro Video. Alles in `chrome.storage.local`, nichts verlässt das Gerät ausser den Modellanfragen selbst. | beide |
| `*://*.youtube.com/*` | Die Sidebar in die Videoseite einhängen, die Untertitelspuren der Seite lesen, die Wiedergabeposition beim Klick auf einen Zeitstempel setzen. | beide |
| `https://openrouter.ai/*` | Die einzige Cloud-Gegenstelle: Chat, Modellliste, Key-Prüfung. | beide |
| `nativeMessaging` | Den lokalen Helfer für den Audio-Fallback starten. Nur nach ausdrücklichem Klick, nie automatisch. | nur `full` |

Es gibt keine weiteren Host-Permissions, kein `tabs`, kein `<all_urls>`, kein
`webRequest`, kein `scripting`.

**Nicht enthalten:** Telemetrie, Analytics, Tracking, Fehlerberichte an Dritte,
automatische Downloads.

---

## Was nicht geprüft ist

Ehrlichkeit vor Vollständigkeitsmeldung – diese Punkte sind gebaut, aber nicht verifiziert:

- **Der Untertitel-Weg in einer angemeldeten Sitzung.** Der wichtigste offene Punkt, siehe
  oben. In einer anonymen Sitzung liefert kein Weg ein Transkript.
- **Windows.** `install-windows.ps1` folgt Chromes dokumentiertem Verfahren, ist aber
  mangels Windows-Rechner nie ausgeführt worden. Die lokale Route Parakeet MLX ist dort
  ohnehin nicht verfügbar (Apple Silicon).
- **Der Chat gegen OpenRouter aus der Sidebar heraus.** Der Streaming-Weg ist gebaut,
  konnte aber nicht ausgelöst werden, solange kein Transkript ankommt. Der Endpunkt selbst
  ist über `/api/v1/key` und die STT-Aufrufe belegt.
- **Die Chrome-Übersetzung.** Feature-Detection und zeilenweiser Ablauf sind gebaut, ein
  Lauf gegen die echte Translator API steht aus.
- **Der Chrome Web Store.** Der Store-Build wird gebaut und geprüft, aber nicht
  eingereicht.

Verifiziert ist dagegen: beide Builds, der Tree-Shaking-Nachweis, alle drei STT-Routen
end-to-end über den Native-Host, die Zeitstempel-Frage bei beiden Cloud-Modellen,
`/api/v1/key`, das Einhängen der Sidebar in die rechte Spalte oberhalb der Empfehlungen
samt Dark-Mode, die Options-Page mit live geladener Modellliste – sowie 12 Prüfungen der
Extension-Logik und 6 des Hosts.

```bash
cd extension    && pnpm run check          # 12 Prüfungen
cd native-host  && python3 selfcheck.py    # 6 Prüfungen
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
