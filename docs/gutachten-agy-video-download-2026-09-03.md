# Recherche: YouTube-Videodownload – Machbarkeit und Legalität (agy, 03.09.2026)

Auftrag: Ist ein Download-Knopf in einer offenen GitHub-Erweiterung machbar und
zulässig? Zusammenfassung der Recherche, mit Quellen im Original-Output.

## Rechtslage (keine Rechtsberatung, nur zusammengefasste Fakten)

- **YouTube-Nutzungsbedingungen** verbieten den Download ausdrücklich. Verstoß ist
  Vertragsbruch gegenüber Google (mögliche Folge: Account-Sperre), für sich allein
  keine Straftat und keine Urheberrechtsverletzung.
- **§ 53 UrhG (DE) / § 42 UrhG (AT), Privatkopie:** grundsätzlich erlaubt, solange die
  Vorlage nicht offensichtlich rechtswidrig ist – ein autorisierter YouTube-Upload
  gilt als rechtmäßige Vorlage.
- **Der entscheidende Streitpunkt: § 95a UrhG (Schutz technischer Maßnahmen).**
  Privatkopie greift nicht, wenn eine *wirksame* technische Schutzmaßnahme umgangen
  wird. **OLG Hamburg, Urteil vom 21.11.2024 (Az. 5 U 54/23):** YouTubes Rolling
  Cipher (n-sig-Verschleierung) ist eine wirksame Schutzmaßnahme im Sinne von § 95a.
  Die Nichtzulassungsbeschwerde wies der BGH im Oktober 2025 ab – **rechtskräftig**.
  Gegenposition (GFF, EFF): Der Code wird unverschlüsselt an jeden Client
  ausgeliefert, sei reine Player-Logik, kein echtes DRM; der EuGH (*Nintendo/PC Box*,
  C-355/12) verlangt Verhältnismäßigkeit bei Werkzeugen mit überwiegend legalem Zweck.
- **Nutzung vs. Anbieten:** § 108b UrhG stellt die Umgehung zum **rein privaten
  Gebrauch** straffrei. § 95a Abs. 3 UrhG verbietet das **Anbieten** von Werkzeugen,
  deren **Hauptzweck** die Umgehung ist – mit zivilrechtlicher Haftung (Unterlassung,
  Schadensersatz).
- **Unstrittig erlaubt:** eigene Videos (YouTube Studio bietet Download selbst an),
  gemeinfreie und CC-lizenzierte Inhalte.

## Öffentliches Repository

- GitHub ist unproblematisch. Nach dem RIAA-DMCA-Takedown von `youtube-dl` (Oktober
  2020) und der Wiederherstellung im November 2020 (GitHub Blog, EFF-Beteiligung,
  GitHub-eigener „$1M Developer Defense Fund") ist `yt-dlp` seit Jahren frei auf
  GitHub verfügbar und aktiv gepflegt.
- **yt-dlp-Lizenz:** The Unlicense (Public Domain). Aufruf ohne Copyleft-Folgen für das
  eigene Projekt; jede Lizenz für den eigenen Code ist frei wählbar.
- Relevanter Unterschied zum Uberspace-Fall: Dort war der Hauptzweck des Angebots der
  Download selbst. Eine Chat-/Zusammenfassungs-Erweiterung mit Download als
  Zusatzfunktion ist ein anderer Sachverhalt für die „Hauptzweck"-Frage in § 95a
  Abs. 3 – eine Garantie ist das nicht, keine Rechtsberatung.

## Chrome Web Store: klar ausgeschlossen

Google-Programmrichtlinie, wörtlich: „Do not encourage, facilitate, or enable the
unauthorized access, download, or streaming of copyrighted content or media."

| Werkzeug | Chrome Web Store | Firefox Add-ons |
|---|---|---|
| ClipGrab | nein (nur Desktop) | nein |
| 4K Video Downloader+ | nein (nur Desktop) | nein |
| Video DownloadHelper | ja, **YouTube dort deaktiviert** | ja, mit YouTube |

Video DownloadHelper belegt, dass Google es aktiv durchsetzt: dieselbe Erweiterung,
in Chrome ohne YouTube-Funktion, in Firefox mit.

## Technik

- **yt-dlp ist der praktikable Weg.** Alternativen (YouTube.js/Innertube-Client,
  PyTube, ytdl-core) brechen regelmäßiger bei YouTube-Änderungen.
- Formate: `yt-dlp --dump-json` liefert das `formats`-Array (`height`, `filesize`,
  `vcodec`, `acodec`, `protocol`).
- Ab 480p liefert YouTube **DASH** – Video und Ton getrennt. Merge-Selektor:
  `-f "bestvideo[height<=H]+bestaudio/best[height<=H]" --merge-output-format mp4`.
  **ffmpeg ist zwingend** für den Merge.
- **Rein in der Erweiterung (ohne lokalen Helfer) ist nicht praktikabel:** n-sig-
  Verschleierung in `base.js` (ohne exakte Deobfuskierung Drosselung auf
  40–60 KB/s oder HTTP 403), PO-Tokens/BotGuard blockieren zunehmend, und das Muxen
  zweier 1080p-Streams via `ffmpeg.wasm` sprengt Service-Worker-Speicherlimits.
  → Native Messaging zu einem lokalen Helfer (wie beim Audio-Fallback) ist der
  einzige verlässliche Weg.

## Entscheidung dieser Sitzung

Gebaut, ausschließlich im GitHub-Build, hinter derselben `__FALLBACK__`-Konstante wie
der Audio-Fallback – Projektregel 2 gilt unverändert: Der Store-Build enthält den
Code nicht, nicht einmal ausgeblendet.
