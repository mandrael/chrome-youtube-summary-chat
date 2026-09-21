# Auftrag: Code-Review des Android-Branches (21.09.2026)

Du bist ausschließlich lesender Reviewer. Ändere, erzeuge und lösche keine Dateien im
Projekt; starte keine Subagenten. Lies keine Zugangsdaten, `.env`, personenbezogenen
Daten oder produktiven Datensätze. Prüfe Code, Diff und Tests am Primärartefakt. Melde nur
konkrete Fehler oder fehlende Belege. Wenn du zum Nachstellen etwas verändern musst, dann
nur in einer Kopie unter `/tmp`, nie im Arbeitsbaum.

Projekt: `~/NK Institute Dropbox/Michael Gasperl/Claude/chrome-youtube-summary-chat`
Branch: `claude/youtube-transcription-android-app-1ts44f`, HEAD `cd1340f`.
Gegenstand: alles, was der Branch gegenüber `origin/main` ändert –
`git diff origin/main...HEAD` (109 Dateien, rund 4.000 Zeilen).

## Was der Branch tut

1. **Workspace-Umbau:** Der plattformneutrale Kern der Chrome-Erweiterung wurde nach
   `shared/src/lib/` herausgelöst (pnpm-Workspace): openrouter, mistral, chat, prompts,
   transcript, settings, timestamps, absaetze, korrektur, tracks, i18n, translate-cues,
   types. Vier Nähte: `chat.ts` (Anbieter-Verzweigung), `Http` in `transcript.ts`,
   `settings.ts`, injizierter `stream` in `translate-cues.ts`.
2. **Android-Spike:** `app/` ist eine Capacitor-8-App, ein Bildschirm, sieben Messungen
   (`app/src/main.ts`, `app/src/http-capacitor.ts`), `android/`-Gerüst eingecheckt.
   Sie ist ein Messgerät, kein Produkt.
3. **Prüfskripte:** `shared/scripts/check.sh`, `app/scripts/verify-app-bundle.sh`,
   `extension/scripts/ladeprobe.mjs`, `extension/scripts/verify-store-bundle.sh`,
   `extension/scripts/selfcheck.ts`, `.github/workflows/android.yml`.

## Wonach du suchst (Code-Review, nicht Stil)

- **Echte Fehler:** falsche Logik, Wettläufe, nicht behandelte Fehlerpfade, Ressourcen-
  lecks, Randfälle (leere Eingaben, Abbruch per AbortSignal, Netzfehler mitten im Strom,
  abgeschnittene SSE-Zeilen, Nicht-JSON-Antworten).
- **Regressionen durch den Umbau:** Verhält sich die Erweiterung nach dem Herauslösen
  irgendwo anders als vorher? Vergleiche gegen `origin/main`. Besonders: `Http`-Naht in
  `transcript.ts` (Cookies/credentials, Header), `translate-cues.ts` mit injiziertem
  Strom, `settings.ts` (Vorgaben, Migration, Schlüsselnamen), `background.ts`.
- **Die App:** `http-capacitor.ts` (Statuscodes, Header, Text/JSON, Fehlerabbildung),
  Teilen-Ziel und Video-ID-Erkennung, Player-Einbettung, Umgang mit API-Schlüsseln
  (wo liegen sie, werden sie geloggt?), Android-Manifest und Gradle (Permissions,
  exported-Komponenten, Cleartext, Backup-Regeln, Analytics-Abhängigkeiten).
- **Sicherheit:** XSS über Markdown/innerHTML, Schlüssel in Logs oder URLs,
  Intent-Eingaben ungeprüft verwendet, zu weite Permissions.
- **Prüfskripte:** Kann ein Skript grün sein, während die geprüfte Sache kaputt ist?

## Projektregeln (Verstösse sind Befunde)

1. Genau zwei Gegenstellen: OpenRouter und Mistral direkt. Kein weiterer Endpunkt, kein
   Fallback zwischen beiden, keine generische Provider-Abstraktion; die Verzweigung
   steht nur in `shared/src/lib/chat.ts`.
2. Store-Build und App enthalten keinen Download-Code (Native Messaging, yt-dlp).
3. Kein stiller Fehlschlag beim Transkript – kein Platzhalter, keine erfundene Ausgabe.
4. Kein Download, keine Tonaufnahme ohne Klick.
5. Keine Telemetrie, kein Backend, kein Proxy. Host-Permissions nur `youtube.com`,
   `openrouter.ai`, `api.eu.mistral.ai`, `api.mistral.ai`; Android nur `INTERNET`.
6. In `shared/` kein `chrome.`, `document.`, `window.`, nichts aus `wxt/`, kein
   `__FALLBACK__`.

## Pflicht

- **Originale lesen, nicht dieser Beschreibung glauben.** Wo sie vom Bestand abweicht,
  ist das ein Befund.
- **Messen, wo es geht, und eine Zahl nennen:** Prüfungen ausführen
  (`pnpm -r run compile`, `node extension/scripts/selfcheck.ts`,
  `bash shared/scripts/check.sh`), verdächtige Funktionen mit echten Eingaben in einer
  Kopie unter `/tmp` nachstellen. „Sieht falsch aus" ohne Beleg zählt wenig.

## Ausgabe

Befunde nach Schwere (CRITICAL, MAJOR, MINOR), jeweils: Datei und Zeile, was falsch ist,
konkretes Fehlerszenario (Eingabe → falsches Verhalten), Beleg (Befehl und Ausgabe oder
Codezitat), Vorschlag in einem Satz. Keine Code-Zusammenfassung, keine Stilfragen, kein
Lob. Am Ende eine Zeile: wie viele Dateien du tatsächlich gelesen und welche Befehle du
ausgeführt hast. Deutsch, echte Umlaute.
