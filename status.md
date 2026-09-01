# Status – chrome-youtube-summary-chat

## Offene To-Dos (oberstes zuerst)

1. **Sidebar und Options-Page im laufenden Chrome ansehen.** Der Start von Chrome mit
   `--load-extension` wurde in der Sitzung vom 01.09.2026 abgelehnt, der optische Test
   steht daher aus. Befehl:
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --user-data-dir=/tmp/yt-test --load-extension="$PWD/extension/.output/chrome-mv3-full" \
     --disable-features=DisableLoadExtensionCommandLineSwitch --no-first-run \
     "https://www.youtube.com/watch?v=aircAruvnKk"
   ```
   Zu prüfen: Einhängepunkt über den Empfehlungen, Dark-Mode-Übernahme, Spaltenbreite,
   Videowechsel ohne Reload, Klick auf einen Zeitstempel.
2. **Untertitel-Abruf an einem echten Video prüfen.** `ytInitialPlayerResponse` und
   `fmt=json3` sind implementiert und durch Einheitenprüfungen gedeckt, aber nie gegen die
   laufende Seite gelaufen. Falls YouTube den Abruf inzwischen sperrt, ist das der Punkt,
   an dem es auffällt.
3. **Windows-Installer ausführen**, sobald ein Windows-Rechner zur Hand ist.
4. Optional: Store-Build einreichen.

## Stand 01.09.2026 – Erstfassung

Vollständig gebaut und geprüft:

- WXT-Projekt in `extension/`, zwei Builds (`full`, `store`) über `--mode`.
- Sidebar im Shadow DOM, Chat mit SSE-Streaming und Abbrechen, Presets (kurz/mittel/lang,
  Kapitel, Übersetzen), Zusatz-Prompt, Kopieren und Markdown-Export, Verlauf pro Video-ID,
  Kostenanzeige, klickbare Zeitstempel, Spurwahl im Transkript-Tab.
- Options-Page: Key mit Test-Knopf, Modell-Dropdown (dreizeilig, 1M-Marker), Freitext-Slug
  mit Präfix-Prüfung, Reasoning-Regler, Sprachen, System-Prompt mit Reset, STT-Route mit
  Live-Preisen, Host-Status, Installationsbefehle mit Kopier-Knopf.
- Native-Host in Python, drei STT-Routen, Chunking ab 10 Minuten, Fortschrittsmeldungen.
- Installer für macOS (getestet) und Windows (ungetestet).

### Verifikationen mit Beleg

| Prüfung | Ergebnis |
|---|---|
| `pnpm run build` / `build:store` | beide grün |
| `verify-store-bundle.sh` | bestanden, inkl. Gegenprobe |
| `pnpm run compile` | keine Fehler |
| `pnpm run check` | 11 Prüfungen |
| `native-host/selfcheck.py` | 6 Prüfungen |
| Host end-to-end, Route parakeet-mlx | 4 Segmente mit Zeiten |
| Host end-to-end, Route whisper-turbo | 1 Segment (19-s-Video) |
| Host end-to-end, Route parakeet OpenRouter | 0 Segmente, nur Text – wie erwartet |
| `/api/v1/key` | HTTP 200, Felder wie im Parser erwartet |

### Die drei Recherchepunkte, beantwortet

Ergebnisse und Zahlen stehen in [CLAUDE.md](CLAUDE.md) unter „Was gemessen ist“ und im
README. Kurz: whisper-turbo liefert Zeitstempel, parakeet über OpenRouter nicht,
parakeet-mlx liefert sie lokal, DiktaGo ist nicht ansprechbar.

### Entscheidungen des Nutzers in dieser Sitzung

- WXT statt Plasmo (Plasmo seit Mai 2025 ohne Veröffentlichung).
- Route Parakeet ONNX (Intel) entfällt – nur Linux-Binaries verfügbar.
- Route DiktaGo entfällt, Befund als Rückmeldung ins DiktaGo-Projekt.
- Der STT-Test durfte den OpenRouter-Key aus DiktaGos Datenordner verwenden.

### Nachträglicher Wunsch, umgesetzt

Chromes eingebaute Translator API als zweiter Übersetzungsweg – zeilenweise, damit
Zeitstempel strukturell unangetastet bleiben. Läuft im Content-Script, weil die API in
Web Workers fehlt. Standard bleibt OpenRouter.
