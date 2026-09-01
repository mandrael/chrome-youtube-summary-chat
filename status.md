# Status – chrome-youtube-summary-chat

## Offene To-Dos (oberstes zuerst)

1. **Untertitel-Weg in einer angemeldeten Chrome-Sitzung messen.** Der eine Punkt, an dem
   das Produkt hängt. In einer anonymen Sitzung liefert kein Weg ein Transkript – Details
   und Messwerte in [CLAUDE.md](CLAUDE.md) und im README. Vorgehen:
   ```bash
   osascript -e 'quit app "Google Chrome"' && sleep 3 && \
     open -na "Google Chrome" --args --remote-debugging-port=9222 --enable-unsafe-extension-debugging
   ```
   Dann die Extension über CDP `Extensions.loadUnpacked` laden (die Hilfsskripte lagen im
   Scratchpad der Sitzung vom 01.09.2026) oder von Hand über `chrome://extensions`, ein
   Video mit Untertiteln öffnen und sehen, ob die Sidebar ein Transkript bekommt.
   Gescheiterte Alternative: eine Kopie des Profils. Die `Cookies`-Datei auf Platte ist
   nur so aktuell wie das letzte saubere Beenden von Chrome (im Test: neun Tage alt), und
   die Entschlüsselung braucht den Schlüsselbund-Eintrag „Chrome Safe Storage“, den ein
   Chrome mit fremdem `--user-data-dir` nicht bekommt.
2. **Chat gegen OpenRouter aus der Sidebar auslösen**, sobald ein Transkript ankommt.
   Der Endpunkt selbst ist belegt (`/api/v1/key`, STT-Aufrufe), der Streaming-Weg in der
   Sidebar noch nicht.
3. **Chrome-Übersetzung** einmal real laufen lassen.
4. **Windows-Installer ausführen**, sobald ein Windows-Rechner zur Hand ist.
5. Optional: Store-Build einreichen.

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
