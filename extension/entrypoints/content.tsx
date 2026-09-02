import { defineContentScript } from "wxt/utils/define-content-script";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import ReactDOM from "react-dom/client";
import { Sidebar } from "@/components/Sidebar";
import { loadTrack, loadTranscript, NoCaptionsError, videoIdFromUrl } from "@/lib/transcript";
import { getSettings, settingsItem } from "@/lib/storage";
import "@/assets/tailwind.css";

/**
 * Die Sidebar in YouTubes rechter Spalte – die einzige Oberfläche.
 *
 * Es gab zwischenzeitlich zusätzlich eine Variante in Chromes Seitenleiste. Sie ist
 * wieder entfernt: **Vivaldi trägt jede Extension, die die `sidePanel`-Permission
 * deklariert, ungefragt in seine Panel-Leiste ein** und öffnet dort beim Installieren
 * ein leeres Panel (Vivaldi-Bug VB-123452, in 8.1 offen). Das lässt sich nicht aus der
 * Extension heraus verhindern – nur dadurch, dass die Permission fehlt.
 *
 * Zwei Nachteile der Einbettung sind damit bewusst in Kauf genommen und im Code
 * abgefangen: die Spalte gibt nur rund 400 px her (Skalierung über die Einstellung
 * „Schriftgrösse"), und YouTubes globale Tastaturkürzel erreichen den Chat – siehe
 * `schuetzeTastatur`.
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
    const melden = () => void sync();
    ctx.addEventListener(window, "wxt:locationchange", melden);
    ctx.addEventListener(window, "yt-navigate-finish" as any, melden);

    void breiteAnwenden(ctx);
    schuetzeTastatur(ctx);
  },
});

/**
 * Gibt der rechten Spalte mehr Platz, indem der Player gedeckelt wird.
 *
 * Beide Variablen sind nötig, gemessen am 02.09.2026: `--ytd-watch-flexy-sidebar-width`
 * rechnet YouTube beim Laden einmal aus (im Test 489 px) und fasst sie danach nicht mehr
 * an – wer nur den Player deckelt, bekommt eine Lücke statt einer breiteren Spalte.
 * Umgekehrt genügt die Spaltenbreite allein nicht, weil der Player seine Grösse aus
 * `--ytd-watch-flexy-max-player-width` zieht.
 *
 * `min(…, 46vw)` statt eines festen Werts: bei schmalem Fenster bliebe sonst kein Video
 * übrig. Das Theater-Layout ist ausgenommen, dort liegt die Spalte ohnehin unter dem
 * Player.
 */
async function breiteAnwenden(ctx: ContentScriptContext): Promise<void> {
  const style = document.createElement("style");
  style.id = "yt-summary-chat-breite";
  const setzen = (px: number) => {
    style.textContent = `ytd-watch-flexy:not([theater]):not([fullscreen]) {
      --ytd-watch-flexy-sidebar-width: min(${px}px, 46vw) !important;
      --ytd-watch-flexy-max-player-width: calc(100vw - min(${px}px, 46vw) - 96px) !important;
    }`;
    // YouTube berechnet die Player-Grösse in JavaScript und nur auf Anlass hin.
    window.dispatchEvent(new Event("resize"));
  };
  setzen((await getSettings()).columnWidth);
  document.head.appendChild(style);
  const stop = settingsItem.watch((s) => setzen(s?.columnWidth ?? 620));
  ctx.onInvalidated(() => {
    stop();
    style.remove();
  });
}

/**
 * Hält YouTubes Tastaturkürzel aus dem Chat heraus.
 *
 * Das Problem steckt im Shadow DOM: für einen Listener ausserhalb ist `event.target`
 * nicht das `<textarea>`, sondern der Host `<yt-summary-chat>` – das Event wird beim
 * Verlassen des Shadow-Baums umgeschrieben. YouTubes Prüfung „tippt der Nutzer gerade in
 * ein Feld?" schlägt deshalb fehl, und jeder Buchstabe wird als Kürzel ausgeführt: Leer
 * pausiert, „k" pausiert, „m" stummschaltet, Ziffern springen.
 *
 * Abgefangen wird am `window` in der **Capture**-Phase. Das ist die früheste Station der
 * Ereigniskette – früher als jeder Listener am `document`, egal wer zuerst registriert
 * hat. `stopPropagation()` allein genügt: die Taste soll ja im Feld ankommen, nur nicht
 * bei YouTube. Der Preis: auch die eigenen React-Handler sehen das Event nicht mehr,
 * deshalb die Ausnahme für Enter und Escape.
 */
function schuetzeTastatur(ctx: ContentScriptContext): void {
  const ausEingabefeld = (e: Event): boolean => {
    const ziel = e.composedPath()[0] as HTMLElement | undefined;
    if (!ziel || typeof ziel.matches !== "function") return false;
    // Nur Eingaben aus der eigenen Sidebar abschirmen, nicht YouTubes eigene Felder.
    if (!e.composedPath().some((n) => (n as HTMLElement)?.tagName === "YT-SUMMARY-CHAT")) {
      return false;
    }
    return ziel.matches("input, textarea, select, [contenteditable]");
  };

  // Enter und Escape sind ausgenommen. `stopPropagation()` in der Capture-Phase am
  // window hält das Event auch vom Ziel fern – damit feuert kein React-Handler im
  // Shadow DOM mehr, und Enter zum Senden war tot. Beide Tasten sind zugleich keine
  // Video-Kürzel von YouTube (gemessen: keydown-Listener am document prüft Leer, k, m,
  // j, l, f, c, i, t und Ziffern), das Durchlassen kostet also nichts.
  const handler = (e: Event) => {
    const taste = (e as KeyboardEvent).key;
    if (taste === "Enter" || taste === "Escape") return;
    if (ausEingabefeld(e)) e.stopPropagation();
  };

  // Bewusst nativ statt über ctx.addEventListener: der Wrapper reicht das
  // Capture-Flag nicht durch, und ohne Capture am window kommt YouTubes
  // document-Listener zuerst dran. Aufgeräumt wird über ctx.onInvalidated.
  const typen = ["keydown", "keyup", "keypress"] as const;
  for (const typ of typen) window.addEventListener(typ, handler, true);
  ctx.onInvalidated(() => {
    for (const typ of typen) window.removeEventListener(typ, handler, true);
  });
}

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
