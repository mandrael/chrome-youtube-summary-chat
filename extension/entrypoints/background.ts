import { defineBackground } from "wxt/utils/define-background";
import { listModels, listSttModels, streamChat, testKey } from "@/lib/openrouter";
import { collapsedItem, getSettings, wideItem } from "@/lib/storage";
import type { ChatMessage, ReasoningEffort } from "@/lib/types";

/**
 * Alle Cloud-Aufrufe laufen hier. Kein eigenes Backend, kein Proxy – der Service Worker
 * spricht direkt mit openrouter.ai, sonst mit nichts.
 */

interface ChatPortRequest {
  type: "start";
  model: string;
  supportsReasoning: boolean;
  reasoning: ReasoningEffort;
  system: string;
  messages: ChatMessage[];
  web?: boolean;
}

export default defineBackground(() => {
  // Ohne diesen Listener und ohne `default_popup` täte ein Klick aufs Symbol schlicht
  // nichts. Auf einer Videoseite klappt er die Sidebar auf oder zu, sonst öffnet er die
  // Einstellungen – ein Content-Script darf `openOptionsPage` nicht selbst aufrufen.
  chrome.action.onClicked.addListener((tab) => {
    void (async () => {
      if (tab.url && /youtube\.com\/watch/.test(tab.url)) {
        const zu = await collapsedItem.getValue();
        // Über das Symbol kommt die Sidebar in YouTubes eigener Spaltenbreite; wer sie
        // breiter will, klappt in der Seite auf oder zieht am Griff.
        if (zu) await wideItem.setValue(false);
        await collapsedItem.setValue(!zu);
      } else {
        await chrome.runtime.openOptionsPage();
      }
    })();
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "chat") return handleChatPort(port);
    if (port.name === "fallback" && __FALLBACK__) return handleFallbackPort(port);
    if (port.name === "download" && __FALLBACK__) return handleDownloadPort(port);
  });

  // Einmalige Anfragen aus der Options-Page und der Sidebar.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    void (async () => {
      try {
        switch (msg?.type) {
          case "listModels":
            sendResponse({ ok: true, data: await listModels() });
            break;
          case "listSttModels":
            // Gehoert zum Audio-Fallback: im Store-Build gar nicht erst vorhanden.
            if (!__FALLBACK__) {
              sendResponse({ ok: false, error: "In diesem Build nicht enthalten." });
              break;
            }
            sendResponse({ ok: true, data: await listSttModels() });
            break;
          case "testKey": {
            const { apiKey } = await getSettings();
            sendResponse({ ok: true, data: await testKey(msg.apiKey ?? apiKey) });
            break;
          }
          case "openOptions":
            // Content-Scripts dürfen openOptionsPage nicht selbst aufrufen.
            await chrome.runtime.openOptionsPage();
            sendResponse({ ok: true });
            break;
          case "hostStatus": {
            if (!__FALLBACK__) {
              sendResponse({ ok: false, error: "In diesem Build nicht enthalten." });
              break;
            }
            const { pingHost } = await import("@/lib/fallback");
            sendResponse({ ok: true, data: await pingHost() });
            break;
          }
          case "videoFormats": {
            if (!__FALLBACK__) {
              sendResponse({ ok: false, error: "In diesem Build nicht enthalten." });
              break;
            }
            const { videoFormate } = await import("@/lib/fallback");
            sendResponse({ ok: true, data: await videoFormate(String(msg.videoId)) });
            break;
          }
          default:
            sendResponse({ ok: false, error: `Unbekannte Anfrage: ${msg?.type}` });
        }
      } catch (e) {
        sendResponse({ ok: false, error: String((e as Error)?.message ?? e) });
      }
    })();
    return true; // asynchrone Antwort
  });
});

function handleChatPort(port: chrome.runtime.Port) {
  const controller = new AbortController();
  // Trennt der Nutzer den Port (Abbrechen-Knopf, Videowechsel, Tab zu), stirbt der
  // laufende Request mit – sonst zahlt er für eine Antwort, die niemand mehr liest.
  port.onDisconnect.addListener(() => controller.abort());

  port.onMessage.addListener((raw: unknown) => {
    const req = raw as ChatPortRequest;
    if (req.type !== "start") return;

    void (async () => {
      try {
        const { apiKey } = await getSettings();
        if (!apiKey) throw new Error("NO_KEY");

        await streamChat({
          apiKey,
          model: req.model,
          reasoning: req.reasoning,
          supportsReasoning: req.supportsReasoning,
          system: req.system,
          messages: req.messages,
          web: req.web,
          signal: controller.signal,
          onDelta: (text) => port.postMessage({ type: "delta", text }),
          onUsage: (usage) => port.postMessage({ type: "usage", usage }),
          onSources: (quellen) => port.postMessage({ type: "sources", quellen }),
        });
        port.postMessage({ type: "done" });
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // vom Nutzer beendet
        port.postMessage({
          type: "error",
          message: String((e as Error)?.message ?? e),
        });
      } finally {
        try {
          port.disconnect();
        } catch {
          /* Port war schon zu */
        }
      }
    })();
  });
}

/** Videodownload, nur im Build "full" – siehe §4a in CLAUDE.md. Startet nur auf Klick. */
function handleDownloadPort(port: chrome.runtime.Port) {
  let cancel: (() => void) | null = null;
  let abgebrochen = false;
  port.onDisconnect.addListener(() => {
    abgebrochen = true;
    cancel?.();
  });

  port.onMessage.addListener((raw: unknown) => {
    const req = raw as { type: string; videoId: string; height: number };
    if (req.type !== "start") return;

    void (async () => {
      try {
        const { videoLaden } = await import("@/lib/fallback");
        const { downloadTarget } = await getSettings();
        // Trennung während der beiden awaits: dann darf der Host gar nicht erst starten.
        if (abgebrochen) return;
        const job = videoLaden(req.videoId, req.height, downloadTarget, (p) =>
          port.postMessage({ type: "progress", ...p }),
        );
        cancel = job.cancel;
        port.postMessage({ type: "downloaded", path: await job.promise });
      } catch (e) {
        port.postMessage({ type: "error", message: String((e as Error)?.message ?? e) });
      } finally {
        try {
          port.disconnect();
        } catch {
          /* Port war schon zu */
        }
      }
    })();
  });
}

/** Nur im Build "full" erreichbar – siehe __FALLBACK__ in wxt.config.ts. */
function handleFallbackPort(port: chrome.runtime.Port) {
  let cancel: (() => void) | null = null;
  port.onDisconnect.addListener(() => cancel?.());

  port.onMessage.addListener((raw: unknown) => {
    const req = raw as { type: string; videoId: string; job?: "subtitles" | "audio" };
    if (req.type !== "start") return;

    void (async () => {
      try {
        const { runFallback } = await import("@/lib/fallback");
        const settings = await getSettings();

        const job = runFallback(
          {
            videoId: req.videoId,
            // Untertitel per yt-dlp brauchen weder Schluessel noch STT-Modell.
            route: req.job === "subtitles" ? "subtitles" : settings.sttRoute,
            apiKey:
              req.job !== "subtitles" && settings.sttRoute.startsWith("openrouter")
                ? settings.apiKey
                : undefined,
            language: settings.captionLang === "auto" ? undefined : settings.captionLang,
          },
          (p) => port.postMessage({ type: "progress", ...p }),
        );
        cancel = job.cancel;

        port.postMessage({ type: "result", transcript: await job.promise });
      } catch (e) {
        port.postMessage({
          type: "error",
          message: String((e as Error)?.message ?? e),
        });
      } finally {
        try {
          port.disconnect();
        } catch {
          /* Port war schon zu */
        }
      }
    })();
  });
}
