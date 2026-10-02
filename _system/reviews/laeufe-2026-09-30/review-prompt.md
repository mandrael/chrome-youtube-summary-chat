Du bist ausschließlich lesender Reviewer. Ändere, erzeuge und lösche keine Dateien; starte keine Subagenten. Lies keine Zugangsdaten, `.env`, personenbezogenen Daten oder produktiven Datensätze (insbesondere nichts unter `_system/keys/`). Prüfe Code, Diff und Tests am Primärartefakt. Melde nur konkrete Fehler oder fehlende Belege.

# Auftrag: Gesamtreview auf Bugs und Schwächen

Repository: das aktuelle Arbeitsverzeichnis (chrome-youtube-summary-chat), maßgeblich ist der Commit `0e3feb3` (origin/main). Eine andere Sitzung ändert parallel README.md und status.md – uncommittete Änderungen ignorieren; im Zweifel `git show 0e3feb3:<pfad>` lesen.

Projekt: Chrome-Erweiterung (WXT, MV3, React 19, TypeScript) mit Chat-Sidebar auf YouTube (Transkript-Chat über OpenRouter oder Mistral), plattformneutraler Kern in `shared/`, Python-Native-Messaging-Helfer in `native-host/` (yt-dlp, ffmpeg, Transkription, Videodownload, Selbst-Update aus GitHub-Releases), Android-Spike in `app/`, Skripte in `scripts/` und `extension/scripts/`. Regeln und Invarianten stehen in `CLAUDE.md` (§1 Gegenstellen, §2 Store-Build ohne Download-/Native-Code über `__FALLBACK__`, §3 kein stiller Fehlschlag beim Transkript, §4 nichts ohne Klick, Player-Zustand wiederherstellen, §5 keine Telemetrie, §6 `shared/` ohne `chrome.`/`document.`/`window.`). Verworfene Ansätze stehen in `CLAUDE.md` und `docs/messungen.md` – nicht erneut vorschlagen.

Das Repository ist seit heute öffentlich, der full-Build aktualisiert sich über den Helfer aus GitHub-Releases (`native-host/yt_summary_host.py`, Funktionen `neuestes_release`, `update_pruefen`, `update_installieren`; `extension/lib/fallback.ts`, `extension/components/UpdateHinweis.tsx`, `extension/entrypoints/background.ts`).

Schwerpunkte, nach Risiko:
1. Sicherheit: XSS über Markdown-/Modellausgabe, Kommentare oder Transkripte; Befehlsinjektion im Helfer (Video-IDs, Pfade, Ordner); Update-Weg; Nachrichten zwischen Content-Script, Background und Helfer ohne Prüfung; Schlüssel-Leaks.
2. Datenverlust und halbfertige Zustände (Einstellungen, Migration in `shared/src/lib/settings.ts`, Update-Tausch, Downloads).
3. Echte Bugs: SPA-Navigation und Videowechsel, Abbruch, Fehlerpfade, Service-Worker-Lebensdauer, Stream-Parsing, Kindprozesse und Temp-Dateien im Helfer, Pfade mit Leerzeichen.
4. Prüfskripte, die grün werden, ohne zu messen (`extension/scripts/verify-store-bundle.sh`, `app/scripts/verify-app-bundle.sh`, `shared/scripts/check.sh`, `scripts/release.sh`).

Ausgabe auf Deutsch: nur belegte Befunde, je Befund Datei:Zeile, Schweregrad CRITICAL/MAJOR/MINOR, konkretes Fehlerszenario (Eingabe/Zustand → falsches Ergebnis) und kurzer Fix-Vorschlag. Keine Stilhinweise. Am Ende: was du nicht prüfen konntest.
