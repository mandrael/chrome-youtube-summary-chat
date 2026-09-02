import * as React from "react";
import type { Cue } from "./types";

/**
 * Folgt der Wiedergabe im Transkript.
 *
 * Takt ist `timeupdate` am `<video>` (YouTube feuert es rund viermal je Sekunde), nicht
 * ein Intervall und nicht `requestVideoFrameCallback`: 60 Hz für einen Wert, der sich
 * alle paar Sekunden ändert, wäre Verschwendung. Während einer Werbeeinblendung meldet
 * dasselbe Element die Zeit der Werbung – der Tick wird dann übersprungen.
 *
 * Gescrollt wird nur, wenn die aktive Zeile die Ruhezone verlässt (20 bis 60 Prozent der
 * sichtbaren Höhe), und dann auf ein Drittel. So bleibt über und unter der Stelle Text
 * lesbar, und es ruckelt nicht bei jedem Tick.
 *
 * Nutzer-Scrollen schaltet das Folgen ab – erkannt an den Eingaben, die nur ein Mensch
 * erzeugt (Rad, Wischen, Navigationstasten, Griff an der Scrollbar). Das `scroll`-Event
 * taugt nicht dafür: es feuert auch beim eigenen `scrollTo`.
 */

export interface FollowApi {
  /** Index der Cue an der Wiedergabeposition, -1 wenn keine. */
  active: number;
  following: boolean;
  /** Springt zur aktuellen Stelle und schaltet das Folgen ein. */
  jump(): void;
  stop(): void;
  containerProps: {
    ref: React.RefObject<HTMLDivElement | null>;
    tabIndex: number;
    onWheel: () => void;
    onTouchMove: () => void;
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  };
}

const NAVIGATIONSTASTEN = new Set([
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
  " ",
]);

export function useFollow(
  cues: Cue[],
  getVideo: () => HTMLVideoElement | null,
  aktiv: boolean,
  layoutKey: string,
): FollowApi {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [active, setActive] = React.useState(-1);
  const [following, setFollowing] = React.useState(false);

  const starts = React.useMemo(() => cues.map((c) => c.start), [cues]);

  /** Letzte Cue mit start <= t. Binär: 800 Zeilen sind zehn Vergleiche. */
  const indexBei = React.useCallback(
    (t: number): number => {
      let lo = 0;
      let hi = starts.length - 1;
      let r = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (starts[mid]! <= t) {
          r = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return r;
    },
    [starts],
  );

  React.useEffect(() => {
    if (!aktiv) return;
    const video = getVideo();
    if (!video) return;

    const tick = () => {
      if (document.getElementById("movie_player")?.classList.contains("ad-showing")) return;
      const i = indexBei(video.currentTime);
      // Gleicher Wert heisst kein Render: der Tick kostet nichts, nur der Cue-Wechsel.
      setActive((prev) => (prev === i ? prev : i));
    };
    tick();
    video.addEventListener("timeupdate", tick);
    video.addEventListener("seeked", tick);
    return () => {
      video.removeEventListener("timeupdate", tick);
      video.removeEventListener("seeked", tick);
    };
  }, [aktiv, getVideo, indexBei]);

  const zeige = React.useCallback((i: number, erzwingen: boolean) => {
    const box = containerRef.current;
    if (!box || i < 0) return;
    // Bei aktiver Suche fehlt die Zeile oft im DOM – dann bleibt alles, wie es ist.
    const row = box.querySelector<HTMLElement>(`[data-cue="${i}"]`);
    if (!row) return;

    // `offsetTop` statt `getBoundingClientRect`: unter `zoom` sind Rect-Werte skaliert,
    // `scrollTop` und `clientHeight` nicht. Die Mischung läge um zehn Prozent daneben.
    const h = box.clientHeight;
    const rel = row.offsetTop - box.scrollTop;
    const inRuhezone = rel >= h * 0.2 && rel + row.offsetHeight <= h * 0.6;
    if (!erzwingen && inRuhezone) return;

    const ziel = Math.max(0, row.offsetTop - h / 3);
    box.scrollTo({
      top: ziel,
      behavior: Math.abs(ziel - box.scrollTop) > 3 * h ? "auto" : "smooth",
    });
  }, []);

  React.useEffect(() => {
    if (following) zeige(active, false);
  }, [active, following, zeige]);

  // Layoutwechsel (Modus, Übersetzung, Suche): die Zeile im neuen Layout wiederfinden.
  React.useEffect(() => {
    if (following) zeige(active, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  const jump = React.useCallback(() => {
    const video = getVideo();
    const i = video ? indexBei(video.currentTime) : -1;
    setActive(i);
    setFollowing(true);
    // Auch springen, wenn sich `active` nicht ändert – der Effekt oben liefe dann nicht.
    requestAnimationFrame(() => zeige(i, true));
  }, [getVideo, indexBei, zeige]);

  const stop = React.useCallback(() => setFollowing(false), []);

  const containerProps = React.useMemo<FollowApi["containerProps"]>(
    () => ({
      ref: containerRef,
      tabIndex: 0,
      onWheel: stop,
      onTouchMove: stop,
      // Ziel ist der Container selbst: Griff an der Scrollbar oder Klick ins Leere.
      // Ein Klick auf einen Zeitstempel bleibt davon unberührt.
      onPointerDown: (e) => {
        if (e.target === e.currentTarget) stop();
      },
      onKeyDown: (e) => {
        if (NAVIGATIONSTASTEN.has(e.key)) stop();
      },
    }),
    [stop],
  );

  return { active, following, jump, stop, containerProps };
}
