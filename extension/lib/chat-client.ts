import type { ChatMessage, HelperJob, ReasoningEffort, Transcript, Usage } from "./types";
import type { FallbackProgress } from "./fallback";

/**
 * Content-Script-Seite der Port-Verbindung zum Service Worker. Streaming geht nicht über
 * sendMessage, deshalb ein Port; abgebrochen wird durch Trennen des Ports.
 */

export interface StreamHandle {
  /** Bricht die laufende Generierung ab. */
  stop: () => void;
  done: Promise<void>;
}

export interface StreamArgs {
  model: string;
  supportsReasoning: boolean;
  reasoning: ReasoningEffort;
  system: string;
  messages: ChatMessage[];
  /** Internetrecherche über OpenRouters Web-Plugin. */
  web?: boolean;
  onDelta: (text: string) => void;
  onUsage: (usage: Usage) => void;
  onSources?: (quellen: Array<{ url: string; title?: string }>) => void;
}

export function startChat(args: StreamArgs): StreamHandle {
  const port = chrome.runtime.connect({ name: "chat" });
  let finished = false;

  const done = new Promise<void>((resolve, reject) => {
    port.onMessage.addListener((msg: any) => {
      switch (msg?.type) {
        case "delta":
          args.onDelta(msg.text);
          break;
        case "usage":
          args.onUsage(msg.usage);
          break;
        case "sources":
          args.onSources?.(msg.quellen);
          break;
        case "done":
          finished = true;
          resolve();
          break;
        case "error":
          finished = true;
          reject(new Error(msg.message));
          break;
      }
    });
    // Trennt der Service Worker die Verbindung, ohne "done" gesendet zu haben, gilt der
    // Lauf als beendet – ein hängender Promise wäre schlimmer als ein früher Abschluss.
    port.onDisconnect.addListener(() => {
      if (!finished) resolve();
    });
  });

  port.postMessage({
    type: "start",
    model: args.model,
    supportsReasoning: args.supportsReasoning,
    reasoning: args.reasoning,
    system: args.system,
    messages: args.messages,
    web: args.web,
  });

  return {
    stop: () => {
      finished = true;
      try {
        port.disconnect();
      } catch {
        /* schon getrennt */
      }
    },
    done,
  };
}

/** Nur im Build "full" aufgerufen. Siehe __FALLBACK__ in wxt.config.ts. */
export function startFallback(
  videoId: string,
  job: HelperJob,
  onProgress: (p: FallbackProgress) => void,
): { promise: Promise<Transcript>; cancel: () => void } {
  const port = chrome.runtime.connect({ name: "fallback" });
  let settled = false;

  const promise = new Promise<Transcript>((resolve, reject) => {
    port.onMessage.addListener((msg: any) => {
      if (msg?.type === "progress") {
        onProgress({ stage: msg.stage, message: msg.message, percent: msg.percent });
      } else if (msg?.type === "result") {
        settled = true;
        resolve(msg.transcript as Transcript);
      } else if (msg?.type === "error") {
        settled = true;
        reject(new Error(msg.message));
      }
    });
    port.onDisconnect.addListener(() => {
      if (!settled) reject(new Error("Verbindung zum Hintergrundprozess verloren."));
    });
  });

  port.postMessage({ type: "start", videoId, job });
  return { promise, cancel: () => port.disconnect() };
}

export function ask<T>(type: string, extra: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...extra }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (res?.ok) {
        resolve(res.data as T);
      } else {
        reject(new Error(res?.error ?? "Unbekannter Fehler"));
      }
    });
  });
}
