import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { anteilPositiv } from "@shared/lib/bewertung";
import { ask } from "@/lib/chat-client";
import { getSettings } from "@/lib/storage";

/**
 * Grün/roter Balken unter Vorschaubildern: Anteil der Likes laut Return YouTube Dislike.
 * Nur Build "full" und nur mit `showThumbRatings` (Standard aus, Michael 29.09.2026) –
 * anders als beim offenen Video gehen hier die IDs aller sichtbaren Vorschläge an den
 * Dienst.
 *
 * Unter dem Bild, nicht darauf: dort zeichnet YouTube in Rot, wie weit man ein Video
 * gesehen hat. Abgefragt werden nur Vorschaubilder, die im Bild sind, höchstens eines je
 * Sekunde (RYD erlaubt 100 je Minute), jedes Video einmal je Seitenleben; nach einem
 * Fehlschlag eine Minute Pause.
 *
 * Aufbau gemessen am 29.09.2026: neue Kacheln tragen `yt-thumbnail-view-model` in einem
 * Link `a.ytLockupViewModelContentImage` (Startseite, Kanal, Empfehlungen), die Suche
 * noch `ytd-thumbnail`. Wiedergabelisten (`yt-collections-stack`) bekommen keinen
 * Balken – er zeigte das erste Video, nicht die Liste.
 */

const MARKE = "data-ytsc-vorschau";
const ABSTAND_MS = 1000;
const PAUSE_MS = 60_000;

export function starteVorschauBalken(ctx: ContentScriptContext) {
  const werte = new Map<string, number | null>(); // Anteil positiv; null = keine Daten
  const warteschlange: string[] = [];
  const gewartet = new Set<string>();
  const sichtbar = new WeakMap<Element, string>();
  let gesperrtBis = 0;
  let an = false;

  const beobachter = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      const id = sichtbar.get(e.target);
      if (e.isIntersecting && id && !werte.has(id) && !gewartet.has(id)) {
        gewartet.add(id);
        warteschlange.push(id);
      }
    }
  });

  function videoId(link: HTMLAnchorElement): string | null {
    try {
      const u = new URL(link.href, location.origin);
      const v = u.pathname === "/watch" ? u.searchParams.get("v") : null;
      return v && /^[\w-]{11}$/.test(v) ? v : null;
    } catch {
      return null;
    }
  }

  /** Alle Vorschaubilder der Seite suchen und anmelden; schon bekannte kosten nichts. */
  function suche() {
    for (const bild of document.querySelectorAll<HTMLElement>("yt-thumbnail-view-model, ytd-thumbnail")) {
      if (bild.closest("yt-collections-stack, ytd-playlist-thumbnail")) continue;
      // Bei ytd-thumbnail ist der Link innen, bei der neuen Kachel aussen.
      const link =
        bild.querySelector<HTMLAnchorElement>("a#thumbnail[href]") ??
        bild.closest<HTMLAnchorElement>("a[href]");
      const id = link && videoId(link);
      if (!id) continue;
      const traeger = bild.tagName === "YTD-THUMBNAIL" ? bild : (link ?? bild);
      if (sichtbar.get(traeger) !== id) {
        sichtbar.set(traeger, id);
        beobachter.observe(traeger);
      }
      zeichne(traeger, id);
    }
  }

  function zeichne(traeger: HTMLElement, id: string) {
    const anteil = werte.get(id);
    let balken = traeger.querySelector<HTMLElement>(`:scope > [${MARKE}]`);
    // YouTube verwendet Kacheln für andere Videos wieder: dann gilt der alte Balken nicht.
    if (balken && balken.dataset.id !== id) {
      balken.remove();
      balken = null;
    }
    if (anteil == null) return;
    if (!balken) {
      balken = document.createElement("div");
      balken.setAttribute(MARKE, "");
      balken.dataset.id = id;
      balken.style.cssText =
        "position:absolute;left:0;right:0;top:calc(100% + 3px);height:3px;border-radius:2px;" +
        "background:#d32f2f;overflow:hidden;pointer-events:none;z-index:1";
      const gruen = document.createElement("div");
      gruen.style.cssText = "height:100%;background:#2e9e44";
      balken.append(gruen);
      if (getComputedStyle(traeger).position === "static") traeger.style.position = "relative";
      traeger.append(balken);
    }
    (balken.firstElementChild as HTMLElement).style.width = `${(anteil * 100).toFixed(1)}%`;
    balken.title = `${Math.round(anteil * 100)} % positiv – Schätzung von Return YouTube Dislike`;
  }

  async function arbeite() {
    if (!an || Date.now() < gesperrtBis) return;
    const id = warteschlange.shift();
    if (!id) return;
    try {
      const r = await ask<{ likes: number; dislikes: number }>("dislikes", { videoId: id });
      werte.set(id, anteilPositiv(r.likes, r.dislikes));
    } catch (e) {
      // Kennt der Dienst das Video nicht (400, 404, 410), gibt es keinen Balken – sonst
      // stünde dieselbe ID für immer vorn in der Schlange. Alles andere (429, 408, 5xx,
      // Netz) zurück in die Schlange, eine Minute Ruhe.
      const status = Number(String((e as Error)?.message).match(/HTTP (\d{3})/)?.[1] ?? 0);
      if (status === 400 || status === 404 || status === 410) {
        werte.set(id, null);
      } else {
        warteschlange.unshift(id);
        gesperrtBis = Date.now() + PAUSE_MS;
      }
    }
  }

  function entferne() {
    for (const el of document.querySelectorAll(`[${MARKE}]`)) el.remove();
  }

  async function takt() {
    const vorher = an;
    an = (await getSettings()).showThumbRatings;
    if (!an) {
      if (vorher) entferne();
      return;
    }
    suche();
  }

  ctx.setInterval(() => void takt().catch(() => {}), 1500);
  ctx.setInterval(() => void arbeite().catch(() => {}), ABSTAND_MS);
  void takt();
  ctx.onInvalidated(() => {
    beobachter.disconnect();
    entferne();
  });
}
