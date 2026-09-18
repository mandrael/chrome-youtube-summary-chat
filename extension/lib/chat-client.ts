import type { HelperJob, StreamArgs, StreamHandle, Transcript, DownloadErgebnis } from "@shared/lib/types";
import type { FallbackProgress } from "./fallback";

export type { StreamArgs, StreamHandle };

/**
 * Content-Script-Seite der Port-Verbindung zum Service Worker. Streaming geht nicht über
 * sendMessage, deshalb ein Port; abgebrochen wird durch Trennen des Ports.
 */

export function startChat(args: StreamArgs): StreamHandle {
  const port = chrome.runtime.connect({ name: "chat" });
  let finished = false;
  let beenden: () => void = () => {};

  const done = new Promise<void>((resolve, reject) => {
    beenden = resolve;
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
    // Trennt der Service Worker die Verbindung, ohne "done" gesendet zu haben, ist das
    // ein Fehler und wird als solcher gezeigt – vorher galt der Lauf still als beendet,
    // und eine leere Antwort stand kommentarlos im Chat. Schon empfangener Text bleibt
    // stehen, die Sidebar hängt nur die Fehlermarke an.
    port.onDisconnect.addListener(() => {
      if (!finished) reject(new Error("Verbindung zum Hintergrundprozess verloren."));
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
      if (finished) return;
      finished = true;
      try {
        port.disconnect();
      } catch {
        /* schon getrennt */
      }
      // `onDisconnect` feuert laut Chrome-Doku nur am **anderen** Ende. Wer selbst
      // trennt, bekommt kein Ereignis – ohne diese Zeile hängt `await handle.done`
      // für immer, `setStreaming(false)` läuft nie, und der Knopf bleibt Stopp.
      beenden();
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
  // Nach Update der Erweiterung wirft connect() synchron („Extension context
  // invalidated"); der Wurf muss als Ablehnung ankommen, sonst bleibt der Aufrufer
  // ohne catch dauerhaft auf „läuft" stehen (Codex-Befund 05.09.2026).
  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connect({ name: "fallback" });
  } catch (e) {
    return { promise: Promise.reject(e instanceof Error ? e : new Error(String(e))), cancel: () => {} };
  }
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

/** Videodownload über den Service Worker. Nur im Build "full" aufgerufen. */
export function startDownload(
  videoId: string,
  height: number,
  onProgress: (p: FallbackProgress) => void,
  target?: string,
): { promise: Promise<DownloadErgebnis>; cancel: () => void } {
  // Nach Update der Erweiterung wirft connect() synchron („Extension context
  // invalidated"); der Wurf muss als Ablehnung ankommen, sonst bleibt der Aufrufer
  // ohne catch dauerhaft auf „läuft" stehen (Codex-Befund 05.09.2026).
  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connect({ name: "download" });
  } catch (e) {
    return { promise: Promise.reject(e instanceof Error ? e : new Error(String(e))), cancel: () => {} };
  }
  let settled = false;

  const promise = new Promise<DownloadErgebnis>((resolve, reject) => {
    port.onMessage.addListener((msg: any) => {
      if (msg?.type === "progress") {
        onProgress({ stage: msg.stage, message: msg.message, percent: msg.percent });
      } else if (msg?.type === "downloaded") {
        settled = true;
        resolve({ path: String(msg.path ?? ""), dir: String(msg.dir ?? ""), name: String(msg.name ?? "") });
      } else if (msg?.type === "error") {
        settled = true;
        reject(new Error(msg.message));
      }
    });
    port.onDisconnect.addListener(() => {
      if (!settled) reject(new Error("Verbindung zum Hintergrundprozess verloren."));
    });
  });

  port.postMessage({ type: "start", videoId, height, target });
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
