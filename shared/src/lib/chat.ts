import { streamChat as streamOpenRouter } from "./openrouter.ts";
import * as mistral from "./mistral.ts";
import type { ChatMessage, ReasoningEffort, Settings, Usage } from "./types";

/**
 * Die eine Stelle, an der sich entscheidet, welche der beiden Gegenstellen antwortet.
 *
 * Regel 1 aus CLAUDE.md verlangt genau das: **ein** Schalter (`settings.provider`), zwei
 * Clients, keine generische Provider-Abstraktion. Bis 0.9.1 stand diese Verzweigung im
 * Service Worker der Erweiterung – dort kommt die Android-App nicht hin, und eine zweite
 * Kopie wäre der Anfang des Auseinanderlaufens. Deshalb steht sie hier, und der Service
 * Worker ruft sie nur noch auf.
 *
 * Die App ruft sie noch nicht: `app/src/main.ts` spricht die beiden Clients für die
 * Messungen B1 und B2 absichtlich einzeln an, weil die Messung sie gerade trennen soll.
 * Mit der Oberfläche der App kommt der Aufruf hierher.
 *
 * Kein Fallback zwischen den beiden: fällt der gewählte Anbieter aus, wirft das hier,
 * und die UI sagt es. Was nur OpenRouter kann (Web-Plugin, Reasoning-Regler, Quellen),
 * fehlt bei Mistral sichtbar – `WEB_ONLY_OPENROUTER` statt stiller Umleitung.
 */
export interface ChatAnfrage {
  model: string;
  supportsReasoning: boolean;
  reasoning: ReasoningEffort;
  system: string;
  messages: ChatMessage[];
  /** Internetrecherche über OpenRouters Web-Plugin. Bei Mistral ein Fehler, kein No-op. */
  web?: boolean;
}

export interface ChatRueckmeldung {
  onDelta: (text: string) => void;
  onUsage: (usage: Usage) => void;
  onSources?: (quellen: Array<{ url: string; title?: string }>) => void;
}

export async function chatStream(
  s: Settings,
  req: ChatAnfrage,
  cb: ChatRueckmeldung,
  signal: AbortSignal,
): Promise<void> {
  if (s.provider === "mistral") {
    if (!s.mistralApiKey) throw new Error("NO_KEY");
    if (!s.mistralModel) throw new Error("NO_MODEL");
    // Kein Reasoning-Regler, kein Web-Plugin, kein Provider-Routing: das sind
    // OpenRouter-Parameter, Mistral bekommt sie gar nicht erst zu sehen. Die
    // Oberfläche sperrt den Web-Schalter; käme `web` trotzdem an, wäre ein stiller
    // Fehlschlag schlimmer als ein lauter.
    if (req.web) throw new Error("WEB_ONLY_OPENROUTER");
    const p = mistral.preis(s.mistralModel, s.mistralRegion);
    await mistral.streamChat({
      apiKey: s.mistralApiKey,
      region: s.mistralRegion,
      model: s.mistralModel,
      system: req.system,
      messages: req.messages,
      signal,
      onDelta: cb.onDelta,
      // Mistral liefert nur Token; der Betrag kommt aus der Preistabelle in
      // mistral.ts. Ohne Tabellenpreis bleibt cost leer, die UI zeigt nur Token.
      onUsage: (u) =>
        cb.onUsage(
          p ? { ...u, cost: u.prompt_tokens * p.ein + u.completion_tokens * p.aus } : u,
        ),
    });
    return;
  }

  if (!s.apiKey) throw new Error("NO_KEY");
  await streamOpenRouter({
    apiKey: s.apiKey,
    model: req.model,
    reasoning: req.reasoning,
    supportsReasoning: req.supportsReasoning,
    system: req.system,
    messages: req.messages,
    web: req.web,
    signal,
    onDelta: cb.onDelta,
    onUsage: cb.onUsage,
    onSources: cb.onSources,
  });
}
