import { defineContentScript } from "wxt/utils/define-content-script";
import { loadTrack, loadTranscript, NoCaptionsError, videoIdFromUrl } from "@/lib/transcript";

/**
 * Das Content-Script hat keine eigene Oberfläche mehr – die liegt in Chromes
 * Seitenleiste. Hier bleibt nur, was zwingend in der Seite passieren muss:
 *
 *   - die aktuelle Video-ID und den Titel melden,
 *   - jede SPA-Navigation an das Panel weitergeben,
 *   - das Transkript holen (der Player-Aufruf beantwortet nur Anfragen von einer
 *     YouTube-Seite; aus der Seitenleiste kommt HTML statt JSON zurück),
 *   - im Player an eine Stelle springen.
 *
 * Der Umzug in die Seitenleiste löst nebenbei zwei Ärgernisse der eingebetteten
 * Variante: die Breite war an YouTubes rechte Spalte gebunden (rund 400 px), und
 * Tastendrücke im Chat erreichten YouTubes globale Tastaturkürzel – die Leertaste
 * pausierte das Video beim Tippen. Ein eigenes Dokument sieht diese Tasten nicht.
 */
export default defineContentScript({
  matches: ["*://www.youtube.com/*", "*://m.youtube.com/*"],
  runAt: "document_idle",

  main(ctx) {
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
      chrome.runtime.sendMessage({ type: "videoChanged" }).catch(() => {
        /* Panel ist zu – niemand hört zu, das ist kein Fehler */
      });
    };
    ctx.addEventListener(window, "wxt:locationchange", melden);
    ctx.addEventListener(window, "yt-navigate-finish" as any, melden);

    // YouTubes Theme-Wechsel weitergeben, damit die Seitenleiste mitzieht.
    const themeObserver = new MutationObserver(melden);
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
