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
  TS_RANGE_SEP,
  TS_PATTERN,
  TS_SINGLE,
  duenneMarkenAus,
} from "../../shared/src/lib/timestamps.ts";
import { parseJson3, pickTrack, videoIdAusText, videoIdFromUrl } from "../../shared/src/lib/transcript.ts";
import { chatStream } from "../../shared/src/lib/chat.ts";
import { inhaltAlsHtml, jsonNach, kommentareAlsText } from "../../shared/src/lib/kommentare.ts";
import { anteilPositiv, ganzeZahl, schaetzeDislikes } from "../../shared/src/lib/bewertung.ts";
import { guessPriceUnit, isValidSlug, toUsdPerHour } from "../../shared/src/lib/openrouter.ts";
import { deltaText, modelleAusListe, preis, verarbeiteSse, type MistralChunk, type RawModel } from "../../shared/src/lib/mistral.ts";
import { toTranscript } from "../lib/fallback.ts";
import { panelTimeToSeconds } from "../lib/transcript-panel.ts";
import type { CaptionTrack, Settings, Transcript, Usage } from "../../shared/src/lib/types.ts";
import { bildeAbsaetze, bildeLeseabsaetze } from "../../shared/src/lib/absaetze.ts";
import { baueWav } from "../lib/audio-live.ts";
import {
  korrigiere,
  korrigiereTranskript,
  parseWoerterbuch,
  schreibweisenHinweis,
} from "../../shared/src/lib/korrektur.ts";

let checks = 0;
const check = (name: string, fn: () => void) => {
  fn();
  checks++;
  console.log("  ok:", name);
};

const checkAsync = async (name: string, fn: () => Promise<void>) => {
  await fn();
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
  assert.equal(videoIdFromUrl("https://www.youtube.com/live/-1iHM9E9_JQ?si=x"), "-1iHM9E9_JQ");
  assert.equal(videoIdFromUrl("https://www.youtube.com/live/zu-kurz"), null);
  assert.equal(videoIdFromUrl("https://www.youtube.com/"), null);
  assert.equal(videoIdFromUrl("kaputt"), null);
});

console.log("transkript-panel");

check("Geteilter Text: Video-ID aus youtu.be, watch, live – Shorts nicht", () => {
  // Was die YouTube-App beim Teilen schickt, ist kein sauberer Link.
  assert.equal(videoIdAusText("Schau mal https://youtu.be/aqz-KE-bpKQ?si=Ab12"), "aqz-KE-bpKQ");
  assert.equal(videoIdAusText("https://m.youtube.com/watch?v=9CZBIaaiPRI&t=30s"), "9CZBIaaiPRI");
  assert.equal(videoIdAusText("https://www.youtube.com/live/aqz-KE-bpKQ"), "aqz-KE-bpKQ");
  assert.equal(videoIdAusText("https://www.youtube.com/shorts/aqz-KE-bpKQ"), null);
  assert.equal(videoIdAusText("gar kein Link"), null);
  // Fremde Hosts, die nur so aussehen, zählen nicht; Subdomain und fehlendes Schema schon.
  assert.equal(videoIdAusText("https://notyoutube.com/watch?v=aqz-KE-bpKQ"), null);
  assert.equal(videoIdAusText("https://evil.test/youtu.be/aqz-KE-bpKQ"), null);
  assert.equal(videoIdAusText("https://music.youtube.com/watch?v=aqz-KE-bpKQ"), "aqz-KE-bpKQ");
  assert.equal(videoIdAusText("Titel youtu.be/aqz-KE-bpKQ"), "aqz-KE-bpKQ");
  // Mehrere Parameter vor v=, und bei doppeltem v= gilt das erste – wie bei YouTube.
  assert.equal(videoIdAusText("https://www.youtube.com/watch?list=PLx&index=2&v=aqz-KE-bpKQ"), "aqz-KE-bpKQ");
  assert.equal(videoIdAusText("https://www.youtube.com/watch?v=aqz-KE-bpKQ&v=9CZBIaaiPRI"), "aqz-KE-bpKQ");
});

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
  assert.ok(isValidSlug("~openai/gpt-luna-latest"));
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

check("Mistral-Modellliste: Aliase ergeben je Modell einen Eintrag, nie eine leere Liste", () => {
  const chat = { completion_chat: true };
  const data: RawModel[] = [
    // symmetrisch (der Fall vom 05.09.2026, der alte Filter strich alles)
    { id: "mistral-small-2506", aliases: ["mistral-small-latest"], capabilities: chat, created: 2 },
    { id: "mistral-small-latest", aliases: ["mistral-small-2506"], capabilities: chat, created: 2 },
    // einseitig: nur der Alias nennt den Grund
    { id: "mistral-medium-latest", aliases: ["mistral-medium-3-5"], capabilities: chat, created: 3 },
    { id: "mistral-medium-3-5", aliases: [], capabilities: chat, created: 3 },
    // einseitig andersherum, dazu ein nummernloser Kurzname
    { id: "codestral-2508", aliases: ["codestral-latest", "codestral"], capabilities: chat, created: 4 },
    { id: "codestral-latest", capabilities: chat, created: 4 },
    { id: "codestral", capabilities: chat, created: 4 },
    // ein Alias auf zwei Grundmodelle: beide bleiben
    { id: "ministral-8b-2410", aliases: ["ministral-8b-latest"], capabilities: chat, created: 1 },
    { id: "ministral-8b-2512", aliases: ["ministral-8b-latest"], capabilities: chat, created: 5 },
    { id: "ministral-8b-latest", aliases: ["ministral-8b-2512"], capabilities: chat, created: 5 },
    { id: "codestral-embed", aliases: [], capabilities: { completion_chat: false } },
    { id: "ohne-alias", capabilities: chat, created: 0 },
  ];
  const ids = modelleAusListe(data).map((m) => m.id);
  assert.deepEqual(ids, [
    "ministral-8b-latest",
    "codestral-latest",
    "mistral-medium-latest",
    "mistral-small-latest",
    "ohne-alias",
  ]);
  // Ein datierter Name ohne -latest-Partner bleibt stehen, statt zu verschwinden.
  const nurDatiert: RawModel[] = [{ id: "mistral-neu-2609", aliases: ["mistral-neu"], capabilities: chat }, { id: "mistral-neu", capabilities: chat }];
  assert.deepEqual(modelleAusListe(nurDatiert).map((m) => m.id), ["mistral-neu-2609"]);
});

check("Mistral-Preistabelle: Familie erkannt, EU-Aufpreis 10 %, Unbekanntes ohne Preis", () => {
  const global = preis("mistral-medium-latest", "global")!;
  const eu = preis("mistral-medium-latest", "eu")!;
  assert.equal(global.ein, 1.5e-6);
  assert.equal(global.aus, 7.5e-6);
  assert.ok(Math.abs(eu.ein - 1.65e-6) < 1e-15 && Math.abs(eu.aus - 8.25e-6) < 1e-15);
  // Datierte Altversionen sind anders bepreist (Codex 06.09.2026): kein Preis statt falscher.
  assert.equal(preis("mistral-medium-2508", "global"), null);
  assert.equal(preis("ministral-8b-2410", "global"), null);
  assert.equal(preis("codestral-embed-2505", "eu"), null);
  assert.equal(preis("magistral-medium-latest", "eu"), null);
  const [m] = modelleAusListe([{ id: "mistral-small-latest", capabilities: { completion_chat: true } }], "eu");
  assert.ok(m && Math.abs((m.pricePrompt ?? 0) - 0.165e-6) < 1e-15);
});

// Die Rechnung selbst, nicht nur die Tabelle: bis hierher prüfte nur `preis()`. Eine
// Formel in chat.ts ohne Division, mit vertauschten Faktoren oder mit stillem cost: 0
// wäre grün geblieben (Grok, 18.09.2026). Deshalb läuft hier der echte Weg mit
// gefälschter Gegenstelle.
await checkAsync("Mistral-Kosten je Antwort: Token mal Tabellenpreis, sonst gar nichts", async () => {
  const strom = [
    'data: {"choices":[{"delta":{"content":"hallo"}}]}',
    'data: {"usage":{"prompt_tokens":30000,"completion_tokens":2000}}',
    "data: [DONE]",
    "",
  ].join("\n\n");

  const lauf = async (model: string): Promise<Usage | undefined> => {
    const echtes = globalThis.fetch;
    globalThis.fetch = (async () => new Response(strom, { status: 200 })) as typeof fetch;
    try {
      let gesehen: Usage | undefined;
      await chatStream(
        { provider: "mistral", mistralApiKey: "test", mistralModel: model, mistralRegion: "global" } as Settings,
        { model: "", supportsReasoning: false, reasoning: "minimal", system: "", messages: [] },
        { onDelta: () => {}, onUsage: (u) => { gesehen = u; } },
        new AbortController().signal,
      );
      return gesehen;
    } finally {
      globalThis.fetch = echtes;
    }
  };

  // 30.000 × 1,50 $ + 2.000 × 7,50 $ je Million = 0,045 + 0,015 = 0,06 $.
  const mitPreis = await lauf("mistral-medium-latest");
  assert.equal(mitPreis?.prompt_tokens, 30_000);
  assert.ok(Math.abs((mitPreis?.cost ?? 0) - 0.06) < 1e-12, `erwartet 0,06 – bekommen ${mitPreis?.cost}`);

  // Ohne Tabellenpreis bleibt das Feld weg; ein cost von 0 wäre eine erfundene Zahl.
  const ohnePreis = await lauf("magistral-medium-latest");
  assert.equal(ohnePreis?.completion_tokens, 2_000);
  assert.equal(ohnePreis?.cost, undefined);
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

check("Zeitspannen: die Klammer trifft, nur der Anfang ist Sprungziel", () => {
  const text = "Behauptung [12:34–13:10], auch [01:00 - 02:00] und [05:00 bis 06:00].";
  TS_GROUP_PATTERN.lastIndex = 0;
  const treffer = [...text.matchAll(TS_GROUP_PATTERN)].map((m) => m[1]);
  assert.deepEqual(treffer, ["12:34–13:10", "01:00 - 02:00", "05:00 bis 06:00"]);
  assert.equal(TS_RANGE_SEP.test("–"), true);
  assert.equal(TS_RANGE_SEP.test(" - "), true);
  assert.equal(TS_RANGE_SEP.test(", "), false);
  assert.equal(TS_RANGE_SEP.test(" und "), false);
});

check("Kommentar-HTML: Fett, Kursiv, Links, Emojis nach UTF-16-Index", () => {
  // Aufbau wie gemessen am 26.09.2026: „😭“ zählt zwei Einheiten, Läufe überlappen.
  const html = inhaltAlsHtml({
    content: "😭 fett kursiv 0:25 <x> :yt: link",
    styleRuns: [
      { startIndex: 3, length: 4, weightLabel: "FONT_WEIGHT_MEDIUM" },
      { startIndex: 8, length: 6, weightLabel: "FONT_WEIGHT_NORMAL", italic: true },
      { startIndex: 15, length: 4, weightLabel: "FONT_WEIGHT_NORMAL" },
    ],
    commandRuns: [
      { startIndex: 15, length: 4, onTap: { innertubeCommand: { commandMetadata: { webCommandMetadata: { url: "/watch?v=abc&t=25s" } } } } },
      { startIndex: 29, length: 4, onTap: { innertubeCommand: { urlEndpoint: { url: "https://www.youtube.com/redirect?q=https%3A%2F%2Fexample.org%2F" } } } },
    ],
    attachmentRuns: [
      { startIndex: 0, length: 2, element: { type: { imageType: { image: { sources: [{ url: "https://e/u1f62d.png" }] } } }, properties: { accessibilityProperties: { label: "😭" } } } },
      { startIndex: 24, length: 4, element: { type: { imageType: { image: { sources: [{ url: "https://e/yt.png" }] } } }, properties: { accessibilityProperties: { label: ":yt-smile:" } } } },
    ],
  });
  assert.equal(
    html,
    '😭 <b>fett</b> <i>kursiv</i> <a href="https://www.youtube.com/watch?v=abc&amp;t=25s">0:25</a> &lt;x&gt; ' +
      '<img class="emoji" src="https://e/yt.png" alt=":yt-smile:"> <a href="https://example.org/">link</a>',
  );
  // Ein Redirect auf `javascript:` wird kein Link.
  const boese = inhaltAlsHtml({
    content: "klick",
    commandRuns: [{ startIndex: 0, length: 5, onTap: { innertubeCommand: { urlEndpoint: { url: "https://www.youtube.com/redirect?q=javascript%3Aalert(1)" } } } }],
  });
  assert.equal(boese, "klick");
  assert.deepEqual(jsonNach('x = {"a":"}{","b":{"c":1}};', "x = "), { a: "}{", b: { c: 1 } });
});

check("Dislike-Schätzung aus Aufrufen und Likes, Zahlen aus Seitentexten", () => {
  // Mediane aus dem Archiv 2021 (docs/messungen.md): Like-Rate 1 % → Anteil 5,1 %,
  // 10 % → 1,4 %, 0,1 % → 19,8 %. Die Gerade muss in deren Nähe liegen.
  const anteil = (v: number, l: number) => {
    const d = schaetzeDislikes(v, l)!;
    return d / (d + l);
  };
  assert.ok(Math.abs(anteil(100_000, 1_000) - 0.05) < 0.01, String(anteil(100_000, 1_000)));
  assert.ok(Math.abs(anteil(100_000, 10_000) - 0.014) < 0.005, String(anteil(100_000, 10_000)));
  assert.ok(Math.abs(anteil(100_000, 100) - 0.198) < 0.03, String(anteil(100_000, 100)));
  assert.equal(schaetzeDislikes(0, 5), null);
  assert.equal(schaetzeDislikes(1000, 0), null);
  assert.equal(schaetzeDislikes(10, 50), null); // mehr Likes als Aufrufe: Unsinn
  assert.equal(anteilPositiv(0, 0), null);
  assert.equal(anteilPositiv(3, 1), 0.75);
  assert.equal(ganzeZahl("Dieses Video liken (bisher 110.047 positive Bewertungen)"), 110047);
  assert.equal(ganzeZahl("like this video along with 110,047 other people"), 110047);
  assert.equal(ganzeZahl("23\u202f400\u202f861 vues"), 23400861);
  assert.equal(ganzeZahl("Dieses Video liken"), null);
});

check("Kommentare als Text für die Stimmungsauswertung", () => {
  const k = (content: string, likes: string, vomKanal = false) => ({
    id: content, autor: "", autorUrl: "", avatar: "", inhalt: { content }, zeit: "", likes,
    angepinnt: "", herz: false, vomKanal, verifiziert: false, antworten: [],
  });
  const text = kommentareAlsText(
    { anzahlText: "", unvollstaendig: false, kommentare: [k("Super\nVideo", "12"), k("x".repeat(600), "", true)] },
    500,
  );
  const [a, b] = text.split("\n");
  assert.equal(a, "[12 Likes] Super Video");
  assert.ok(b!.startsWith("[0 Likes, Kanal selbst] xxx") && b!.endsWith(" …") && b!.length < 540);
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

  // Wortgrenzen auch an Umlauten; „$&" im Ersatz bleibt wörtlich; kein Treffer mitten im Wort.
  const umlaut = [{ begriff: "Übung", ersatz: "Training" }, { begriff: "café", ersatz: "Kaffee $&" }];
  assert.equal(korrigiere("Die Übung beginnt.", umlaut), "Die Training beginnt.");
  assert.equal(korrigiere("Im Café.", umlaut), "Im Kaffee $&.");
  assert.equal(korrigiere("Vorübung bleibt.", umlaut), "Vorübung bleibt.");

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
