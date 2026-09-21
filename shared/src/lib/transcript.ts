import type { CaptionTrack, Cue, Transcript } from "./types";

/**
 * Die eine Naht zur Plattform: alle vier YouTube-Abrufe gehen hier durch.
 *
 * In der Erweiterung ist das `fetch` aus dem Content-Script – same-origin, mit Cookies.
 * In der Android-App ist es der native HTTP-Weg (CapacitorHttp), weil der WebView auf
 * `https://localhost` läuft und CORS jeden direkten Abruf verböte. Streaming braucht
 * hier niemand, deshalb reicht `text`.
 */
export interface HttpAntwort {
  status: number;
  ok: boolean;
  text: string;
}

export interface HttpAnfrage {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}

export type Http = (url: string, init?: HttpAnfrage) => Promise<HttpAntwort>;

/**
 * Vorgabe für alles, was in einem Browser auf youtube.com läuft. `credentials: "include"`
 * ist gemessen **nicht** nötig (messungen.md: geht mit und ohne Cookies), schadet aber
 * auch nicht und hält das Verhalten der Erweiterung unverändert.
 *
 * Nur für youtube.com selbst: vor dem Umbau lief der Abruf von base.js ohne diese Angabe.
 * Liegt die Datei einmal auf einem fremden Host, gingen sonst Cookies dorthin, und ein
 * Abruf mit Cookies scheitert an CORS, wo er ohne gelingt (DeepSeek, 21.09.2026).
 */
export const browserHttp: Http = async (url, init) => {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.headers,
    body: init?.body,
    credentials: /^https:\/\/(www\.|m\.)?youtube\.com\//.test(url) ? "include" : "same-origin",
  });
  return { status: res.status, ok: res.ok, text: await res.text() };
};

/**
 * Untertitelspuren beschaffen.
 *
 * Die `baseUrl` aus dem HTML der Watch-Seite ist unbrauchbar: sie beantwortet jeden
 * Abruf mit HTTP 200 und leerem Body (gemessen 01.09.2026, anonym wie angemeldet).
 * Brauchbar ist nur die **signierte** URL aus einer Player-Antwort des visionOS-Clients
 * – sie trägt `signature=`, `expire=` und `sparams=`.
 *
 * Damit YouTube diese Antwort herausgibt, müssen vier Dinge stimmen. Fehlt eines,
 * kommt `playabilityStatus: LOGIN_REQUIRED` („Melde dich an, damit wir sehen, dass du
 * kein Bot bist“) – auch beim angemeldeten Nutzer:
 *
 *   1. `playbackContext.contentPlaybackContext.signatureTimestamp` aus YouTubes
 *      `base.js`. Das war der eigentlich fehlende Baustein.
 *   2. Header `X-Goog-Visitor-Id` mit dem `visitorData` der Seite.
 *   3. `userAgent` **im Kontext-Objekt** (ein Safari-String; den echten
 *      `User-Agent`-Header kann JavaScript nicht setzen, das ist auch nicht nötig).
 *   4. Kein `key=`-Parameter an der URL.
 *
 * Abgelesen an `yt-dlp --print-traffic`, nicht geraten. Funktioniert mit und ohne
 * Cookies, also auch für nicht angemeldete Nutzer.
 */
const VISIONOS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/26.0 Safari/605.1.15";

export async function fetchCaptionTracks(
  videoId: string,
  http: Http = browserHttp,
): Promise<CaptionTrack[]> {
  const res = await http(`https://www.youtube.com/watch?v=${videoId}`);
  if (!res.ok) throw new Error(`Watch-Seite: HTTP ${res.status}`);
  const html = res.text;

  const visitorData = html.match(/"visitorData":"([^"]+)"/)?.[1];
  const sts = await signatureTimestamp(html, http);

  const player = await fetchPlayerVisionOs(videoId, visitorData, sts, http);
  const liste = player?.captions?.playerCaptionsTracklistRenderer;
  const tracks = liste?.captionTracks ?? [];
  const standardIndex =
    liste?.audioTracks?.[0]?.defaultCaptionTrackIndex ?? liste?.defaultCaptionTrackIndex;

  if (!tracks.length) {
    const grund = player?.playabilityStatus?.reason;
    const status = player?.playabilityStatus?.status;
    if (status && status !== "OK") {
      throw new Error(`YouTube gibt das Video nicht frei (${status})${grund ? `: ${grund}` : ""}`);
    }
  }

  return tracks
    .map((t, i): CaptionTrack => ({
      lang: t.languageCode ?? "?",
      name: t.name?.simpleText ?? t.name?.runs?.[0]?.text ?? t.languageCode ?? "?",
      url: t.baseUrl,
      auto: t.kind === "asr",
      standard: i === standardIndex,
    }))
    .filter((t) => !!t.url);
}

/** Holt `signatureTimestamp` aus YouTubes Player-JavaScript. */
async function signatureTimestamp(html: string, http: Http): Promise<number | undefined> {
  const jsUrl = html.match(/"jsUrl":"([^"]+base\.js)"/)?.[1];
  if (!jsUrl) return undefined;
  try {
    const r = await http(jsUrl.startsWith("http") ? jsUrl : `https://www.youtube.com${jsUrl}`);
    if (!r.ok) return undefined;
    const js = r.text;
    const m = js.match(/signatureTimestamp[:=](\d+)/);
    return m ? Number(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

async function fetchPlayerVisionOs(
  videoId: string,
  visitorData: string | undefined,
  sts: number | undefined,
  http: Http,
): Promise<PlayerResponse | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Youtube-Client-Name": "101",
    "X-Youtube-Client-Version": "1.02",
  };
  if (visitorData) headers["X-Goog-Visitor-Id"] = visitorData;

  const res = await http("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers,
    body: JSON.stringify({
      context: {
        client: {
          clientName: "VISIONOS",
          clientVersion: "1.02",
          deviceMake: "Apple",
          deviceModel: "RealityDevice17,1",
          userAgent: VISIONOS_UA,
          osName: "visionOS",
          osVersion: "26.5.23O471",
          hl: "en",
          timeZone: "UTC",
          utcOffsetMinutes: 0,
        },
      },
      videoId,
      ...(sts
        ? {
            playbackContext: {
              contentPlaybackContext: {
                html5Preference: "HTML5_PREF_WANTS",
                signatureTimestamp: sts,
              },
            },
          }
        : {}),
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });
  if (!res.ok) throw new Error(`Player-API: HTTP ${res.status}`);
  // Aus einer Extension-Seite heraus antwortet YouTube hier mit HTML statt JSON
  // (messungen.md). Ein sprechender Fehler ist besser als ein JSON-Parserfehler.
  try {
    return JSON.parse(res.text) as PlayerResponse;
  } catch {
    throw new Error(
      `Player-API: keine JSON-Antwort (${res.text.slice(0, 40).replace(/\s+/g, " ")}…)`,
    );
  }
}

interface PlayerResponse {
  playabilityStatus?: { status?: string; reason?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      defaultCaptionTrackIndex?: number;
      audioTracks?: Array<{ defaultCaptionTrackIndex?: number }>;
      captionTracks?: Array<{
        baseUrl: string;
        languageCode?: string;
        kind?: string;
        name?: { simpleText?: string; runs?: Array<{ text?: string }> };
      }>;
    };
  };
}


/**
 * Wählt die Spur: "auto" heisst „nimm die beste", sonst gilt der Sprachcode.
 *
 * Die Rangfolge stammt aus einem realen Fall: ein Video mit englischer ASR-Spur und
 * einer **redigierten deutschen** Spur. Die automatische Spur war deutlich schlechter,
 * und YouTubes eigene Vorauswahl (`defaultCaptionTrackIndex`) zeigte auf die deutsche –
 * sie ist damit das beste verfügbare Qualitätssignal, das die Seite hergibt.
 *
 * Eine Feinheit steht darüber: ist die Vorauswahl selbst automatisch und gibt es
 * **dieselbe Sprache noch einmal von Hand**, gewinnt die Handarbeit. Das ist der Fall
 * „Kanal hat nachträglich korrigierte Untertitel hochgeladen", und dort ist die
 * ASR-Spur nie die bessere.
 */
export function pickTrack(tracks: CaptionTrack[], want: string): CaptionTrack | null {
  if (!tracks.length) return null;
  if (want !== "auto") {
    const exact = tracks.find((t) => t.lang === want && !t.auto);
    if (exact) return exact;
    const any = tracks.find((t) => t.lang === want);
    if (any) return any;
  }

  const standard = tracks.find((t) => t.standard);
  if (standard?.auto) {
    // Erst dieselbe Sprache von Hand (der Kanal hat korrigierte Untertitel
    // nachgereicht), dann irgendeine Handarbeit: eine redigierte Spur ist auch in einer
    // anderen Sprache besser als eine automatische – gemessen an einem Video mit
    // redigierter deutscher und automatischer englischer Spur, wo die automatische
    // deutlich schlechter war und das Modell ohnehin übersetzt.
    return (
      tracks.find((t) => !t.auto && t.lang.split("-")[0] === standard.lang.split("-")[0]) ??
      tracks.find((t) => !t.auto) ??
      standard
    );
  }
  return standard ?? tracks.find((t) => !t.auto) ?? tracks[0] ?? null;
}

export async function fetchCues(track: CaptionTrack, http: Http = browserHttp): Promise<Cue[]> {
  const url = new URL(track.url);
  url.searchParams.set("fmt", "json3");

  const res = await http(url.toString());
  if (!res.ok) throw new Error(`Untertitel: HTTP ${res.status}`);
  const body = res.text;
  if (!body.trim()) throw new Error("Untertitel: leere Antwort");

  return parseJson3(body);
}

interface Json3 {
  events?: Array<{
    tStartMs?: number;
    dDurationMs?: number;
    segs?: Array<{ utf8?: string }>;
  }>;
}

export function parseJson3(body: string): Cue[] {
  const data = JSON.parse(body) as Json3;
  const cues: Cue[] = [];

  for (const ev of data.events ?? []) {
    if (ev.tStartMs == null || !ev.segs) continue;
    const text = ev.segs
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    // YouTube schickt reine Positionierungs-Events ohne Text mit.
    if (!text || text === "\n") continue;
    cues.push({
      start: ev.tStartMs / 1000,
      dur: (ev.dDurationMs ?? 0) / 1000,
      text,
    });
  }
  return cues;
}

export interface LoadResult {
  transcript: Transcript;
  /** Alle vorhandenen Spuren, damit die Sidebar sie zur Wahl stellen kann. */
  tracks: CaptionTrack[];
  active: CaptionTrack;
}

/** Laedt genau eine Spur – fuer den Spurwechsel in der Sidebar. */
export async function loadTrack(
  track: CaptionTrack,
  http: Http = browserHttp,
): Promise<{ transcript: Transcript; active: CaptionTrack }> {
  const cues = await fetchCues(track, http);
  if (!cues.length) throw new NoCaptionsError();

  return {
    active: track,
    transcript: {
      cues,
      lang: track.lang,
      source: track.name,
      hasTimestamps: true,
    },
  };
}

/** Eigener Typ, damit die UI „keine Untertitel“ von „Netzwerkfehler“ unterscheiden kann. */
export class NoCaptionsError extends Error {
  constructor() {
    super("NO_CAPTIONS");
    this.name = "NoCaptionsError";
  }
}

/** Video-ID aus einer YouTube-URL. Shorts liefern bewusst null – die werden nicht bedient. */
export function videoIdFromUrl(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.pathname.startsWith("/shorts/")) return null;
    if (u.pathname !== "/watch") return null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

/**
 * Video-ID aus einem geteilten Text.
 *
 * Das Teilen-Ziel der Android-App bekommt keinen sauberen Link, sondern das, was die
 * YouTube-App schickt: oft `https://youtu.be/<id>?si=…`, je nach Fassung mit dem
 * Videotitel davor. `videoIdFromUrl` greift dort nicht – es erwartet genau eine
 * `/watch`-URL. Deshalb diese zweite, groszuegigere Lesart, bewusst getrennt: im
 * Browser soll weiterhin nur die Watch-Seite zaehlen.
 *
 * Shorts liefern auch hier null – die werden nicht bedient.
 */
export function videoIdAusText(text: string): string | null {
  if (/youtube\.com\/shorts\//.test(text)) return null;
  const id = "([A-Za-z0-9_-]{11})";
  // Der Host muss wirklich der Host sein: am Textanfang, nach Leerraum oder nach `://`,
  // davor höchstens Subdomains. Sonst zählten `notyoutube.com/watch?v=…` und
  // `evil.test/youtu.be/…` als YouTube-Link (Codex, 21.09.2026).
  const vor = "(?:^|\\s|://)(?:[\\w-]+\\.)*";
  const muster = [
    new RegExp(`${vor}youtu\\.be/${id}`),
    // Lazy und ohne & im Teilausdruck: bei doppeltem v= gilt das erste, wie bei YouTube.
    new RegExp(`${vor}youtube\\.com/watch\\?(?:[^\\s&]+&)*?v=${id}`),
    new RegExp(`${vor}youtube\\.com/live/${id}`),
    new RegExp(`${vor}youtube\\.com/embed/${id}`),
  ];
  for (const m of muster) {
    const treffer = text.match(m);
    if (treffer?.[1]) return treffer[1];
  }
  return null;
}
