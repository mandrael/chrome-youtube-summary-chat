import { defineContentScript } from "wxt/utils/define-content-script";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import ReactDOM from "react-dom/client";
import { Sidebar } from "@/components/Sidebar";
import { videoIdFromUrl } from "@/lib/transcript";
import "@/assets/tailwind.css";

/**
 * Hängt die Sidebar als erstes Kind der rechten Spalte ein, also oberhalb der
 * Empfehlungen. Shorts werden bewusst nicht bedient – dort gibt es die Spalte nicht
 * und der Anwendungsfall auch nicht.
 */
export default defineContentScript({
  matches: ["*://www.youtube.com/*", "*://m.youtube.com/*"],
  cssInjectionMode: "ui",
  runAt: "document_idle",

  async main(ctx) {
    let ui: Awaited<ReturnType<typeof mount>> | null = null;
    let mountedVideoId: string | null = null;

    async function sync() {
      const videoId = videoIdFromUrl(location.href);

      // Weg von der Watch-Seite (oder auf Shorts): alles abräumen.
      if (!videoId) {
        ui?.remove();
        ui = null;
        mountedVideoId = null;
        return;
      }
      if (videoId === mountedVideoId && ui) return;

      // Videowechsel: erst der alte Zustand weg, dann neu aufbauen. Ohne das Abräumen
      // liefe der Stream des vorigen Videos in die neue Sidebar weiter.
      ui?.remove();
      ui = null;
      mountedVideoId = videoId;

      const anchor = await waitFor("#secondary-inner", ctx, 10_000);
      if (!anchor) return;
      if (videoIdFromUrl(location.href) !== videoId) return; // inzwischen weitergeklickt

      ui = await mount(ctx, videoId);
      ui.mount();
    }

    void sync();

    // YouTube navigiert ohne Reload. Beide Signale: WXTs Location-Change als Grundlage,
    // YouTubes eigenes Event als schnellere Ergänzung.
    ctx.addEventListener(window, "wxt:locationchange", () => void sync());
    ctx.addEventListener(window, "yt-navigate-finish" as any, () => void sync());
  },
});

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

/** Setzt die Wiedergabeposition des Players auf der Seite. */
function seek(seconds: number): void {
  const video = document.querySelector<HTMLVideoElement>(
    "video.html5-main-video, #movie_player video, video",
  );
  if (!video) return;
  video.currentTime = seconds;
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
