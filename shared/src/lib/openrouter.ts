import type {
  ChatMessage,
  KeyStatus,
  ModelInfo,
  ReasoningEffort,
  SttModelInfo,
  Usage,
} from "./types";

const BASE = "https://openrouter.ai/api/v1";

// Einziger Anbieter, ein Endpunkt. Es gibt bewusst keine Adapter-Schicht und keinen
// zweiten Zweig – wer OpenAI oder Anthropic will, nimmt deren Slug bei OpenRouter.
const REFERER = "https://github.com/mandrael/chrome-youtube-summary-chat";
const TITLE = "YouTube Summary Chat";

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": REFERER,
    "X-Title": TITLE,
    "Content-Type": "application/json",
  };
}

/** Ein Modell-Slug ohne Provider-Präfix ist bei OpenRouter nicht auflösbar. */
export function isValidSlug(slug: string): boolean {
  // „~" vorn: OpenRouters mitlaufende Namen wie „~openai/gpt-luna-latest".
  return /^~?[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(slug.trim());
}

const MIN_CONTEXT = 128_000;
export const ONE_M_CONTEXT = 1_000_000;

/**
 * Kuratierte Auswahl, Stand 05.09.2026. Der zweite Wert sind die Marken in der Liste,
 * die Reihenfolge hier ist die Reihenfolge dort.
 *
 * Massstab ist diese Aufgabe, nicht die Bestenliste: ein langes Transkript lesen,
 * Fragen dazu beantworten, nichts erfinden. Denkmodelle wie o1-pro (5,70 $ je Anfrage)
 * oder GPT-5.5 Pro (1,26 $) kosten hier das Hundert- bis Siebenhundertfache der
 * Empfehlung, ohne besser zu antworten – sie stehen deshalb nicht oben, sind über den
 * Filter aber weiter erreichbar.
 *
 * Jeder Eintrag ist am 05.09.2026 mit dem Anfragekörper der Extension gemessen worden
 * (Selbsttest-Skript, Prompt mit rund 65.000 Token, reasoning minimal):
 * „schnell" heisst erstes Token nach höchstens 7 s, „günstig" heisst Eingabe höchstens
 * 0,10 $ je Million Token. Herausgefallen: qwen3.7-plus (21 s bis zum ersten Token),
 * glm-4.7-flash (32 s), qwen3.8-flash (teurer und langsamer als qwen3.7-flash, die
 * alte Marke „günstig" widersprach dem Preis daneben). Gemini 3.7 Flash ist durch
 * 3.8 Flash ersetzt (gleicher Preis, schneller). GLM, Nemotron Nano und Claude Haiku
 * sind Brave Leos Auswahl entlehnt; alle drei antworten hier.
 *
 * Ein Eintrag, den OpenRouter nicht mehr führt, verschwindet von selbst – gerendert
 * wird nur, was auch in der geladenen Liste steht.
 *
 * Seit 30.09.2026 stehen oben OpenRouters mitlaufende Namen („~…-latest“): sie zeigen
 * immer auf das neueste Modell einer Reihe, damit die Auswahl ohne neue Version aktuell
 * bleibt. Preis und Tempo können sich dabei ändern; die Marken gelten für die Fassung
 * zum Messzeitpunkt. Für Flash Lite gibt es keinen solchen Namen, daher fest.
 */
export const EMPFEHLUNG: [id: string, marken: string[]][] = [
  ["~openai/gpt-luna-latest", ["Standard", "schnell"]],
  ["google/gemini-3.5-flash-lite", ["schnell"]],
  ["~google/gemini-flash-latest", ["schnell"]],
  ["z-ai/glm-5.3-flash", ["günstig", "schnell"]],
  ["nvidia/nemotron-3-nano-30b-a3b", ["günstig", "schnell"]],
  ["openai/gpt-5-nano", ["günstig", "schnell"]],
  ["qwen/qwen3.7-flash", ["günstig"]],
  ["deepseek/deepseek-v4-flash", ["günstig"]],
  ["anthropic/claude-haiku-4.5", ["schnell"]],
  ["z-ai/glm-5.3", ["schlau"]],
  ["openai/gpt-5.6-sol", ["schlau"]],
  ["anthropic/claude-sonnet-5", ["schlau"]],
  ["anthropic/claude-opus-5", ["schlau"]],
];

/** Die Empfehlung, soweit die geladene Liste sie führt – in ihrer Reihenfolge. */
export function empfohleneModelle(liste: ModelInfo[]): (readonly [ModelInfo, string[]])[] {
  return EMPFEHLUNG.flatMap(([id, marken]) => {
    const m = liste.find((k) => k.id === id);
    return m ? [[m, marken] as const] : [];
  });
}

/**
 * Was eine Anfrage ungefähr kostet – 30.000 Token Transkript hinein, 2.000 heraus.
 * Das Preispaar je Million verlangt Kopfrechnen, dieser Betrag nicht. Die Eingabe macht
 * über 90 % davon aus; Reasoning-Tokens zählen als Ausgabe und können den Betrag bei
 * hoher Stufe übersteigen.
 */
const ANFRAGE_EIN = 30_000;
const ANFRAGE_AUS = 2_000;

export function preisProAnfrage(m: ModelInfo): number | null {
  if (m.pricePrompt == null) return null;
  return m.pricePrompt * ANFRAGE_EIN + (m.priceCompletion ?? 0) * ANFRAGE_AUS;
}

export function formatPreis(usd: number): string {
  if (usd === 0) return "gratis";
  // Unter einem Cent in Cent, sonst stünde bei 0,0012 $ und 0,0084 $ dasselbe „< 0,01 $"
  // – gerade in der Empfehlung liegen fast alle Werte dort. Zwei Nachkommastellen, weil
  // drei sich als Tausender lesen lassen.
  if (usd < 0.01) return `${(usd * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} ¢`;
  return `${usd.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

/** Lite-Modelle bekommen Reasoning minimal vorbelegt – dort kostet es mehr, als es bringt. */
export function isLiteModel(id: string): boolean {
  return /lite|mini|flash-8b|haiku|small|nano/i.test(id);
}

/**
 * Rückfallliste, wenn /models nicht erreichbar ist. Ohne Preise – geraten wird hier
 * nichts, lieber eine Lücke in der Anzeige als eine falsche Zahl.
 */
// Mitlaufende Namen, damit auch die Rückfallliste nicht veraltet (Stand 30.09.2026).
export const FALLBACK_MODELS: ModelInfo[] = [
  {
    id: "~openai/gpt-luna-latest",
    name: "GPT Luna Latest",
    contextLength: 1_050_000,
    supportsReasoning: true,
  },
  {
    id: "google/gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    contextLength: 1_048_576,
    supportsReasoning: true,
  },
  {
    id: "~google/gemini-flash-latest",
    name: "Gemini Flash Latest",
    contextLength: 1_048_576,
    supportsReasoning: true,
  },
  {
    id: "~anthropic/claude-sonnet-latest",
    name: "Claude Sonnet Latest",
    contextLength: 1_000_000,
    supportsReasoning: true,
  },
];

interface RawModel {
  id: string;
  name: string;
  context_length: number;
  created?: number;
  architecture?: { output_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
}

export async function listModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE}/models`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = (await res.json()) as { data: RawModel[] };

  const passend = data
    .filter((m) => (m.context_length ?? 0) >= MIN_CONTEXT)
    // Ausgabe **nur** Text. „text" allein zu verlangen liess Bildgeneratoren durch
    // (gemini-3.1-flash-image gibt „image, text" aus) und ebenso Sprachmodelle mit
    // Tonausgabe (gpt-audio: „text, audio"). Für einen Transkript-Chat ist beides
    // sinnlos.
    .filter((m) => {
      const aus = m.architecture?.output_modalities ?? [];
      return aus.length === 1 && aus[0] === "text";
    })
    // Moderationsmodelle geben zwar Text aus, aber Sicherheitsurteile statt Antworten.
    // Sie sind nur am Namen zu erkennen.
    .filter((m) => !/guard|safeguard|moderation/i.test(m.id));

  // Dubletten raus, sonst steht dasselbe Modell drei- bis viermal in der Liste.
  // Gemessen am 02.09.2026: 378 passende Einträge, nach dieser Regel 283.
  //
  // Eine Variante fliegt genau dann, wenn ihr Grundmodell ebenfalls in der Liste steht.
  // Bei „:free" ist das nicht bloss Aufräumen: der Preis 0 verschweigt das Tageslimit
  // und die Datennutzung, und mit 30.000 Token je Anfrage ist das Limit schnell
  // erreicht. Wo es kein bezahltes Gegenstück gibt, bleibt die freie Fassung stehen.
  const vorhanden = new Set(passend.map((m) => m.id));
  const sichtbar = passend
    .filter((m) => !m.id.endsWith(":batch")) // Batch läuft asynchron, der Chat streamt
    .filter((m) => {
      const grund = grundmodell(m.id);
      return grund === m.id || !vorhanden.has(grund);
    });

  return sichtbar
    .map(
      (m): ModelInfo => ({
        id: m.id,
        name: m.name,
        contextLength: m.context_length,
        created: m.created,
        pricePrompt: num(m.pricing?.prompt),
        priceCompletion: num(m.pricing?.completion),
        supportsReasoning: !!m.supported_parameters?.includes("reasoning"),
      }),
    )
    // Neueste zuerst: wer ein Modell sucht, sucht fast immer das aktuelle.
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || a.name.localeCompare(b.name));
}

/** Datumsanhängsel wie „-2024-11-20", „-20260420" oder „-2407". */
const DATIERT = /-(\d{4}-\d{2}-\d{2}|\d{8}|\d{4})$/;

/**
 * Der Slug ohne Varianten-Anhängsel. „-instruct" bleibt bewusst stehen: das ist ein
 * eigenes Modell, nicht die Variante eines anderen.
 */
function grundmodell(id: string): string {
  const ohneSuffix = id.split(":")[0]!;
  return ohneSuffix.replace(/-(preview|exp|thinking|latest)$/, "").replace(DATIERT, "");
}

function num(v: string | undefined): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * OpenRouter weist die Preiseinheit für Transkriptionsmodelle nicht aus: derselbe
 * `pricing.prompt` steht mal für Sekunden, mal für Minuten, mal für Stunden. Belegt an
 * whisper-turbo/DeepInfra 0.00000333 (= /s), parakeet-v3/Together 0.0015 (= /min) und
 * whisper-turbo/Groq 0.04 (= /h). Die Grössenordnung ist der einzige verfügbare
 * Anhaltspunkt, deshalb wird der Rohwert in der UI danebengestellt.
 *
 * ponytail: Heuristik statt kuratierter Tabelle. Sobald OpenRouter ein Einheitenfeld
 * liefert, ersetzt eine Zeile diese Funktion.
 */
export function guessPriceUnit(raw: number): "second" | "minute" | "hour" {
  if (raw < 1e-4) return "second";
  if (raw < 1e-2) return "minute";
  return "hour";
}

export function toUsdPerHour(raw: number, unit: ReturnType<typeof guessPriceUnit>): number {
  return unit === "second" ? raw * 3600 : unit === "minute" ? raw * 60 : raw;
}

/** Die STT-Routen dieser Extension. Andere Transkriptionsmodelle werden nicht angeboten. */
export const STT_MODEL_IDS = [
  "openai/whisper-large-v3-turbo",
  "nvidia/parakeet-tdt-0.6b-v3",
] as const;

export async function listSttModels(): Promise<SttModelInfo[]> {
  // STT-Modelle stehen nicht in der Standardliste – der Filter ist Pflicht.
  const res = await fetch(`${BASE}/models?output_modalities=transcription`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = (await res.json()) as { data: RawModel[] };

  const wanted = data.filter((m) => (STT_MODEL_IDS as readonly string[]).includes(m.id));

  return Promise.all(
    wanted.map(async (m): Promise<SttModelInfo> => {
      const raw = num(m.pricing?.prompt) ?? 0;
      const unit = guessPriceUnit(raw);
      const ep = await fetchEndpoints(m.id);
      return {
        id: m.id,
        name: m.name,
        rawPrice: raw,
        unit,
        usdPerHour: toUsdPerHour(raw, unit),
        providers: ep.map((e) => e.provider),
        supportsResponseFormat: ep.some((e) => e.params.includes("response_format")),
      };
    }),
  );
}

async function fetchEndpoints(
  id: string,
): Promise<Array<{ provider: string; params: string[] }>> {
  try {
    const res = await fetch(`${BASE}/models/${id}/endpoints`);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: {
        endpoints?: Array<{ provider_name?: string; supported_parameters?: string[] }>;
      };
    };
    return (json.data?.endpoints ?? []).map((e) => ({
      provider: e.provider_name ?? "?",
      params: e.supported_parameters ?? [],
    }));
  } catch {
    return [];
  }
}

export async function testKey(apiKey: string): Promise<KeyStatus> {
  try {
    const res = await fetch(`${BASE}/key`, { headers: headers(apiKey) });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} – ${await res.text()}` };
    }
    const { data } = (await res.json()) as {
      data: {
        label?: string;
        usage?: number;
        limit?: number | null;
        limit_remaining?: number | null;
        is_free_tier?: boolean;
      };
    };
    return {
      ok: true,
      label: data.label,
      usage: data.usage,
      limit: data.limit ?? null,
      limitRemaining: data.limit_remaining ?? null,
      isFreeTier: data.is_free_tier,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface ChatOptions {
  apiKey: string;
  model: string;
  reasoning: ReasoningEffort;
  supportsReasoning: boolean;
  system: string;
  messages: ChatMessage[];
  signal: AbortSignal;
  /**
   * Schaltet OpenRouters Web-Plugin zu. Es sucht mit dem Inhalt der letzten
   * Nutzernachricht als Suchanfrage und schiebt die Treffer vor die Antwort – deshalb
   * muss der Videotitel in dieser Nachricht stehen, nicht im System-Prompt.
   * Kostet zusätzlich rund 0,007 $ je Anfrage (Exa, fünf Treffer).
   */
  web?: boolean;
  onDelta: (text: string) => void;
  onUsage: (usage: Usage) => void;
  onSources?: (quellen: Array<{ url: string; title?: string }>) => void;
}

/**
 * Streamt eine Antwort. SSE über fetch + ReadableStream – ein Paket dafür wäre mehr
 * Code als das Parsen selbst.
 */
export async function streamChat(o: ChatOptions): Promise<void> {
  const body: Record<string, unknown> = {
    model: o.model,
    messages: [
      { role: "system", content: o.system },
      ...o.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: true,
    usage: { include: true },
  };
  // Nicht unterstützte Parameter lässt OpenRouter zwar fallen, aber ein Modell ohne
  // Reasoning soll den Regler gar nicht erst gesetzt bekommen.
  if (o.supportsReasoning) body.reasoning = { effort: o.reasoning };
  if (o.web) body.plugins = [{ id: "web", max_results: 5 }];

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(o.apiKey),
    body: JSON.stringify(body),
    signal: o.signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`OpenRouter HTTP ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Ereignisse sind durch Leerzeilen getrennt; der Rest bleibt im Puffer.
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);

      if (!line || line.startsWith(":")) continue; // Keep-alive-Kommentar
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;

      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string;
              annotations?: Array<{
                type?: string;
                url_citation?: { url?: string; title?: string };
              }>;
            };
          }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            cost?: number;
          };
          error?: { message?: string };
        };
        if (chunk.error?.message) throw new Error(chunk.error.message);

        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) o.onDelta(delta);

        const quellen = chunk.choices?.[0]?.delta?.annotations;
        if (quellen?.length && o.onSources) {
          o.onSources(
            quellen
              .filter((a) => a.type === "url_citation" && a.url_citation?.url)
              .map((a) => ({ url: a.url_citation!.url!, title: a.url_citation!.title })),
          );
        }

        if (chunk.usage) {
          o.onUsage({
            prompt_tokens: chunk.usage.prompt_tokens ?? 0,
            completion_tokens: chunk.usage.completion_tokens ?? 0,
            cost: chunk.usage.cost,
          });
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue; // unvollständiges JSON, nächste Runde
        throw e;
      }
    }
  }
}
