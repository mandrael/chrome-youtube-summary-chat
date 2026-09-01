/**
 * Selbstprüfung der Logik, die still falsch sein könnte: Zeitstempel-Erkennung,
 * Untertitel-Parser, Spurwahl, Preiseinheiten-Heuristik, Fallback-Parser.
 *
 * Kein Test-Framework, keine Fixtures. Aufruf:
 *   node scripts/selfcheck.ts
 *
 * Die Datei ist aus tsconfig.json ausgeschlossen, weil sie .ts-Erweiterungen in
 * den Importen braucht – Node braucht die, der Bundler nicht.
 */
import assert from "node:assert/strict";

import { formatTs, transcriptToText, tsToSeconds, TS_PATTERN } from "../lib/timestamps.ts";
import { parseJson3, pickTrack, videoIdFromUrl } from "../lib/transcript.ts";
import { guessPriceUnit, isValidSlug, toUsdPerHour } from "../lib/openrouter.ts";
import { toTranscript } from "../lib/fallback.ts";
import type { CaptionTrack, Transcript } from "../lib/types.ts";

let checks = 0;
const check = (name: string, fn: () => void) => {
  fn();
  checks++;
  console.log("  ok:", name);
};

console.log("timestamps");

check("formatTs unter einer Stunde", () => {
  assert.equal(formatTs(0, false), "00:00");
  assert.equal(formatTs(65, false), "01:05");
  assert.equal(formatTs(3599, false), "59:59");
  // Negative Werte kommen aus keiner Quelle, dürfen aber nichts kaputtmachen.
  assert.equal(formatTs(-5, false), "00:00");
});

check("formatTs über einer Stunde", () => {
  assert.equal(formatTs(3661, true), "01:01:01");
  assert.equal(formatTs(45, true), "00:00:45");
});

check("tsToSeconds beide Formate", () => {
  assert.equal(tsToSeconds("01", "05"), 65);
  assert.equal(tsToSeconds("01", "01", "01"), 3661);
  assert.equal(tsToSeconds(undefined, "05"), null);
});

check("TS_PATTERN trifft Zeitstempel und lässt Zahlen in Ruhe", () => {
  const found = (s: string) => {
    TS_PATTERN.lastIndex = 0;
    return [...s.matchAll(TS_PATTERN)].map((m) => m[0]);
  };
  assert.deepEqual(found("Thema A [01:23] und B [1:02:03]"), ["[01:23]", "[1:02:03]"]);
  // Genau das darf nicht passieren: Preise, Versionen und Messwerte bleiben Text.
  assert.deepEqual(found("Der Preis liegt bei 12:34 Euro, Version 3:1"), []);
  assert.deepEqual(found("TSMC N3E, 2:1-Verhältnis"), []);
  // Unmögliche Minuten- oder Sekundenwerte sind keine Zeitstempel.
  assert.deepEqual(found("[12:99]"), []);
});

check("transcriptToText mit und ohne Zeitstempel", () => {
  const base: Transcript = {
    cues: [
      { start: 5, dur: 3, text: "erstes" },
      { start: 65, dur: 3, text: "zweites" },
    ],
    source: "Test",
    hasTimestamps: true,
  };
  assert.equal(transcriptToText(base), "[00:05] erstes\n[01:05] zweites");

  // Über einer Stunde schaltet die Ausgabe auf hh:mm:ss um – und zwar überall,
  // nicht nur bei den späten Cues.
  const long: Transcript = {
    ...base,
    cues: [...base.cues, { start: 3700, dur: 10, text: "spät" }],
  };
  assert.equal(
    transcriptToText(long),
    "[00:00:05] erstes\n[00:01:05] zweites\n[01:01:40] spät",
  );

  assert.equal(
    transcriptToText({ ...base, hasTimestamps: false }),
    "erstes zweites",
  );
});

console.log("transcript");

check("parseJson3 liest Cues und wirft Leeres weg", () => {
  const body = JSON.stringify({
    events: [
      { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "Hallo " }, { utf8: "Welt" }] },
      { tStartMs: 1000, dDurationMs: 500, segs: [{ utf8: "\n" }] }, // reines Layout-Event
      { tStartMs: 2000, segs: [{ utf8: "  mit   Leerraum  " }] },
      { dDurationMs: 100, segs: [{ utf8: "ohne Startzeit" }] },
    ],
  });
  const cues = parseJson3(body);
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0], { start: 0, dur: 1, text: "Hallo Welt" });
  assert.equal(cues[1]?.text, "mit Leerraum");
  assert.equal(cues[1]?.dur, 0);
});

check("pickTrack bevorzugt die hochgeladene Spur", () => {
  const tracks: CaptionTrack[] = [
    { lang: "en", name: "English (auto)", url: "a", auto: true },
    { lang: "en", name: "English", url: "b", auto: false },
    { lang: "de", name: "Deutsch (auto)", url: "c", auto: true },
  ];
  assert.equal(pickTrack(tracks, "auto")?.url, "b");
  assert.equal(pickTrack(tracks, "en")?.url, "b");
  // Gibt es die Sprache nur automatisch, wird die genommen statt gar nichts.
  assert.equal(pickTrack(tracks, "de")?.url, "c");
  // Unbekannte Sprache fällt auf die Originalspur zurück, nicht auf null.
  assert.equal(pickTrack(tracks, "fr")?.url, "b");
  assert.equal(pickTrack([], "auto"), null);
});

check("videoIdFromUrl schliesst Shorts aus", () => {
  assert.equal(videoIdFromUrl("https://www.youtube.com/watch?v=abc12345678"), "abc12345678");
  assert.equal(videoIdFromUrl("https://www.youtube.com/watch?v=abc12345678&t=42"), "abc12345678");
  assert.equal(videoIdFromUrl("https://www.youtube.com/shorts/abc12345678"), null);
  assert.equal(videoIdFromUrl("https://www.youtube.com/"), null);
  assert.equal(videoIdFromUrl("kaputt"), null);
});

console.log("openrouter");

check("Preiseinheiten-Heuristik trifft die real gemessenen Werte", () => {
  // Alle drei stehen bei OpenRouter im selben Feld pricing.prompt, ohne Einheit.
  // Gemessen am 01.09.2026 über /api/v1/models/<id>/endpoints.
  assert.equal(guessPriceUnit(0.00000333), "second"); // whisper-turbo · DeepInfra
  assert.equal(guessPriceUnit(0.0015), "minute"); // parakeet-v3 · Together
  assert.equal(guessPriceUnit(0.04), "hour"); // whisper-turbo · Groq

  assert.equal(Number(toUsdPerHour(0.00000333, "second").toFixed(4)), 0.012);
  assert.equal(Number(toUsdPerHour(0.0015, "minute").toFixed(4)), 0.09);
  assert.equal(toUsdPerHour(0.04, "hour"), 0.04);
});

check("Modell-Slug braucht ein Provider-Präfix", () => {
  assert.ok(isValidSlug("google/gemini-3.5-flash-lite"));
  assert.ok(isValidSlug("google/gemini-3.5-flash-lite:batch"));
  assert.ok(!isValidSlug("gemini-3.5-flash-lite"));
  assert.ok(!isValidSlug(""));
});

console.log("fallback-parser");

check("toTranscript nimmt Segmente und blanken Text", () => {
  const timed = toTranscript({
    type: "result",
    route: "whisper",
    segments: [
      { start: 0, end: 2, text: " Hallo " },
      { start: 2, end: 5, text: "Welt" },
    ],
  } as never);
  assert.equal(timed.hasTimestamps, true);
  assert.equal(timed.cues.length, 2);
  assert.equal(timed.cues[0]?.text, "Hallo");
  assert.equal(timed.cues[1]?.dur, 3);

  // parakeet über OpenRouter liefert real nur Text – das darf nicht als
  // Zeitstempel-Transkript durchgehen, sonst erfindet die UI Sprungmarken.
  const plain = toTranscript({ type: "result", route: "parakeet", text: "nur Text" } as never);
  assert.equal(plain.hasTimestamps, false);
  assert.equal(plain.cues.length, 1);

  assert.throws(() => toTranscript({ type: "result", text: "   " } as never));
});

console.log(`\n${checks} Prüfungen bestanden.`);
