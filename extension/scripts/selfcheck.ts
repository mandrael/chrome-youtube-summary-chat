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
import { readFileSync } from "node:fs";

import {
  formatTs,
  transcriptToText,
  tsToSeconds,
  TS_GROUP_PATTERN,
  TS_PATTERN,
  TS_SINGLE,
  duenneMarkenAus,
} from "../lib/timestamps.ts";
import { parseJson3, pickTrack, videoIdFromUrl } from "../lib/transcript.ts";
import { guessPriceUnit, isValidSlug, toUsdPerHour } from "../lib/openrouter.ts";
import { deltaText, verarbeiteSse, type MistralChunk } from "../lib/mistral.ts";
import { toTranscript } from "../lib/fallback.ts";
import { panelTimeToSeconds } from "../lib/transcript-panel.ts";
import type { CaptionTrack, Transcript } from "../lib/types.ts";
import { bildeAbsaetze, bildeLeseabsaetze } from "../lib/absaetze.ts";
import { baueWav } from "../lib/audio-live.ts";
import {
  korrigiere,
  korrigiereTranskript,
  parseWoerterbuch,
  schreibweisenHinweis,
} from "../lib/korrektur.ts";

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

console.log("transkript-panel");

check("panelTimeToSeconds liest YouTubes Panel-Format", () => {
  // Real gemessen: das Panel schreibt „0:00“ bis „18:29“, bei langen Videos „1:02:03“.
  assert.equal(panelTimeToSeconds("0:00"), 0);
  assert.equal(panelTimeToSeconds("18:29"), 1109);
  assert.equal(panelTimeToSeconds(" 1:02:03 "), 3723);
  assert.equal(panelTimeToSeconds("abc"), null);
  assert.equal(panelTimeToSeconds("12"), null);
  assert.equal(panelTimeToSeconds(""), null);
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

console.log("mistral");

check("SSE-Parser verträgt zerschnittene Ereignisse, Kommentare und [DONE]", () => {
  // Das Format laut Mistrals OpenAPI-Spec: data-only SSE, Abschluss mit `data: [DONE]`.
  const gesehen: string[] = [];
  const usage: number[] = [];
  const auf = (c: MistralChunk) => {
    const t = deltaText(c);
    if (t) gesehen.push(t);
    if (c.usage) usage.push(c.usage.completion_tokens ?? -1);
  };
  const ereignis = (delta: unknown, extra = "") =>
    `data: {"id":"x","choices":[{"index":0,"delta":${JSON.stringify(delta)},"finish_reason":null}]${extra}}\n\n`;

  // Ein Netzwerkpaket endet mitten im JSON: der Rest bleibt im Puffer liegen …
  const ganz = ereignis({ role: "assistant", content: "Hal" });
  let rest = verarbeiteSse(ganz.slice(0, 30), auf);
  assert.equal(rest, ganz.slice(0, 30), "unvollständige Zeile darf nicht verworfen werden");
  assert.deepEqual(gesehen, []);
  // … und wird mit dem nächsten Paket vollständig.
  rest = verarbeiteSse(rest! + ganz.slice(30) + ": keep-alive\n\n", auf);
  assert.equal(rest, "");
  assert.deepEqual(gesehen, ["Hal"]);

  // Ein Ereignis ohne abschliessende Leerzeile bleibt liegen, bis sie kommt.
  rest = verarbeiteSse(ereignis({ content: "x" }).trimEnd(), auf);
  assert.equal(rest, ereignis({ content: "x" }).trimEnd());
  assert.deepEqual(gesehen, ["Hal"]);
  rest = verarbeiteSse(rest! + "\r\n\r\n", auf);
  assert.equal(rest, "");
  assert.deepEqual(gesehen, ["Hal", "x"]);

  // JSON über zwei data-Zeilen verteilt (SSE-Spezifikation: mit \n verbinden).
  const zweizeilig = ereignis({ content: "yz" }).trimEnd();
  const schnitt = zweizeilig.indexOf('"delta"');
  rest = verarbeiteSse(zweizeilig.slice(0, schnitt) + "\ndata: " + zweizeilig.slice(schnitt) + "\n\n", auf);
  assert.equal(rest, "");
  assert.deepEqual(gesehen, ["Hal", "x", "yz"]);

  // Inhalt als Chunk-Array (laut Spec erlaubt) und usage im letzten Ereignis.
  rest = verarbeiteSse(
    ereignis({ content: [{ type: "text", text: "lo" }, { type: "reference", text: "nein" }] }) +
      ereignis({ content: "" }, ',"usage":{"prompt_tokens":10,"completion_tokens":3}') +
      "data: [DONE]\n\n" +
      ereignis({ content: "zu spät" }),
    auf,
  );
  assert.equal(rest, null, "[DONE] beendet den Strom");
  assert.deepEqual(gesehen, ["Hal", "x", "yz", "lo"]);
  assert.deepEqual(usage, [3]);
});

check("Mistral-Delta ohne Inhalt ergibt leeren Text", () => {
  assert.equal(deltaText({}), "");
  assert.equal(deltaText({ choices: [{ delta: { content: null } }] }), "");
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

console.log("absaetze");

check("Leseabsätze fassen Absätze zusammen und behalten die Grenzen", () => {
  // 60 Cues à 3 s mit je 5 Wörtern; nach jedem vierten eine Pause von 2,5 s. Das
  // beendet den Absatz der Stufe 2 (Schwelle 2 s), reicht aber nicht für den
  // vorzeitigen Schnitt der Stufe 3 (Schwelle 3 s) – die sammelt also bis 150 Wörter.
  const cues = Array.from({ length: 60 }, (_, i) => ({
    start: i * 3 + Math.floor(i / 4) * 2.5,
    dur: 3,
    text: Array.from({ length: 5 }, (_, w) => `w${w}`).join(" "),
  }));
  const abs = bildeAbsaetze(cues);
  const lese = bildeLeseabsaetze(cues, abs);

  assert.ok(lese.length < abs.length, "Leseabsätze müssen gröber sein als Absätze");
  // Lückenlos und in der Reihenfolge: sonst fehlt Text oder er kommt doppelt.
  assert.equal(lese[0]?.von, 0);
  assert.equal(lese.at(-1)?.bis, cues.length - 1);
  for (let i = 1; i < lese.length; i++) assert.equal(lese[i]!.von, lese[i - 1]!.bis + 1);
  // Jede Leseabsatzgrenze liegt auf einer Absatzgrenze.
  const enden = new Set(abs.map((a) => a.bis));
  for (const a of lese) assert.ok(enden.has(a.bis));
});

console.log("options");

check("Kein React-Hook hinter dem Lade-Guard der Options-Seite", () => {
  // Zweimal passiert und beide Male erst im Browser aufgefallen: die Seite rendert
  // dann gar nichts mehr („Rendered more hooks than during the previous render").
  const quelle = readFileSync(new URL("../entrypoints/options/Options.tsx", import.meta.url), "utf8");
  const guard = quelle.indexOf("  if (!s) {");
  assert.ok(guard > 0, "Lade-Guard nicht gefunden – Prüfung würde nichts messen");
  const danach = quelle.slice(guard, quelle.indexOf("\n/* ---------- Bausteine"));
  assert.equal(
    /React\.use(State|Memo|Effect|Callback|Ref|Reducer)\b/.test(danach),
    false,
    "Hook steht hinter dem frühen Return",
  );
});

check("TS_GROUP_PATTERN fasst mehrere Zeiten in einer Klammer", () => {
  // Genau das kam aus dem Modell und blieb stummer Text: „[18:46, 21:03, 34:44]".
  const text = "Nacharbeit nötig [18:46, 21:03, 34:44] und einzeln [01:02:03].";
  TS_GROUP_PATTERN.lastIndex = 0;
  const treffer = [...text.matchAll(TS_GROUP_PATTERN)].map((m) => m[1]);
  assert.deepEqual(treffer, ["18:46, 21:03, 34:44", "01:02:03"]);

  TS_SINGLE.lastIndex = 0;
  const zeiten = [...(treffer[0] ?? "").matchAll(TS_SINGLE)].map((m) =>
    tsToSeconds(m[1], m[2], m[3]),
  );
  assert.deepEqual(zeiten, [18 * 60 + 46, 21 * 60 + 3, 34 * 60 + 44]);

  // Zahlen ohne Klammern bleiben in Ruhe.
  TS_GROUP_PATTERN.lastIndex = 0;
  assert.equal(TS_GROUP_PATTERN.test("Preise 3,55 bis 11,587 Dollar"), false);
});

check("Zu dichte Zeitmarken werden ausgedünnt", () => {
  // „[00:02, 00:10]" sind acht Sekunden – dort springt niemand zweimal hin.
  TS_SINGLE.lastIndex = 0;
  const zeiten = [...("00:02, 00:10, 05:30".matchAll(TS_SINGLE))].map((m) =>
    tsToSeconds(m[1], m[2], m[3]),
  );
  assert.deepEqual(zeiten, [2, 10, 330]);
  const behalten = duenneMarkenAus(zeiten as number[]);
  assert.deepEqual(behalten, [true, false, true]);
  // Drei dicht aufeinanderfolgende: nur die erste bleibt, gemessen wird immer gegen
  // die zuletzt behaltene, nicht gegen die unmittelbar vorige.
  assert.deepEqual(duenneMarkenAus([0, 10, 20, 40]), [true, false, false, true]);
});

console.log("audio-live");

check("Der WAV-Kopf traegt die zurückgerechnete Abtastrate", () => {
  // Vier Abtastwerte, aufgenommen bei 44.100 Hz und vierfachem Tempo: in Videozeit ist
  // das ein 11.025-Hz-Signal. Genau diese Zahl muss im Kopf stehen – sie allein macht
  // die beschleunigte Aufnahme wieder normal schnell.
  const wav = baueWav(new Float32Array([0, 1, -1, 0.5]), 11025);
  const view = new DataView(wav.buffer);
  const text = (pos: number, len: number) =>
    String.fromCharCode(...Array.from(wav.subarray(pos, pos + len)));

  assert.equal(text(0, 4), "RIFF");
  assert.equal(text(8, 8), "WAVEfmt ");
  assert.equal(text(36, 4), "data");
  assert.equal(view.getUint16(22, true), 1, "ein Kanal");
  assert.equal(view.getUint32(24, true), 11025, "Abtastrate in Videozeit");
  assert.equal(view.getUint32(28, true), 11025 * 2, "Bytes je Sekunde");
  assert.equal(view.getUint16(34, true), 16, "16 Bit");
  assert.equal(wav.length, 44 + 4 * 2);
  assert.equal(view.getUint32(4, true), 36 + 4 * 2, "RIFF-Laenge");
  assert.equal(view.getUint32(40, true), 4 * 2, "data-Laenge");

  // Vollausschlag darf nicht ueberlaufen: +1 wird 32767, -1 wird -32768.
  assert.equal(view.getInt16(44 + 2, true), 32767);
  assert.equal(view.getInt16(44 + 4, true), -32768);
});

console.log("korrektur");

check("Wörterbuch ersetzt und setzt Schreibweisen durch", () => {
  const wb = [
    { begriff: "Cloud Code", ersatz: "Claude Code" },
    { begriff: "DiktaGo" },
    { begriff: "Kinesiologie" },
  ];

  // Stufe 1: echtes Ersetzungspaar, Gross- und Kleinschreibung egal.
  assert.equal(korrigiere("Mit cloud code getestet.", wb), "Mit Claude Code getestet.");

  // Stufe 2: eigene Schreibweise, auch über Leerzeichen und Bindestrich hinweg.
  assert.equal(korrigiere("Ich nutze diktago täglich.", wb), "Ich nutze DiktaGo täglich.");
  assert.equal(korrigiere("Ich nutze Dikta Go täglich.", wb), "Ich nutze DiktaGo täglich.");
  assert.equal(korrigiere("Ich nutze Dikta-Go täglich.", wb), "Ich nutze DiktaGo täglich.");

  // Deutsche Flexion: die Endung bleibt stehen, nur die Schreibung wird gesetzt.
  assert.equal(korrigiere("kinesiologische Arbeit", [{ begriff: "Kinesiologie" }]),
               "kinesiologische Arbeit"); // „…logische“ ist nicht „…logie“ plus Endung
  assert.equal(korrigiere("Neuroenergetische Kinesiologie", [{ begriff: "NeuroEnergetisch" }]),
               "NeuroEnergetische Kinesiologie");
  assert.equal(korrigiere("diktagos Ausgabe", wb), "DiktaGos Ausgabe");

  // Was nicht im Wörterbuch steht, bleibt unangetastet – auch Wörter, die einem
  // Eintrag ähneln. Genau hier liegt die Grenze zu DiktaGos Fuzzy-Stufen.
  assert.equal(korrigiere("Das Bild hängt schief.", wb), "Das Bild hängt schief.");
  assert.equal(korrigiere("Kinesologie ist etwas anderes.", wb), "Kinesologie ist etwas anderes.");

  // Der Hinweis nennt nur, was im Text vorkommt.
  const hinweis = schreibweisenHinweis("Wir sprechen über Kinesiologie.", wb);
  assert.ok(hinweis.includes("Kinesiologie"));
  assert.ok(!hinweis.includes("Claude Code"));
  assert.equal(schreibweisenHinweis("Nichts davon hier.", wb), "");
});

check("Wörterbuchtext wird zu Einträgen und wirkt zeilenweise", () => {
  const wb = parseWoerterbuch(
    "# Kommentar\nCloud Code => Claude Code\n\n  DiktaGo  \nkaputt =>   \n",
  );
  assert.deepEqual(wb, [
    { begriff: "Cloud Code", ersatz: "Claude Code" },
    { begriff: "DiktaGo" },
    // Ein Pfeil ohne Ersatzwort ist keine Ersetzung, sondern eine Schreibweise.
    { begriff: "kaputt" },
  ]);

  // Zeilenweise, damit die Zuordnung zum Zeitstempel erhalten bleibt.
  const tr = { hasTimestamps: true, cues: [{ start: 0, text: "cloud code" }, { start: 9, text: "egal" }] };
  const korrigiert = korrigiereTranskript(tr, wb);
  assert.deepEqual(korrigiert.cues, [
    { start: 0, text: "Claude Code" },
    { start: 9, text: "egal" },
  ]);
  // Das Original bleibt unangetastet: die Sidebar hält beide Stände.
  assert.equal(tr.cues[0]!.text, "cloud code");
  // Ohne Einträge kommt dasselbe Objekt zurück, ohne Kopie.
  assert.equal(korrigiereTranskript(tr, []), tr);
});

console.log(`\n${checks} Prüfungen bestanden.`);
