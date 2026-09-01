import { defineContentScript } from "wxt/utils/define-content-script";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import ReactDOM from "react-dom/client";
import { Sidebar } from "@/components/Sidebar";
import { loadTrack, loadTranscript, NoCaptionsError, videoIdFromUrl } from "@/lib/transcript";
import { getSettings } from "@/lib/storage";
import "@/assets/tailwind.css";

/**
 * Zwei Aufgaben in einem Script:
 *
 *  1. **Die Sidebar in YouTubes rechter Spalte** – die ursprüngliche Oberfläche. Sie
 *     erscheint, solange die Einstellung „Wo erscheint die Oberfläche" nicht auf
 *     „nur Seitenleiste" steht.
 *  2. **Datenlieferant für die Seitenleiste** – die läuft ausserhalb der Seite. Derselbe
 *     Player-Aufruf gibt von einer Extension-Seite aus HTML statt JSON zurück, deshalb
 *     holt das Content-Script das Transkript und reicht es weiter.
 *
 * Zwei bekannte Nachteile der eingebetteten Variante, die in der Seitenleiste entfallen:
 * die Spalte gibt nur rund 400 px her, und YouTubes globale Tastaturkürzel erreichen den
 * Chat – die Leertaste pausiert beim Tippen das Video.
 */
export default defineContentScript({
  matches: ["*://www.youtube.com/*", "*://m.youtube.com/*"],
  cssInjectionMode: "ui",
  runAt: "document_idle",

  async main(ctx) {
    let ui: Awaited<ReturnType<typeof mount>> | null = null;
    let mountedVideoId: string | null = null;
    // Beide Navigationssignale können für dasselbe Video kurz hintereinander feuern.
    // Ohne diesen Zähler startet der zweite Aufruf einen zweiten Mount, während der
    // erste noch auf den Anker wartet – und die Sidebar erscheint doppelt.
    let generation = 0;

    async function sync() {
      // Steht die Oberfläche auf „nur Seitenleiste", wird hier nichts eingehängt.
      const platzierung = (await getSettings()).uiPlacement;
      if (platzierung === "panel") {
        ui?.remove();
        ui = null;
        mountedVideoId = null;
        return;
      }

      const videoId = videoIdFromUrl(location.href);
      if (videoId && videoId === mountedVideoId && ui) return;

      const gen = ++generation;
      ui?.remove();
      ui = null;
      mountedVideoId = videoId;

      // Weg von der Watch-Seite (oder auf Shorts): abgeräumt ist schon, fertig.
      if (!videoId) return;

      const anchor = await waitFor("#secondary-inner", ctx, 10_000);
      if (!anchor || gen !== generation) return;
      if (videoIdFromUrl(location.href) !== videoId) return; // inzwischen weitergeklickt

      // Reste eines toten Content-Scripts (etwa nach einem Extension-Reload) räumt
      // dessen eigenes onRemove nicht mehr weg.
      for (const alt of anchor.querySelectorAll("yt-summary-chat")) alt.remove();

      const next = await mount(ctx, videoId);
      if (gen !== generation) {
        next.remove();
        return;
      }
      ui = next;
      ui.mount();
    }

    void sync();

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      switch (msg?.type) {
        case "video":
          sendResponse({ videoId: videoIdFromUrl(location.href), title: currentTitle() });
          return true;
        case "theme":
          sendResponse(document.documentElement.hasAttribute("dark"));
          return true;
        case "seek":
          seek(msg.sekunden);
          sendResponse(true);
          return true;
        case "loadTranscript":
          void holen(() => loadTranscript(videoIdFromUrl(location.href) ?? "", msg.captionLang))
            .then(sendResponse);
          return true;
        case "loadTrack":
          void holen(async () => {
            // Panel-Spuren kennen keine URL – sie werden im DOM umgeschaltet.
            const { isPanelTrack, switchPanelTrack } = await import("@/lib/transcript-panel");
            const r = isPanelTrack(msg.track)
              ? await switchPanelTrack(msg.track)
              : await loadTrack(msg.track);
            if (!r) throw new Error("Die Spur liess sich nicht laden.");
            return { transcript: r.transcript, tracks: [], active: r.active };
          }).then(sendResponse);
          return true;
      }
      return false;
    });


    // YouTube navigiert ohne Reload. Beide Signale: WXTs Location-Change als Grundlage,
    // YouTubes eigenes Event als schnellere Ergänzung.
    const melden = () => {
      void sync();
      chrome.runtime.sendMessage({ type: "videoChanged" }).catch(() => {
        /* Seitenleiste ist zu – niemand hört zu, das ist kein Fehler */
      });
    };
    ctx.addEventListener(window, "wxt:locationchange", melden);
    ctx.addEventListener(window, "yt-navigate-finish" as any, melden);

    // Umschalten der Platzierung soll sofort wirken, nicht erst beim nächsten Video.
    chrome.storage.local.onChanged.addListener(() => void sync());

    // YouTubes Theme-Wechsel an die Seitenleiste weitergeben.
    const themeObserver = new MutationObserver(() => {
      chrome.runtime.sendMessage({ type: "videoChanged" }).catch(() => {});
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dark"],
    });
    ctx.onInvalidated(() => themeObserver.disconnect());
  },
});

/** Vereinheitlicht Erfolg und Fehler, damit beides über den Message-Kanal passt. */
async function holen(
  fn: () => Promise<{ transcript: unknown; tracks?: unknown; active?: unknown }>,
): Promise<Record<string, unknown>> {
  try {
    const r = await fn();
    return { ok: true, transcript: r.transcript, tracks: r.tracks ?? [], active: r.active };
  } catch (e) {
    if (e instanceof NoCaptionsError) return { ok: false, noCaptions: true };
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

async function mount(ctx: ContentScriptContext, videoId: string) {
  return createShadowRootUi(ctx, {
    name: "yt-summary-chat",
    position: "inline",
    anchor: "#secondary-inner",
    append: "first",

    onMount(container, shadow) {
      // YouTubes Dark-Mode hängt am Attribut `dark` des <html>-Elements, nicht an
      // prefers-color-scheme. Der Zustand wird in den Shadow-Root gespiegelt.
      const applyTheme = () => {
        container.classList.toggle(
          "dark",
          document.documentElement.hasAttribute("dark"),
        );
      };
      applyTheme();
      const themeObserver = new MutationObserver(applyTheme);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["dark"],
      });

      const host = (shadow.host as HTMLElement) ?? null;
      if (host) host.style.display = "block";

      const root = ReactDOM.createRoot(container);
      root.render(
        <Sidebar
          videoId={videoId}
          videoTitle={currentTitle()}
          onSeek={seek}
        />,
      );
      return { root, themeObserver };
    },

    onRemove(mounted) {
      mounted?.themeObserver.disconnect();
      mounted?.root.unmount();
    },
  });
}

function currentTitle(): string {
  const el =
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ??
    document.querySelector("h1.ytd-watch-metadata");
  return el?.textContent?.trim() ?? document.title.replace(/ - YouTube$/, "");
}

/**
 * Setzt die Wiedergabeposition des Players auf der Seite.
 *
 * Während einer Werbeeinblendung zeigt dasselbe `<video>`-Element die Werbung: real
 * gemessen ein `duration` von 19 Sekunden bei einem 18:29 langen Video. Ein Sprung auf
 * 05:48 wird dann stumm auf das Werbeende gekappt und der Klick verpufft. Deshalb wird
 * geprüft, ob der Sprung angekommen ist – und andernfalls vorgemerkt und nachgeholt,
 * sobald das Hauptvideo geladen ist.
 */
let pendingSeek: number | null = null;

function currentVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>(
    "video.html5-main-video, #movie_player video, video",
  );
}

function applyPendingSeek(): void {
  if (pendingSeek === null) return;
  const video = currentVideo();
  if (!video || document.getElementById("movie_player")?.classList.contains("ad-showing")) {
    return;
  }
  const wanted = pendingSeek;
  video.currentTime = wanted;
  if (Math.abs(video.currentTime - wanted) <= 2) {
    pendingSeek = null;
    video.removeEventListener("durationchange", applyPendingSeek);
    video.removeEventListener("loadedmetadata", applyPendingSeek);
  }
}

function seek(seconds: number): void {
  const video = currentVideo();
  if (!video) return;

  video.currentTime = seconds;

  if (Math.abs(video.currentTime - seconds) > 2) {
    // Nicht angekommen – vormerken und nachholen, sobald der Player umschaltet.
    pendingSeek = seconds;
    video.addEventListener("durationchange", applyPendingSeek);
    video.addEventListener("loadedmetadata", applyPendingSeek);
    return;
  }

  pendingSeek = null;
  void video.play().catch(() => {
    /* Autoplay-Sperre: die Position stimmt trotzdem */
  });
}

/**
 * Wartet auf ein Element. YouTube baut die rechte Spalte erst nach dem ersten Rendern
 * auf, ein einmaliges querySelector beim Start greift deshalb regelmässig ins Leere.
 */
function waitFor(
  selector: string,
  ctx: ContentScriptContext,
  timeoutMs: number,
): Promise<Element | null> {
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (!el) return;
      cleanup();
      resolve(el);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    // Verlässt der Nutzer die Seite, bevor das Element auftaucht, endet auch das Warten.
    const onInvalidated = () => {
      cleanup();
      resolve(null);
    };
    ctx.onInvalidated(onInvalidated);

    function cleanup() {
      observer.disconnect();
      clearTimeout(timer);
    }
  });
}
