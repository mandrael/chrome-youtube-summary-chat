/**
 * Kandidaten für Standard- und Schnellmodell messen – derselbe Anfragekörper wie
 * `streamChat` in shared/src/lib/openrouter.ts (stream, usage, reasoning minimal), zwei
 * Läufe je Modell wie am 05.09.2026 (docs/messungen.md): ein kurzer Prompt und rund
 * 218.000 Zeichen Text mit einer Frage, deren Antwort darin nachprüfbar steht.
 *
 * Der Schlüssel kommt aus der Umgebung und wird nirgends ausgegeben:
 *   read -s OPENROUTER_API_KEY && export OPENROUTER_API_KEY
 *   node extension/scripts/modellmessung.ts
 * Ergebnis: docs/tests/modellmessung-<Datum>.md
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_SYSTEM_PROMPT } from "../../shared/src/lib/prompts.ts";

const KANDIDATEN = [
  "openai/gpt-5.6-luna", // bisheriger Standard, Vergleichswert
  "openai/gpt-6-luna",
  "openai/gpt-6-luna-pro",
  "~openai/gpt-luna-latest",
  "google/gemini-3.5-flash-lite",
  "google/gemini-3.8-flash",
  "~google/gemini-flash-latest",
];

const schluessel = process.env.OPENROUTER_API_KEY;
if (!schluessel) {
  console.error("OPENROUTER_API_KEY fehlt (read -s OPENROUTER_API_KEY && export OPENROUTER_API_KEY).");
  process.exit(1);
}

const wurzel = new URL("../../", import.meta.url);
const langerText = ["status.md", "docs/messungen.md", "README.md"]
  .map((f) => readFileSync(new URL(f, wurzel), "utf8"))
  .join("\n\n");

const LAEUFE = [
  { name: "kurz", frage: "Erkläre in zwei Sätzen, was ein Transkript ist." },
  {
    name: "lang",
    frage:
      `Text:\n${langerText}\n\nFrage: Welche drei Modelle wurden am 05.09.2026 aus der ` +
      "Modellempfehlung gestrichen, und mit welcher Begründung jeweils? Kurz, eine Zeile je Modell.",
  },
];

interface Ergebnis {
  status: number;
  ersterToken?: number;
  gesamt: number;
  kosten?: number;
  eingabe?: number;
  ausgabe?: number;
  echtesModell?: string;
  text: string;
  fehler?: string;
}

async function lauf(model: string, frage: string): Promise<Ergebnis> {
  const start = performance.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${schluessel}`,
      "HTTP-Referer": "https://github.com/mandrael/chrome-youtube-summary-chat",
      "X-Title": "YouTube Summary Chat",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: DEFAULT_SYSTEM_PROMPT },
        { role: "user", content: frage },
      ],
      stream: true,
      usage: { include: true },
      reasoning: { effort: "minimal" },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const e: Ergebnis = { status: res.status, gesamt: 0, text: "" };
  if (!res.ok || !res.body) {
    e.fehler = (await res.text()).slice(0, 300);
    e.gesamt = performance.now() - start;
    return e;
  }
  let puffer = "";
  for await (const stueck of res.body.pipeThrough(new TextDecoderStream())) {
    puffer += stueck;
    let nl: number;
    while ((nl = puffer.indexOf("\n")) !== -1) {
      const zeile = puffer.slice(0, nl).trim();
      puffer = puffer.slice(nl + 1);
      if (!zeile.startsWith("data:") || zeile === "data: [DONE]") continue;
      try {
        const c = JSON.parse(zeile.slice(5));
        if (c.error?.message) e.fehler = c.error.message;
        if (c.model) e.echtesModell = c.model;
        const d = c.choices?.[0]?.delta?.content;
        if (d) {
          e.ersterToken ??= performance.now() - start;
          e.text += d;
        }
        if (c.usage) {
          e.kosten = c.usage.cost;
          e.eingabe = c.usage.prompt_tokens;
          e.ausgabe = c.usage.completion_tokens;
        }
      } catch {
        // unvollständige Zeile, nächste Runde
      }
    }
  }
  e.gesamt = performance.now() - start;
  return e;
}

const s = (ms?: number) => (ms == null ? "–" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`);
const usd = (x?: number) => (x == null ? "–" : `${x.toFixed(4).replace(".", ",")} $`);

const zeilen: string[] = [];
const antworten: string[] = [];
for (const model of KANDIDATEN) {
  const r: Record<string, Ergebnis> = {};
  for (const l of LAEUFE) {
    process.stdout.write(`${model} ${l.name} … `);
    try {
      r[l.name] = await lauf(model, l.frage);
    } catch (err) {
      r[l.name] = { status: 0, gesamt: 0, text: "", fehler: String(err) };
    }
    console.log(r[l.name].fehler ? `Fehler ${r[l.name].status}` : s(r[l.name].ersterToken));
  }
  const k = r.kurz!, g = r.lang!;
  zeilen.push(
    `| ${model} | ${g.echtesModell ?? k.echtesModell ?? "–"} | ${s(k.ersterToken)} | ${s(g.ersterToken)} | ` +
      `${s(g.gesamt)} | ${usd(g.kosten)} | ${g.eingabe ?? "–"} / ${g.ausgabe ?? "–"} |`,
  );
  antworten.push(
    `### ${model}\n\n` +
      (g.fehler ? `Fehler (HTTP ${g.status}): ${g.fehler}\n` : `${g.text.trim()}\n`) +
      (k.fehler ? `\nKurzlauf-Fehler (HTTP ${k.status}): ${k.fehler}\n` : ""),
  );
}

const datum = new Date().toLocaleDateString("sv"); // JJJJ-MM-TT in Ortszeit
const bericht =
  `# Modellmessung ${datum}\n\n` +
  `Anfragekörper wie \`streamChat\`, reasoning minimal, System-Prompt der Erweiterung. ` +
  `Langer Lauf: status.md, docs/messungen.md und README.md (${langerText.length} Zeichen) ` +
  `mit einer Frage, deren Antwort in docs/messungen.md steht: gestrichen wurden ` +
  `qwen3.7-plus (21 s), glm-4.7-flash (32 s) und qwen3.8-flash (teurer und langsamer).\n\n` +
  `| Modell | antwortet als | 1. Token kurz | 1. Token lang | gesamt lang | Kosten lang | Token ein/aus |\n` +
  `|---|---|---|---|---|---|---|\n${zeilen.join("\n")}\n\n## Antworten im langen Lauf\n\n${antworten.join("\n")}`;
const ziel = new URL(`docs/tests/modellmessung-${datum}.md`, wurzel);
writeFileSync(ziel, bericht);
console.log(`\nGeschrieben: docs/tests/modellmessung-${datum}.md`);
