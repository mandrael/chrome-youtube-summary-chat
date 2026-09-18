# Auftrag: Aufbau eines Merges gegenlesen (18.09.2026)

Projekt: `~/NK Institute Dropbox/Michael Gasperl/Claude/chrome-youtube-summary-chat`
Branch: `claude/youtube-transcription-android-app-1ts44f`
Zu prüfen: die Commits `15a2a43` (Merge von `origin/main` 0.9.2 in den Android-Branch)
und `c9ae28c` (Ladeprobe wieder lauffähig).

Geprüft wird der **Aufbau**, nicht das Ergebnis. Alle Prüfungen sind grün gemeldet
worden – genau deshalb ist die Frage, ob sie das Richtige messen.

---

## Ausgangslage

Zwei Entwicklungslinien liefen auseinander:

- `origin/main` brachte in 0.9.2 die **Mistral-Preisrechnung**: Mistral liefert nur
  Token, der Geldbetrag kommt aus einer Preistabelle. Diese Rechnung sass in
  `extension/entrypoints/background.ts`, direkt in der Anbieter-Verzweigung.
- Der Android-Branch hat vorher genau diese Anbieter-Verzweigung aus `background.ts`
  herausgelöst und nach `shared/src/lib/chat.ts` verschoben, damit App und Erweiterung
  dieselbe Stelle rufen (Regel 1 des Projekts: ein Schalter, zwei Clients, keine
  generische Provider-Abstraktion, kein Fallback zwischen den Anbietern).

Der Merge hatte fünf Konflikte. Aufgelöst wurde so: die Preisrechnung wanderte in
`shared/src/lib/chat.ts`, `background.ts` behielt den blossen Aufruf von `chatStream`.
Zwei Importe zeigten danach noch auf `extension/lib` statt auf den Kern.

Dazu zwei Nacharbeiten:

- `app/vite.config.ts` löste den Alias `@shared` über `new URL(...).pathname` auf. Der
  Projektpfad enthält Leerzeichen, die dabei als `%20` stehen bleiben; der Bundler fand
  den Kern nicht. Jetzt `fileURLToPath`.
- `extension/scripts/ladeprobe.mjs` importiert `playwright`, das nirgends deklariert war.
  Playwright ist jetzt devDependency.

---

## Pflicht 1: Kopien gegen Originale abgleichen

Dieser Auftrag beschreibt den Stand aus zweiter Hand. **Verlass dich auf keine Zeile
davon.** Lies die Dateien, die wirklich gebaut und ausgeführt werden, und sage, wo diese
Beschreibung von ihnen abweicht:

- `git show 15a2a43`, `git show c9ae28c`, `git diff 9f69bcb..HEAD -- shared extension app`
- die Fassung von `background.ts` in `origin/main` (`git show origin/main:extension/entrypoints/background.ts`)
  gegen die Fassung in `HEAD`
- die gebauten Bundles in `build-full/`, `build-store/`, `app/dist/` – nicht nur den
  Quelltext. Wenn eine Prüfung den Quelltext greppt, wo sie das Bundle greppen müsste,
  ist das ein Befund.

## Pflicht 2: Selbst messen, an echten Daten, mit einer Rate

Nicht nur lesen. Führe die Prüfungen aus und nenne Zahlen mit Bezugsgrösse:

- **Wie viele der Änderungen aus 0.9.2 sind im Merge tatsächlich angekommen?** Zähle sie:
  `git diff 9f69bcb..origin/main` auflisten, jede Änderung im heutigen Stand suchen, Rate
  angeben („x von y"). Verschluckte Merge-Hunks sind der wahrscheinlichste Fehler hier.
- **Rechnet die Preisrechnung richtig?** `shared/src/lib/mistral.ts` enthält Tabelle und
  `preis()`. Rechne für echte Modell-IDs und echte Token-Zahlen nach, ob der Betrag in
  `chat.ts` dasselbe ergibt wie die Fassung in `origin/main:background.ts`. Achte auf die
  Einheit der Tabellenwerte (pro Token? pro Million?) – eine falsche Einheit fällt in
  keiner der grünen Prüfungen auf.
- **Was passiert ohne Tabellenpreis?** Der Zweig soll dann Token ohne Betrag zeigen, nicht
  einen Betrag 0.

Prüfungen des Projekts:

```
pnpm -r run compile
node extension/scripts/selfcheck.ts
bash shared/scripts/check.sh
cd extension && pnpm run build && pnpm run build:store && ./scripts/verify-store-bundle.sh
pnpm --filter @ytsc/app run build && bash app/scripts/verify-app-bundle.sh
cd extension && node scripts/ladeprobe.mjs ../build-full
```

## Die vier Standardfragen an jeden Prüfaufbau

1. **Steht der Prüfsatz im geprüften Gegenstand?** `shared/scripts/check.sh` behauptet,
   `provider === "mistral"` stehe an genau einer Stelle. Prüft es das wirklich, oder
   findet es sich selbst / einen Kommentar / eine Zeichenkette?
2. **Zählt ein fehlgeschlagener Lauf als Erfolg?** Insbesondere: `verify-app-bundle.sh`
   meldete „bestanden", obwohl Stufe 2 (entpackte APK) übersprungen wurde.
   `ladeprobe.mjs` meldet „bestanden" – woran hängt das, am Ergebnis oder am Anstoss?
   Exitcodes prüfen, nicht nur die Schlusszeile.
3. **Ist der geprüfte Gegenstand vollständig oder nachgebaut?** Greift
   `verify-store-bundle.sh` in das echte Bundle? Prüft es beide Richtungen (verbotener
   Code fehlt UND erwarteter Code ist da) samt Gegenprobe gegen den `full`-Build?
4. **Wird ein Zwischenspeicher gemessen statt der Sache?** `build-full/`, `build-store/`
   und `app/dist/` sind Artefakte eines früheren Laufs. Prüft jemand einen alten Stand?
   Neu bauen und vergleichen.

## Projektregeln, gegen die zu prüfen ist

Aus `CLAUDE.md` des Projekts, gekürzt:

1. Genau zwei Gegenstellen: OpenRouter und Mistral direkt. Kein weiterer Endpunkt, kein
   Fallback zwischen beiden, keine generische Provider-Abstraktion, die Verzweigung an
   genau einer Stelle.
2. Der Store-Build enthält keinen Download-Code – nicht ausgeblendet, sondern nicht
   vorhanden. Gegengeprüft am gebauten Bundle, nicht am Quelltext.
3. Kein stiller Fehlschlag beim Transkript.
5. Keine Telemetrie, kein Backend, kein Proxy. Host-Permissions nur `youtube.com`,
   `openrouter.ai`, `api.eu.mistral.ai`, `api.mistral.ai`.

Dazu die Versionsregel: `major.function.fix`, ein Commit ist genau ein Sprung, Nummer in
`extension/wxt.config.ts` und `extension/package.json` gleichzeitig. Frage: Hätte dieser
Merge eine Versionserhöhung gebraucht, und stimmen die Nummern in allen Paketen
(`extension`, `app`, `shared`) zueinander?

---

## Ausgabe

Befunde einzeln, jeweils: Datei und Zeile, was falsch ist, woran du es gemessen hast
(Befehl und Ausgabe), wie schwer es wiegt. Keine Zusammenfassung des Codes, keine
Stilfragen. Wenn ein Punkt in Ordnung ist, genügt eine Zeile – die Zeit gehört den
Befunden. Deutsch, echte Umlaute.
