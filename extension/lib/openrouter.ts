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
  return /^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(slug.trim());
}

const MIN_CONTEXT = 128_000;
export const ONE_M_CONTEXT = 1_000_000;

/**
 * Rückfallliste, wenn /models nicht erreichbar ist. Ohne Preise – geraten wird hier
 * nichts, lieber eine Lücke in der Anzeige als eine falsche Zahl.
 */
export const FALLBACK_MODELS: ModelInfo[] = [
  {
    id: "google/gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    contextLength: 1_048_576,
    supportsReasoning: true,
  },
  {
    id: "google/gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    contextLength: 1_048_576,
    supportsReasoning: true,
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    contextLength: 200_000,
    supportsReasoning: true,
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 mini",
    contextLength: 400_000,
    supportsReasoning: true,
  },
];

interface RawModel {
  id: string;
  name: string;
  context_length: number;
  architecture?: { output_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
}

export async function listModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE}/models`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = (await res.json()) as { data: RawModel[] };

  return data
    .filter((m) => (m.context_length ?? 0) >= MIN_CONTEXT)
    .filter((m) => m.architecture?.output_modalities?.includes("text"))
    .map(
      (m): ModelInfo => ({
        id: m.id,
        name: m.name,
        contextLength: m.context_length,
        pricePrompt: num(m.pricing?.prompt),
        priceCompletion: num(m.pricing?.completion),
        supportsReasoning: !!m.supported_parameters?.includes("reasoning"),
      }),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
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
  onDelta: (text: string) => void;
  onUsage: (usage: Usage) => void;
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
          choices?: Array<{ delta?: { content?: string } }>;
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
