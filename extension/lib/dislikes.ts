import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { anteilPositiv, ganzeZahl, schaetzeDislikes } from "@shared/lib/bewertung";
import { ask } from "@/lib/chat-client";
import { getSettings, settingsItem } from "@/lib/storage";
import { videoIdFromUrl } from "@/lib/transcript";

/**
 * Dislikes am Dislike-Knopf und ein Balken mit dem Anteil der Likes darunter, nur für
 * das offene Video. Abschaltbar über `showDislikes`.
 *
 * Zwei Quellen, die bessere zuerst:
 *   1. Nur Build "full": Return YouTube Dislike (CLAUDE.md §1, Ausnahme 29.09.2026) –
 *      archivierte echte Zahlen und Hochrechnung aus den Stimmen der RYD-Nutzer. Geht
 *      nur die Video-ID hin. Nutzungsbedingungen: Namensnennung mit Link (Tooltip,
 *      Optionsseite), höchstens 100 Abrufe je Minute – daher Zwischenspeicher je Video
 *      und eine Minute Pause nach einem Fehlschlag.
 *   2. Beide Builds: Schätzung aus Aufrufen und Likes der Seite (`schaetzeDislikes`),
 *      ohne jeden Abruf. Grob, aber besser als nichts; der Tooltip sagt, wie grob.
 *
 * Eingefügt wird so, wie YouTube den Like-Knopf baut: der Dislike-Knopf bekommt die
 * Klasse „Symbol vorn“ des Like-Knopfs statt „nur Symbol“, dahinter ein Textfeld mit der
 * Klasse des Like-Zählers. Abgeschaut statt fest verdrahtet – YouTube hat die
 * Klassennamen schon einmal umbenannt (`yt-spec-button-shape-next--icon-button` →
 * `ytSpecButtonShapeNextIconButton`, gemessen 29.09.2026).
 */

const MARKE = "data-ytsc-dislikes";
const BALKEN = "data-ytsc-balken";
/** Der Server selbst gibt `max-age=180` an; länger als eine Viertelstunde lohnt nicht. */
const GUELTIG_MS = 15 * 60_000;
/** Nach einem Fehlschlag (auch 429) so lange nicht erneut fragen. */
const PAUSE_MS = 60_000;

interface Ryd {
  likes: number;
  dislikes: number;
  zeit: number;
}

interface Anzeige {
  dislikes: number;
  likes: number;
  quelle: "ryd" | "schaetzung";
}

export function starteDislikes(ctx: ContentScriptContext) {
  const speicher = new Map<string, Ryd>();
  let gesperrtBis = 0;
  let laeuft = false;
  let videoId: string | null = null;

  async function pruefe() {
    const an = (await getSettings()).showDislikes;
    const v = an ? videoIdFromUrl(location.href) : null;
    if (v !== videoId) {
      videoId = v;
      entferne();
    }
    if (!v) return;
    if (__FALLBACK__) void holeRyd(v);
    const s = speicher.get(v);
    const seite = seitenzahlen();
    const anzeige: Anzeige | null = s
      ? {
          // RYDs eigene Formel (FAQ): Verhältnis aus ihren Daten mal öffentliche Likes –
          // hier mit dem aktuellen Stand der Seite statt ihrem bis zu drei Tage alten.
          dislikes: seite.likes ? Math.round((s.dislikes * seite.likes) / s.likes) : s.dislikes,
          likes: seite.likes ?? s.likes,
          quelle: "ryd",
        }
      : seite.likes && seite.aufrufe
        ? (() => {
            const d = schaetzeDislikes(seite.aufrufe, seite.likes);
            return d == null ? null : { dislikes: d, likes: seite.likes, quelle: "schaetzung" as const };
          })()
        : null;
    if (anzeige && v === videoIdFromUrl(location.href)) setze(anzeige);
  }

  async function holeRyd(v: string) {
    const s = speicher.get(v);
    if (laeuft || Date.now() < gesperrtBis || (s && Date.now() - s.zeit < GUELTIG_MS)) return;
    laeuft = true;
    try {
      const r = await ask<{ likes: number; dislikes: number }>("dislikes", { videoId: v });
      if (r.likes > 0) speicher.set(v, { ...r, zeit: Date.now() });
    } catch (e) {
      // Kein Ersatzwert aus der Luft: bis zur nächsten Minute rechnet die Schätzung.
      gesperrtBis = Date.now() + PAUSE_MS;
      console.warn("[yt-summary-chat] Return YouTube Dislike nicht abrufbar:", e);
    } finally {
      laeuft = false;
    }
  }

  /**
   * Likes aus der Beschriftung des Like-Knopfs („bisher 110.047 positive Bewertungen“),
   * Aufrufe aus der Infozeile („23.400.861 Aufrufe • 10.11.2014“) – beides ungerundet,
   * anders als die sichtbaren „110K“ und „23 Mio.“.
   */
  function seitenzahlen(): { likes: number | null; aufrufe: number | null } {
    const likeKnopf = document.querySelector(
      "ytd-watch-metadata segmented-like-dislike-button-view-model like-button-view-model button",
    );
    const info = document.querySelector("ytd-watch-metadata ytd-watch-info-text")?.textContent ?? "";
    const vorPunkt = info.match(/(\d[\d.,  ' ]*)[^\d•]*•/);
    return {
      likes: ganzeZahl(likeKnopf?.getAttribute("aria-label")),
      aufrufe: vorPunkt ? ganzeZahl(vorPunkt[1]) : null,
    };
  }

  /** YouTube rendert die Knöpfe bei Navigation und Like-Klick neu – daher im Takt. */
  function setze(a: Anzeige) {
    const segment = document.querySelector<HTMLElement>(
      "ytd-watch-metadata segmented-like-dislike-button-view-model",
    );
    const knopf = segment?.querySelector("dislike-button-view-model button");
    const likeKnopf = segment?.querySelector("like-button-view-model button");
    if (!segment || !knopf || !likeKnopf) return;
    const likeText = likeKnopf.querySelector("[class*='ButtonTextContent'], [class*='button-text-content']");
    const vorn = [...likeKnopf.classList].find((c) => /IconLeading$|--icon-leading$/.test(c));
    const nurSymbol = [...knopf.classList].find((c) => /IconButton$|--icon-button$/.test(c));
    if (!likeText || !vorn) return;

    const kurz = new Intl.NumberFormat(document.documentElement.lang || undefined, { notation: "compact" });
    const anteil = anteilPositiv(a.likes, a.dislikes);
    const tooltip =
      `≈ ${kurz.format(a.dislikes)} Dislikes, ${kurz.format(a.likes)} Likes` +
      (anteil == null ? "" : ` – ${Math.round(anteil * 100)} % positiv`) +
      (a.quelle === "ryd"
        ? ".\nSchätzung von Return YouTube Dislike (returnyoutubedislike.com), keine offiziellen Zahlen."
        : ".\nGrob geschätzt aus Aufrufen und Likes, keine offiziellen Zahlen: der Anteil liegt " +
          "typisch 2 Prozentpunkte daneben, die Dislike-Zahl ist in 59 % der Fälle auf " +
          "Faktor 2 genau (Modell aus 46 849 Videos mit echten Dislikes, Stand 2021).");

    // Auch bei vorhandener Zahl: setzt YouTube die Klassen neu (etwa nach einem Klick),
    // stünde die Zahl sonst abgeschnitten im runden Symbolknopf.
    if (nurSymbol) {
      knopf.classList.remove(nurSymbol);
      knopf.setAttribute("data-ytsc-klasse", nurSymbol);
    }
    knopf.classList.add(vorn);
    let feld = knopf.querySelector<HTMLElement>(`[${MARKE}]`);
    if (!feld) {
      feld = document.createElement("div");
      feld.className = likeText.className;
      feld.setAttribute(MARKE, "");
      const symbol = knopf.querySelector("[class*='Icon'], [class*='icon']");
      if (symbol?.parentElement === knopf) symbol.after(feld);
      else knopf.prepend(feld);
    }
    // Die Schätzung trägt ein „≈“, damit sie nicht wie eine Zählung aussieht.
    const text = `${a.quelle === "schaetzung" ? "≈ " : ""}${kurz.format(a.dislikes)}`;
    if (feld.textContent !== text) feld.textContent = text;
    if (feld.title !== tooltip) feld.title = tooltip;
    // Geschätzt statt gezählt: kursiv und in YouTubes gedämpfter Schriftfarbe, damit es
    // auch ohne Blick auf das „≈“ auffällt (Michael, 29.09.2026).
    const geschaetzt = a.quelle === "schaetzung";
    feld.style.fontStyle = geschaetzt ? "italic" : "";
    feld.style.color = geschaetzt ? "var(--yt-spec-text-secondary)" : "";

    zeichneBalken(segment, anteil, a.quelle, tooltip);
  }

  /**
   * Schmaler Balken unter beiden Knöpfen, wie YouTube ihn bis 2021 zeigte: hell der
   * Anteil der Likes, gedämpft der Rest. Bei der groben Schätzung blasser.
   */
  function zeichneBalken(segment: HTMLElement, anteil: number | null, quelle: Anzeige["quelle"], tooltip: string) {
    let balken = segment.querySelector<HTMLElement>(`[${BALKEN}]`);
    if (anteil == null) {
      balken?.remove();
      return;
    }
    if (!balken) {
      balken = document.createElement("div");
      balken.setAttribute(BALKEN, "");
      balken.setAttribute("role", "img");
      balken.style.cssText =
        "position:absolute;left:12px;right:12px;bottom:-6px;height:3px;border-radius:2px;" +
        "background:var(--yt-spec-10-percent-layer,rgba(128,128,128,.3));overflow:hidden;cursor:help";
      const innen = document.createElement("div");
      innen.style.cssText = "height:100%;background:var(--yt-spec-text-primary,currentColor)";
      balken.append(innen);
      if (getComputedStyle(segment).position === "static") segment.style.position = "relative";
      segment.append(balken);
    }
    const innen = balken.firstElementChild as HTMLElement;
    const breite = `${(anteil * 100).toFixed(1)}%`;
    if (innen.style.width !== breite) innen.style.width = breite;
    balken.style.opacity = quelle === "ryd" ? "1" : "0.6";
    if (balken.title !== tooltip) {
      balken.title = tooltip;
      balken.setAttribute("aria-label", tooltip);
    }
  }

  function entferne() {
    for (const el of document.querySelectorAll(`[${BALKEN}]`)) el.remove();
    for (const feld of document.querySelectorAll(`[${MARKE}]`)) {
      const knopf = feld.closest("button");
      feld.remove();
      const alt = knopf?.getAttribute("data-ytsc-klasse");
      if (knopf && alt) {
        knopf.classList.remove(...[...knopf.classList].filter((c) => /IconLeading$|--icon-leading$/.test(c)));
        knopf.classList.add(alt);
        knopf.removeAttribute("data-ytsc-klasse");
      }
    }
  }

  const takt = () => void pruefe().catch(() => {});
  takt();
  ctx.setInterval(takt, 1000);
  const stop = settingsItem.watch(takt);
  ctx.onInvalidated(() => {
    stop();
    entferne();
  });
}
