# chrome-youtube-summary-chat

Chrome-Extension (MV3): Chat-Sidebar auf YouTube-Videoseiten. Transkript-Chat,
Zusammenfassung, Kapitel, Übersetzung. Stack: WXT, React 19, TypeScript, Tailwind 4,
shadcn/ui, pnpm.

Aktueller Stand, offene Punkte und Historie stehen in [status.md](status.md) – zuerst
lesen. Nutzerseitige Doku in [README.md](README.md).

---

## Absolute Regeln dieses Projekts

**1. Nur OpenRouter.** Kein Code, der `api.openai.com`, `api.anthropic.com`,
`generativelanguage.googleapis.com` oder `api.groq.com` direkt aufruft – auch nicht als
optionaler Zweig, auch nicht als Fallback. Groq ausschliesslich über OpenRouters
Provider-Routing. Keine Provider-Abstraktion: es gibt genau eine Gegenstelle, ein
Interface mit einer Implementierung wäre Ballast.

**2. Der Store-Build enthält keinen Fallback-Code.** Nicht ausgeblendet, sondern nicht
vorhanden. Jede Änderung am Fallback wird mit `extension/scripts/verify-store-bundle.sh`
gegengeprüft, und zwar gegen das gebaute Bundle, nicht gegen den Quelltext. Das Skript
enthält eine Gegenprobe gegen den `full`-Build – ohne sie könnte ein Test bestehen, der
nichts misst.

**3. Kein stiller Fehlschlag beim Transkript.** Fehlen Untertitel, sagt die UI das. Kein
Platzhalter, kein Ersatztext, keine erfundene Ausgabe. Liefert eine Quelle keine
Zeitstempel, steht `hasTimestamps: false` und es werden keine Sprungmarken angeboten.

**4. Kein Download ohne Klick.** Der Audio-Fallback startet ausschliesslich auf eine
ausdrückliche Nutzeraktion.

**5. Keine Telemetrie, kein Backend, kein Proxy.** Host-Permissions bleiben bei
`youtube.com` und `openrouter.ai`.

---

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

## Gescheiterte und verworfene Ansätze

- **Plasmo** als Bundler: letzte npm-Veröffentlichung `0.90.5` vom 17.05.2025, über 15
  Monate alt, Selbstbeschreibung weiterhin Alpha. Ersetzt durch WXT (Vite/Rollup), wo die
  Dead-Code-Elimination für den Store-Build verlässlich greift.
- **Route Parakeet ONNX (Intel-Mac)**: `achetronic/parakeet` liefert nur Linux-Binaries.
  Verworfen, nicht aufgeschoben.
- **Route DiktaGo**: nicht ansprechbar, kein URL-Scheme, kein STT-CLI. Befund liegt als
  Rückmeldung im DiktaGo-Projekt.
- **`ytInitialPlayerResponse` aus dem globalen Objekt lesen**: bei SPA-Navigation nicht
  zuverlässig auf dem Stand der sichtbaren Video-ID. Stattdessen ein frischer
  same-origin-Abruf der Watch-Seite mit explizitem `?v=`.

---

## Aufbau

```
extension/            WXT-Projekt
  entrypoints/        content.tsx · background.ts · options/
  components/         Sidebar, Markdown, TranscriptView, HistoryView, ui/
  lib/                openrouter · transcript · fallback · translate-local · prompts …
  scripts/            selfcheck.ts · verify-store-bundle.sh
native-host/          Python-Host für den Audio-Fallback (nur full)
```

Der Fallback liegt vollständig in `lib/fallback.ts` und wird nur aus
`if (__FALLBACK__)`-Zweigen erreicht – so greift die Elimination am Modul, nicht bloss an
der Bedingung.

## Prüfungen

```bash
cd extension && pnpm run compile && pnpm run check
cd extension && pnpm run build && pnpm run build:store && ./scripts/verify-store-bundle.sh
cd native-host && python3 selfcheck.py
```

Alle vier laufen, bevor etwas als fertig gemeldet wird. Was nicht geprüft werden konnte,
steht im README-Abschnitt „Was nicht geprüft ist“ und wird dort gepflegt, nicht
weggelassen.

## Sprache

Doku, UI-Texte und Kommentare auf Deutsch mit echten Umlauten. Ausnahme: der
Native-Host-Quelltext kommt ohne Umlaute aus, weil er in Umgebungen mit ungewisser
Zeichensatz-Einstellung läuft. Technische Begriffe im Original.
