import { browserHttp, type Http } from "./transcript.ts";

/**
 * Kommentare eines Videos sichern – als HTML, das aussieht wie auf YouTube.
 *
 * Der Weg ist derselbe, den die Watch-Seite beim Scrollen geht: `youtubei/v1/next` mit
 * einem Fortsetzungstoken, Seite für Seite, zwanzig Kommentare je Abruf. Kein Login,
 * kein Helfer, kein Download einer Mediendatei. Gemessen am 26.09.2026 an drei Videos
 * (docs/messungen.md, „Kommentare“):
 *
 *   - Der Text steht in `commentEntityPayload.properties.content.content`, die
 *     Formatierung daneben als Läufe mit `startIndex`/`length` in **UTF-16-Einheiten**
 *     (ein Emoji zählt zwei): `styleRuns` (fett = `FONT_WEIGHT_MEDIUM`, `italic`),
 *     `commandRuns` (Zeitmarken, Links, Erwähnungen), `attachmentRuns` (Emojis als Bild).
 *   - Die Kommentare selbst kommen nicht im Baum, sondern als `mutations` unter
 *     `frameworkUpdates.entityBatchUpdate`; der Baum trägt nur ihre Schlüssel.
 *   - Antworten hängen als eigener Fortsetzungstoken am Kommentar, auch geschachtelt
 *     (`replyLevel` 2).
 *
 * yt-dlp geht denselben Weg (`_comment_entries`), wirft die Formatierung aber weg.
 */

export interface Lauf {
  startIndex?: number;
  length?: number;
  weightLabel?: string;
  italic?: boolean;
  strikethrough?: unknown;
  onTap?: unknown;
  element?: unknown;
}

export interface Inhalt {
  content?: string;
  styleRuns?: Lauf[];
  commandRuns?: Lauf[];
  attachmentRuns?: Lauf[];
}

export interface Kommentar {
  id: string;
  autor: string;
  autorUrl: string;
  avatar: string;
  inhalt: Inhalt;
  zeit: string;
  likes: string;
  angepinnt: string;
  herz: boolean;
  vomKanal: boolean;
  verifiziert: boolean;
  antworten: Kommentar[];
}

export interface KommentarLage {
  /** YouTubes eigene Angabe, etwa „2.457 Kommentare“; leer, wenn keine kam. */
  anzahlText: string;
  kommentare: Kommentar[];
  /** Mit Abbruch beendet – das HTML sagt dann, dass es nur ein Teil ist. */
  unvollstaendig: boolean;
}

type Json = any; // YouTubes Antworten sind untypisiert; geprüft wird an der Stelle des Zugriffs.

const BASE = "https://www.youtube.com";

/** Das JSON-Objekt, das direkt hinter `marke` im HTML beginnt, per Klammerzählung. */
export function jsonNach(html: string, marke: string): Json | null {
  const start = html.indexOf("{", html.indexOf(marke) + marke.length - 1);
  if (html.indexOf(marke) < 0 || start < 0) return null;
  let tiefe = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") tiefe++;
    else if (c === "}" && --tiefe === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Alle Objekte im Baum, auf die `pruefe` zutrifft – YouTube verschiebt Pfade gern. */
function finde(o: Json, pruefe: (x: Json) => boolean, out: Json[] = []): Json[] {
  if (o && typeof o === "object") {
    if (pruefe(o)) out.push(o);
    for (const v of Object.values(o)) finde(v, pruefe, out);
  }
  return out;
}

const tokenIn = (o: Json): string | undefined =>
  finde(o, (x) => typeof x.continuationCommand?.token === "string")[0]?.continuationCommand.token;

export interface LadeOptionen {
  http?: Http;
  signal?: AbortSignal;
  onProgress?: (geladen: number) => void;
  /**
   * Nur die ersten so vielen Hauptkommentare der Top-Liste, ohne nachgeladene Antworten –
   * für die Stimmungsauswertung. Ohne Angabe: alles, sortiert nach „Neueste“ (Export).
   */
  hoechstens?: number;
}

export async function ladeKommentare(videoId: string, o: LadeOptionen = {}): Promise<KommentarLage> {
  const http = o.http ?? browserHttp;
  const seite = await http(`${BASE}/watch?v=${videoId}`);
  if (!seite.ok) throw new Error(`Watch-Seite: HTTP ${seite.status}`);
  const kontext = jsonNach(seite.text, '"INNERTUBE_CONTEXT":');
  const start = jsonNach(seite.text, "var ytInitialData = ");
  if (!kontext || !start) throw new Error("Die Watch-Seite hat nicht die erwartete Form.");

  const sektion = finde(
    start,
    (x) => x.itemSectionRenderer?.sectionIdentifier === "comment-item-section",
  )[0];
  const erster = tokenIn(sektion);
  if (!erster) {
    throw new Error("Für dieses Video sind Kommentare deaktiviert oder nicht abrufbar.");
  }

  const holen = async (token: string): Promise<Json> => {
    const r = await http(`${BASE}/youtubei/v1/next?prettyPrint=false`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Youtube-Client-Name": "1",
        "X-Youtube-Client-Version": String(kontext.client?.clientVersion ?? ""),
      },
      body: JSON.stringify({ context: kontext, continuation: token }),
    });
    if (!r.ok) throw new Error(`Kommentare: HTTP ${r.status}`);
    return JSON.parse(r.text);
  };

  const lage: KommentarLage = { anzahlText: "", kommentare: [], unvollstaendig: false };
  let geladen = 0;
  // YouTube wiederholt bei manchen Videos Seiten endlos (yt-dlp #6290); ein bekannter
  // Kommentar beendet die Liste, statt sie doppelt zu füllen.
  const gesehen = new Set<string>();
  let umgeschaltet = false;

  /** Liest eine Liste ab `token` samt aller Folgeseiten und Antworten. */
  async function liste(token: string | undefined, ziel: Kommentar[]): Promise<void> {
    while (token) {
      if (o.signal?.aborted) {
        lage.unvollstaendig = true;
        return;
      }
      const antwort = await holen(token);
      token = undefined;
      const entitaeten = new Map<string, Json>();
      for (const m of antwort.frameworkUpdates?.entityBatchUpdate?.mutations ?? []) {
        if (m?.entityKey) entitaeten.set(m.entityKey, m.payload);
      }
      const eintraege: Json[] = finde(antwort, (x) => Array.isArray(x.continuationItems)).flatMap(
        (x) => x.continuationItems,
      );
      for (const e of eintraege) {
        if (e.commentsHeaderRenderer) {
          const h = e.commentsHeaderRenderer;
          lage.anzahlText ||= (h.countText?.runs ?? []).map((r: Json) => r.text).join("");
          // Umschalten auf „Neueste zuerst“ und die Top-Liste dieser Antwort verwerfen:
          // die Top-Liste endet früh. Gemessen am 26.09.2026 an aqz-KE-bpKQ: 1128
          // Hauptkommentare über „Top“, 3775 über „Neueste“ (yt-dlp sortiert genauso).
          const neueste = tokenIn(h.sortMenu?.sortFilterSubMenuRenderer?.subMenuItems?.[1]);
          // Die sortierte Liste bringt denselben Kopf wieder mit – nur einmal umschalten.
          if (neueste && !umgeschaltet && !o.hoechstens) {
            umgeschaltet = true;
            token = neueste;
            break;
          }
          continue;
        }
        if (e.continuationItemRenderer) {
          token = tokenIn(e.continuationItemRenderer);
          continue;
        }
        if (await eintrag(e, entitaeten, ziel)) return;
      }
    }
  }

  /** Ein Kommentar samt Antworten; `true` heisst: YouTube wiederholt sich, Liste beenden. */
  async function eintrag(e: Json, entitaeten: Map<string, Json>, ziel: Kommentar[]): Promise<boolean> {
    const thread = e.commentThreadRenderer;
    const vm = thread?.commentViewModel?.commentViewModel ?? e.commentViewModel;
    const k = kommentarAus(vm, entitaeten);
    if (!k) return false;
    if (gesehen.has(k.id)) return !k.angepinnt;
    gesehen.add(k.id);
    ziel.push(k);
    o.onProgress?.(++geladen);
    if (o.hoechstens && ziel === lage.kommentare && ziel.length >= o.hoechstens) return true;

    // Antworten stehen entweder direkt da oder hinter einem eigenen Token. Die mit Token
    // kommen erst nach allen Hauptkommentaren dran: ein Kommentar mit tausend Antworten
    // soll bei einem Abbruch nicht die ganze Datei füllen.
    for (const s of thread?.replies?.commentRepliesRenderer?.subThreads ?? []) {
      if (s.commentThreadRenderer) await eintrag(s, entitaeten, k.antworten);
      else if (s.continuationItemRenderer) {
        const t = tokenIn(s.continuationItemRenderer);
        if (!o.hoechstens) offen.push(() => liste(t, k.antworten));
      }
    }
    return false;
  }

  const offen: Array<() => Promise<void>> = [];
  await liste(erster, lage.kommentare);
  // Die Warteschlange wächst beim Abarbeiten (Antworten auf Antworten).
  for (let i = 0; i < offen.length && !o.signal?.aborted; i++) await offen[i]!();
  if (o.signal?.aborted) lage.unvollstaendig = true;
  return lage;
}

function kommentarAus(vm: Json, entitaeten: Map<string, Json>): Kommentar | null {
  const p = entitaeten.get(vm?.commentKey)?.commentEntityPayload;
  const id = p?.properties?.commentId;
  if (typeof id !== "string") return null;
  const a = p.author ?? {};
  const pfad =
    a.channelCommand?.innertubeCommand?.browseEndpoint?.canonicalBaseUrl ??
    a.channelCommand?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
  return {
    id,
    autor: String(a.displayName ?? ""),
    autorUrl: typeof pfad === "string" ? BASE + pfad : "",
    avatar: typeof a.avatarThumbnailUrl === "string" ? a.avatarThumbnailUrl : "",
    inhalt: p.properties.content ?? {},
    zeit: String(p.properties.publishedTime ?? ""),
    // `likeCountNotliked` ist die Zahl ohne das eigene Like, so wie sie jeder sieht.
    likes: String(p.toolbar?.likeCountNotliked ?? "").trim(),
    angepinnt: typeof vm.pinnedText === "string" ? vm.pinnedText : "",
    herz:
      entitaeten.get(vm.toolbarStateKey)?.engagementToolbarStateEntityPayload?.heartState ===
      "TOOLBAR_HEART_STATE_HEARTED",
    vomKanal: a.isCreator === true,
    verifiziert: a.isVerified === true,
    antworten: [],
  };
}

/**
 * Hauptkommentare als Klartext für ein Sprachmodell: eine Zeile je Kommentar mit Likes
 * davor, lange Kommentare gekürzt. Antworten bleiben weg – sie reagieren auf den
 * Kommentar, nicht auf das Video.
 */
export function kommentareAlsText(lage: KommentarLage, zeichenJeKommentar = 500): string {
  return lage.kommentare
    .map((k) => {
      const text = (k.inhalt.content ?? "").replace(/\s+/g, " ").trim();
      const kurz = text.length > zeichenJeKommentar ? `${text.slice(0, zeichenJeKommentar)} …` : text;
      return `[${k.likes || "0"} Likes${k.vomKanal ? ", Kanal selbst" : ""}] ${kurz}`;
    })
    .join("\n");
}

/* ---- HTML ---- */

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Link eines `commandRun`: Zeitmarke, Kanal, Hashtag oder externer Link (über /redirect). */
function linkAus(lauf: Lauf): string {
  const cmd = (lauf.onTap as Json)?.innertubeCommand;
  const roh: unknown = cmd?.urlEndpoint?.url ?? cmd?.commandMetadata?.webCommandMetadata?.url;
  if (typeof roh !== "string") return "";
  let url = roh.startsWith("/") ? BASE + roh : roh;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtube.com") && u.pathname === "/redirect") {
      url = u.searchParams.get("q") ?? url;
    }
  } catch {
    return "";
  }
  // Erst nach dem Auspacken prüfen: im Ziel des Redirects kann `javascript:` stehen.
  return /^https?:\/\//i.test(url) ? url : "";
}

/**
 * Der Kommentartext mit Fett, Kursiv, Durchgestrichen, Links und Emojis.
 *
 * Zerlegt wird an jeder Lauf-Grenze; jedes Stück bekommt die Formate aller Läufe, die
 * es überdecken. Das verträgt überlappende Läufe (eine Zeitmarke ist `styleRun` und
 * `commandRun` zugleich), ohne verschachtelte Tags zu raten. Unicode-Emojis bleiben
 * Text – das Bild daneben ist nur YouTubes Darstellung desselben Zeichens. Nur
 * Kanal-Emojis wie „:yt:“ gibt es als Zeichen nicht; sie werden zum Bild.
 */
export function inhaltAlsHtml(inhalt: Inhalt): string {
  const text = inhalt.content ?? "";
  const bereich = (l: Lauf) => [l.startIndex ?? 0, (l.startIndex ?? 0) + (l.length ?? 0)] as const;
  const alle = [
    ...(inhalt.styleRuns ?? []),
    ...(inhalt.commandRuns ?? []),
    ...(inhalt.attachmentRuns ?? []),
  ];
  const grenzen = [...new Set([0, text.length, ...alle.flatMap((l) => bereich(l))])]
    .filter((g) => g >= 0 && g <= text.length)
    .sort((a, b) => a - b);

  let html = "";
  for (let i = 0; i + 1 < grenzen.length; i++) {
    const [von, bis] = [grenzen[i]!, grenzen[i + 1]!];
    if (von === bis) continue;
    const deckt = (l: Lauf) => bereich(l)[0] <= von && bis <= bereich(l)[1];

    const anhang = (inhalt.attachmentRuns ?? []).find(deckt);
    const label: string = (anhang?.element as Json)?.properties?.accessibilityProperties?.label ?? "";
    const bild: string = (anhang?.element as Json)?.type?.imageType?.image?.sources?.[0]?.url ?? "";
    let stueck: string;
    if (anhang && bild && label && label !== text.slice(...bereich(anhang))) {
      // Das Bild einmal am Anfang des Laufs, der Rest des Laufs entfällt.
      if (von !== bereich(anhang)[0]) continue;
      stueck = `<img class="emoji" src="${esc(bild)}" alt="${esc(label)}">`;
    } else {
      stueck = esc(text.slice(von, bis));
    }

    const stile = (inhalt.styleRuns ?? []).filter(deckt);
    if (stile.some((l) => /MEDIUM|BOLD|HEAVY/.test(l.weightLabel ?? ""))) stueck = `<b>${stueck}</b>`;
    if (stile.some((l) => l.italic)) stueck = `<i>${stueck}</i>`;
    if (stile.some((l) => l.strikethrough)) stueck = `<s>${stueck}</s>`;
    const befehl = (inhalt.commandRuns ?? []).find(deckt);
    const href = befehl ? linkAus(befehl) : "";
    if (href) stueck = `<a href="${esc(href)}">${stueck}</a>`;
    html += stueck;
  }
  return html;
}

function kommentarHtml(k: Kommentar): string {
  const marken = [
    k.angepinnt && `<div class="pin">📌 ${esc(k.angepinnt)}</div>`,
  ].filter(Boolean);
  const autor = k.autorUrl
    ? `<a class="autor${k.vomKanal ? " kanal" : ""}" href="${esc(k.autorUrl)}">${esc(k.autor)}</a>`
    : `<span class="autor">${esc(k.autor)}</span>`;
  return (
    `<div class="k">` +
    (k.avatar ? `<img class="av" src="${esc(k.avatar)}" alt="">` : `<div class="av"></div>`) +
    `<div class="rumpf">${marken.join("")}` +
    `<div class="kopf">${autor}${k.verifiziert ? ' <span title="bestätigt">✔</span>' : ""}` +
    ` <span class="zeit">${esc(k.zeit)}</span></div>` +
    `<div class="text">${inhaltAlsHtml(k.inhalt)}</div>` +
    `<div class="fuss">👍 ${esc(k.likes || "0")}${k.herz ? ' <span title="Herz vom Kanal">❤️</span>' : ""}</div>` +
    (k.antworten.length ? `<div class="antworten">${k.antworten.map(kommentarHtml).join("")}</div>` : "") +
    `</div></div>`
  );
}

function zaehle(ks: Kommentar[]): number {
  return ks.reduce((n, k) => n + 1 + zaehle(k.antworten), 0);
}

export function kommentareAlsHtml(
  lage: KommentarLage,
  video: { id: string; titel: string; kanal: string },
): string {
  const url = `${BASE}/watch?v=${video.id}`;
  const stand = new Date().toLocaleString("de-DE");
  const hinweis = lage.unvollstaendig
    ? `<p class="warn">Abgebrochen – diese Datei enthält nur einen Teil der Kommentare.</p>`
    : "";
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<title>Kommentare – ${esc(video.titel)}</title>
<style>
body{font:14px/1.45 Roboto,Arial,sans-serif;max-width:860px;margin:24px auto;padding:0 16px;color:#0f0f0f}
h1{font-size:20px;margin:0 0 4px}a{color:#065fd4;text-decoration:none}a:hover{text-decoration:underline}
.meta{color:#606060;margin-bottom:20px}.warn{color:#b3261e;font-weight:500}
.k{display:flex;gap:12px;margin:16px 0}.av{width:40px;height:40px;border-radius:50%;flex:none;background:#eee}
.antworten .av{width:24px;height:24px}.rumpf{flex:1;min-width:0}
.kopf{font-size:13px}.autor{color:#0f0f0f;font-weight:500}.autor.kanal{background:#e5e5e5;border-radius:12px;padding:1px 6px}
.zeit,.pin,.fuss{color:#606060;font-size:12px}.text{white-space:pre-wrap;word-wrap:break-word;margin:2px 0 4px}
.emoji{width:1.2em;height:1.2em;vertical-align:-.2em}
@media (prefers-color-scheme:dark){body{background:#0f0f0f;color:#f1f1f1}.autor{color:#f1f1f1}.autor.kanal{background:#3f3f3f}.zeit,.pin,.fuss,.meta{color:#aaa}a{color:#3ea6ff}}
</style></head><body>
<p><a href="${esc(url)}">${esc(url)}</a></p>
<h1>${esc(video.titel)}</h1>
<div class="meta">${esc(video.kanal)}${video.kanal ? " · " : ""}${zaehle(lage.kommentare)} Kommentare gesichert${lage.anzahlText ? ` (YouTube: ${esc(lage.anzahlText)})` : ""} · Stand ${esc(stand)}</div>
${hinweis}
${lage.kommentare.map(kommentarHtml).join("\n")}
</body></html>
`;
}
