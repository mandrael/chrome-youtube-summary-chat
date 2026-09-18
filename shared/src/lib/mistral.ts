import type { ChatMessage, KeyStatus, ModelInfo, Usage } from "./types";

/**
 * Zweite und letzte Gegenstelle neben OpenRouter: Mistral AI direkt, als
 * Datenschutzoption (EU-Anbieter). Kein Fallback zwischen beiden, keine gemeinsame
 * Abstraktion – zwei Clients, ein Schalter in den Einstellungen.
 *
 * Endpunkte verifiziert am 05.09.2026 gegen Mistrals OpenAPI-Spec
 * (github.com/mistralai/platform-docs-public, openapi.yaml: `servers: https://api.mistral.ai`,
 * `GET /v1/models` → `data[].id`, `max_context_length`, `capabilities.completion_chat`,
 * `aliases`, `deprecation`; `POST /v1/chat/completions` mit `stream: true` liefert
 * „data-only server-side events … terminated by a data: [DONE] message“, Chunks mit
 * `choices[].delta.content` (String oder Chunk-Array) und `usage.prompt_tokens` /
 * `completion_tokens`). Ohne gültigen Key antworten beide Endpunkte mit
 * HTTP 401 `{"detail":"Invalid API Key"}` – gemessen per curl.
 */
import type { MistralRegion } from "./types";

/**
 * Regionale Endpunkte laut docs.mistral.ai/deployment/regional-inference (05.09.2026):
 * api.eu.mistral.ai garantiert Inferenz in der EU (ca. 10 % Aufpreis), api.mistral.ai
 * ist der globale Endpunkt. Beide antworten ohne Key mit HTTP 401 – gemessen per curl.
 */
export const MISTRAL_BASIS: Record<MistralRegion, string> = {
  eu: "https://api.eu.mistral.ai/v1",
  global: "https://api.mistral.ai/v1",
};
const basis = (region: MistralRegion) => MISTRAL_BASIS[region] ?? MISTRAL_BASIS.eu;

function headers(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

/** Der Fehlertext im Wortlaut: Mistral legt ihn in `detail` oder `message` ab. */
async function fehlertext(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { detail?: unknown; message?: string };
    if (typeof j.detail === "string") return j.detail;
    if (j.message) return j.message;
  } catch {
    /* kein JSON */
  }
  return text;
}

export interface RawModel {
  id: string;
  name?: string | null;
  created?: number;
  max_context_length?: number;
  capabilities?: { completion_chat?: boolean };
  aliases?: string[];
  deprecation?: string | null;
}

/**
 * Nur Chat-Modelle, je Familie der „-latest"-Name. Preise liefert Mistrals /v1/models
 * nicht; sie kommen aus der Tabelle PREISE unten, sonst bleibt `pricePrompt` leer.
 */
export async function listModels(apiKey: string, region: MistralRegion): Promise<ModelInfo[]> {
  const res = await fetch(`${basis(region)}/models`, { headers: headers(apiKey) });
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${await fehlertext(res)}`);
  const { data } = (await res.json()) as { data: RawModel[] };
  return modelleAusListe(data, region);
}

/**
 * Mistrals API liefert keine Preise; diese Tabelle ist die Preisliste
 * mistral.ai/pricing/api, abgerufen am 06.09.2026, in USD je Token. Zuordnung über die
 * „-latest"-Namen, denn nur für die gilt die Preisliste; datierte Altversionen
 * (mistral-medium-2508, ministral-8b-2410) sind anders bepreist und bekommen bewusst
 * keinen Preis. Der EU-Endpunkt kostet laut derselben Seite 10 % mehr („Regional
 * inference +10 %"). Was hier fehlt (Magistral, Devstral, Pixtral, Nemo …), bleibt
 * ohne Preis – geraten wird nichts.
 */
const PREISE: [muster: RegExp, ein: number, aus: number][] = [
  [/^ministral-3b-latest$/, 0.1, 0.1],
  [/^ministral-8b-latest$/, 0.15, 0.15],
  [/^ministral-14b-latest$/, 0.2, 0.2],
  [/^mistral-medium-latest$/, 1.5, 7.5],
  [/^mistral-small-latest$/, 0.15, 0.6],
  [/^mistral-large-latest$/, 0.5, 1.5],
  [/^codestral-latest$/, 0.3, 0.9],
  [/^zai-glm-5-2$/, 1.4, 4.4],
];
export const PREISSTAND = "06.09.2026";

/** Preis je Token für Ein- und Ausgabe, oder null, wenn die Preisliste die Familie nicht kennt. */
export function preis(id: string, region: MistralRegion): { ein: number; aus: number } | null {
  const zeile = PREISE.find(([muster]) => muster.test(id));
  if (!zeile) return null;
  const faktor = region === "eu" ? 1.1 : 1;
  return { ein: (zeile[1] * faktor) / 1e6, aus: (zeile[2] * faktor) / 1e6 };
}

/**
 * Rein, damit der Selbsttest sie mit einer echten Antwortform füttern kann. Aliase
 * wie „mistral-small-latest" stehen als eigener Eintrag in der Liste und nennen im
 * `aliases`-Feld ihr Grundmodell, das Grundmodell nennt sie zurück. Wer alles
 * streicht, was irgendwo als Alias steht, streicht deshalb alles – so kam am
 * 05.09.2026 eine leere Liste zustande. Die Spec garantiert keine Symmetrie
 * (Codex-Befund), darum keine Gruppenbildung, sondern eine Regel je Eintrag:
 * Ein „-latest"-Name bleibt immer. Ein anderer Name fliegt, wenn ein Partner (als
 * sein Alias oder ihn nennend) auf „-latest" endet – oder wenn er selbst keine
 * Versionsnummer trägt („codestral") und überhaupt einen Partner hat. Übrig bleibt
 * je Familie der bewegliche Name, den Mistral selbst empfiehlt und an dem die
 * Preisliste hängt (Codex, 06.09.2026: datierte Altversionen sind anders bepreist,
 * eine Familien-Regex hätte ihnen den heutigen Preis gegeben).
 */
export function modelleAusListe(data: RawModel[], region: MistralRegion = "global"): ModelInfo[] {
  const chat = data.filter((m) => m.capabilities?.completion_chat);
  const latest = (id: string) => id.endsWith("-latest");
  const genanntVon = new Map<string, string[]>();
  for (const m of chat) for (const al of m.aliases ?? []) genanntVon.set(al, [...(genanntVon.get(al) ?? []), m.id]);
  return chat
    .filter((m) => {
      if (latest(m.id)) return true;
      const partner = [...(m.aliases ?? []), ...(genanntVon.get(m.id) ?? [])];
      if (partner.some(latest)) return false;
      return /\d/.test(m.id) || partner.length === 0;
    })
    .map(
      (m): ModelInfo => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.max_context_length ?? 0,
        created: m.created,
        pricePrompt: preis(m.id, region)?.ein,
        priceCompletion: preis(m.id, region)?.aus,
        // Mistral kennt OpenRouters `reasoning.effort` nicht; der Regler bleibt aus.
        supportsReasoning: false,
      }),
    )
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || a.name.localeCompare(b.name));
}

/** Mistral hat keinen /key-Endpunkt; die Modellliste ist die Schlüsselprobe. */
export async function testKey(apiKey: string, region: MistralRegion): Promise<KeyStatus> {
  try {
    const res = await fetch(`${basis(region)}/models`, { headers: headers(apiKey) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} – ${await fehlertext(res)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface MistralChatOptions {
  apiKey: string;
  region: MistralRegion;
  model: string;
  system: string;
  messages: ChatMessage[];
  signal: AbortSignal;
  onDelta: (text: string) => void;
  onUsage: (usage: Usage) => void;
}

export interface MistralChunk {
  choices?: Array<{
    delta?: { content?: string | Array<{ type?: string; text?: string }> | null };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  detail?: unknown;
  message?: string;
}

/** `delta.content` ist String oder Chunk-Array (laut Spec `DeltaMessage`). */
export function deltaText(chunk: MistralChunk): string {
  const c = chunk.choices?.[0]?.delta?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((t) => (t.type === "text" ? (t.text ?? "") : "")).join("");
  return "";
}

/**
 * Verarbeitet vollständige SSE-Ereignisse im Puffer; ein Ereignis endet mit einer
 * Leerzeile, seine `data:`-Zeilen werden laut SSE-Spezifikation mit "\n" verbunden
 * (ein JSON kann über mehrere data-Zeilen gehen). Unvollständige Ereignisse bleiben
 * im Puffer. Gibt den Rest zurück, `null` nach `[DONE]`. Rein, damit der Selbsttest
 * sie mit zerschnittenen Ereignissen füttern kann.
 */
export function verarbeiteSse(
  buffer: string,
  onChunk: (chunk: MistralChunk) => void,
): string | null {
  // \r\n auf \n normieren, damit die Leerzeile als Grenze erkannt wird.
  buffer = buffer.replace(/\r\n/g, "\n");
  let grenze: number;
  while ((grenze = buffer.indexOf("\n\n")) !== -1) {
    const ereignis = buffer.slice(0, grenze);
    buffer = buffer.slice(grenze + 2);
    const daten = ereignis
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""));
    if (!daten.length) continue; // nur Kommentar oder leer
    const payload = daten.join("\n").trim();
    if (payload === "[DONE]") return null;
    let chunk: MistralChunk;
    try {
      chunk = JSON.parse(payload) as MistralChunk;
    } catch {
      continue; // kein JSON: ignorieren, nicht abbrechen
    }
    onChunk(chunk);
  }
  return buffer;
}

/** Streamt eine Antwort; Callback-Form wie `streamChat` in openrouter.ts. */
export async function streamChat(o: MistralChatOptions): Promise<void> {
  const res = await fetch(`${basis(o.region)}/chat/completions`, {
    method: "POST",
    headers: headers(o.apiKey),
    body: JSON.stringify({
      model: o.model,
      messages: [
        { role: "system", content: o.system },
        ...o.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    }),
    signal: o.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Mistral HTTP ${res.status}: ${await fehlertext(res)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer: string | null = "";
  const verarbeite = (chunk: MistralChunk) => {
    if (typeof chunk.detail === "string") throw new Error(chunk.detail);
    if (chunk.message && !chunk.choices) throw new Error(chunk.message);
    const text = deltaText(chunk);
    if (text) o.onDelta(text);
    if (chunk.usage) {
      o.onUsage({
        prompt_tokens: chunk.usage.prompt_tokens ?? 0,
        completion_tokens: chunk.usage.completion_tokens ?? 0,
      });
    }
  };
  while (buffer !== null) {
    const { done, value } = await reader.read();
    if (done) {
      // Decoder leeren und ein letztes Ereignis ohne abschliessende Leerzeile noch
      // verarbeiten – sonst ginge ein letzter Text- oder usage-Chunk verloren.
      verarbeiteSse(buffer + decoder.decode() + "\n\n", verarbeite);
      break;
    }
    buffer = verarbeiteSse(buffer + decoder.decode(value, { stream: true }), verarbeite);
  }
}
