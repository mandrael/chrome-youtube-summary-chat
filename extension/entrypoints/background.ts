import { defineBackground } from "wxt/utils/define-background";
import { listModels, listSttModels, testKey } from "@shared/lib/openrouter";
import * as mistral from "@shared/lib/mistral";
import { chatStream } from "@shared/lib/chat";
import { collapsedItem, getSettings, wideItem } from "@/lib/storage";
import type { ChatMessage, ReasoningEffort, Usage } from "@shared/lib/types";

/**
 * Alle Cloud-Aufrufe laufen hier. Kein eigenes Backend, kein Proxy – der Service Worker
 * spricht direkt mit openrouter.ai oder, wenn so eingestellt, mit api.mistral.ai, sonst
 * mit nichts. Welche der beiden Gegenstellen dran ist, entscheidet `settings.provider`;
 * die Sidebar schickt keinen Anbieter mit, sonst könnten beide auseinanderlaufen.
 *
 * Die Verzweigung selbst steht seit dem Workspace-Umbau in `@shared/lib/chat` – dieselbe
 * eine Stelle, die auch die Android-App aufruft. Hier bleibt nur der Transport: Port,
 * Wachhalter, Abbruch.
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
      if (tab.url && /youtube\.com\/(watch|live\/)/.test(tab.url)) {
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
          case "listMistralModels": {
            // Braucht im Gegensatz zu OpenRouter einen Schlüssel – die Options-Page
            // schickt den eben getippten mit, damit „Modelle laden" ohne Umweg über
            // das Speichern geht.
            const { mistralApiKey, mistralRegion } = await getSettings();
            const key = String(msg.apiKey ?? mistralApiKey);
            if (!key) throw new Error("NO_KEY");
            sendResponse({ ok: true, data: await mistral.listModels(key, (msg.region as typeof mistralRegion) ?? mistralRegion) });
            break;
          }
          case "testMistralKey": {
            const { mistralApiKey, mistralRegion } = await getSettings();
            sendResponse({ ok: true, data: await mistral.testKey(String(msg.apiKey ?? mistralApiKey), (msg.region as typeof mistralRegion) ?? mistralRegion) });
            break;
          }
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
          case "dislikes": {
            // Einzige dritte Gegenstelle, nur im Build "full" (CLAUDE.md §1, 29.09.2026).
            if (!__FALLBACK__) {
              sendResponse({ ok: false, error: "In diesem Build nicht enthalten." });
              break;
            }
            const id = String(msg.videoId);
            if (!/^[\w-]{11}$/.test(id)) throw new Error("Ungültige Video-ID");
            // Nutzungsbedingungen (returnyoutubedislike.com/docs/usage-rights, 29.09.2026):
            // 100 Abrufe je Minute, 10 000 je Tag; auf 429 hin zurückhalten.
            const r = await fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${id}`);
            if (!r.ok) throw new Error(`Return YouTube Dislike: HTTP ${r.status}`);
            const { likes, dislikes } = (await r.json()) as { likes?: number; dislikes?: number };
            if (typeof dislikes !== "number" || typeof likes !== "number") {
              throw new Error("Return YouTube Dislike: keine Zahl");
            }
            sendResponse({ ok: true, data: { likes, dislikes } });
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
          case "chooseFolder": {
            if (!__FALLBACK__) {
              sendResponse({ ok: false, error: "In diesem Build nicht enthalten." });
              break;
            }
            const { ordnerWaehlen } = await import("@/lib/fallback");
            sendResponse({ ok: true, data: await ordnerWaehlen() });
            break;
          }
          case "revealFile": {
            if (!__FALLBACK__) {
              sendResponse({ ok: false, error: "In diesem Build nicht enthalten." });
              break;
            }
            const { videoZeigen } = await import("@/lib/fallback");
            const { downloadTarget } = await getSettings();
            // Bei „vor jedem Download fragen" liegt die Datei im ad hoc gewählten Ordner.
            await videoZeigen(String(msg.videoId), String(msg.path), String(msg.target || downloadTarget));
            sendResponse({ ok: true, data: null });
            break;
          }
          case "updateCheck": {
            if (!__FALLBACK__) {
              sendResponse({ ok: false, error: "In diesem Build nicht enthalten." });
              break;
            }
            const { updatePruefen } = await import("@/lib/fallback");
            sendResponse({ ok: true, data: await updatePruefen(!!msg.jetzt) });
            break;
          }
          case "updateInstall": {
            if (!__FALLBACK__) {
              sendResponse({ ok: false, error: "In diesem Build nicht enthalten." });
              break;
            }
            const { updateInstallieren } = await import("@/lib/fallback");
            const version = await updateInstallieren();
            sendResponse({ ok: true, data: version });
            // Neu laden liest die getauschten Dateien von der Platte; erst nach der
            // Antwort, sonst erfährt die Seite nichts vom Erfolg.
            setTimeout(() => chrome.runtime.reload(), 500);
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
  // Chrome beendet einen MV3-Service-Worker nach 30 s ohne Ereignis; ein laufender
  // fetch zählt nicht, Port-Nachrichten und API-Aufrufe schon. Bis zum ersten Token
  // fliesst aber nichts über den Port – bei langem Transkript und Denkmodell kann das
  // länger als 30 s dauern, dann stirbt der Worker mitten im Stream und die Sidebar
  // meldet „Verbindung zum Hintergrundprozess verloren". Der Aufruf alle 20 s setzt
  // den Zähler zurück (developer.chrome.com, Service-Worker-Lifecycle).
  let wach: ReturnType<typeof setInterval> | undefined;
  let gestartet = false;
  port.onDisconnect.addListener(() => clearInterval(wach));
  // Trennt der Nutzer den Port (Abbrechen-Knopf, Videowechsel, Tab zu), stirbt der
  // laufende Request mit – sonst zahlt er für eine Antwort, die niemand mehr liest.
  port.onDisconnect.addListener(() => controller.abort());

  port.onMessage.addListener((raw: unknown) => {
    const req = raw as ChatPortRequest;
    if (req.type !== "start") return;
    // Ein Port, eine Anfrage: ein zweites "start" würde einen zweiten bezahlten Request
    // starten, dessen Antwort sich mit der ersten auf demselben Port mischt.
    if (gestartet) return;
    gestartet = true;
    wach = setInterval(() => void chrome.runtime.getPlatformInfo(), 20_000);

    void (async () => {
      try {
        const s = await getSettings();
        const onDelta = (text: string) => port.postMessage({ type: "delta", text });
        const onUsage = (usage: Usage) => port.postMessage({ type: "usage", usage });

        await chatStream(
          s,
          {
            model: req.model,
            supportsReasoning: req.supportsReasoning,
            reasoning: req.reasoning,
            system: req.system,
            messages: req.messages,
            web: req.web,
          },
          {
            onDelta,
            onUsage,
            onSources: (quellen) => port.postMessage({ type: "sources", quellen }),
          },
          controller.signal,
        );
        port.postMessage({ type: "done" });
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // vom Nutzer beendet
        port.postMessage({
          type: "error",
          message: String((e as Error)?.message ?? e),
        });
      } finally {
        clearInterval(wach);
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
    const req = raw as { type: string; videoId: string; height: number; target?: string };
    if (req.type !== "start") return;

    void (async () => {
      try {
        const { videoLaden } = await import("@/lib/fallback");
        const { downloadTarget } = await getSettings();
        // Trennung während der beiden awaits: dann darf der Host gar nicht erst starten.
        if (abgebrochen) return;
        // Ein eben im Dialog gewählter Ordner schlägt die Einstellung.
        const job = videoLaden(req.videoId, req.height, req.target || downloadTarget, (p) =>
          port.postMessage({ type: "progress", ...p }),
        );
        cancel = job.cancel;
        port.postMessage({ type: "downloaded", ...(await job.promise) });
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
  let abgebrochen = false;
  port.onDisconnect.addListener(() => {
    abgebrochen = true;
    cancel?.();
  });

  port.onMessage.addListener((raw: unknown) => {
    const req = raw as { type: string; videoId: string; job?: "subtitles" | "audio" };
    if (req.type !== "start") return;

    void (async () => {
      try {
        const { runFallback } = await import("@/lib/fallback");
        const settings = await getSettings();
        // Trennung während der beiden awaits: die bezahlte STT darf gar nicht erst starten.
        if (abgebrochen) return;

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
