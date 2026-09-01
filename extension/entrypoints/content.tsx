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
    // Beide Navigationssignale können für dasselbe Video kurz hintereinander feuern.
    // Ohne diesen Zähler startet der zweite Aufruf einen zweiten Mount, während der
    // erste noch auf den Anker wartet – und die Sidebar erscheint doppelt.
    let generation = 0;

    async function sync() {
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
