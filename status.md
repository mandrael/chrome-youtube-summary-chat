# Status – chrome-youtube-summary-chat

## Offene To-Dos (oberstes zuerst)

1. **Neue Presets gegen ein echtes Video messen** (Fazit/Argumente/Ausführlich mit dem
   neuen System-Prompt) – braucht einen OpenRouter-Lauf.
2. **Windows-Installer ausführen**, sobald ein Windows-Rechner zur Hand ist.
3. Optional: Store-Build einreichen.

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

1. **Neue Presets gegen ein echtes Video messen** (Fazit/Argumente/Ausführlich mit dem
   neuen System-Prompt) – braucht einen OpenRouter-Lauf.
2. **Windows-Installer ausführen**, sobald ein Windows-Rechner zur Hand ist.
3. Optional: Store-Build einreichen.

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
