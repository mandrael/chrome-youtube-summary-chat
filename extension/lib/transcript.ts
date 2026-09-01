import type { CaptionTrack, Cue, Transcript } from "./types";

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

export async function fetchCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Watch-Seite: HTTP ${res.status}`);
  const html = await res.text();

  const visitorData = html.match(/"visitorData":"([^"]+)"/)?.[1];
  const sts = await signatureTimestamp(html);

  const player = await fetchPlayerVisionOs(videoId, visitorData, sts);
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
async function signatureTimestamp(html: string): Promise<number | undefined> {
  const jsUrl = html.match(/"jsUrl":"([^"]+base\.js)"/)?.[1];
  if (!jsUrl) return undefined;
  try {
    const r = await fetch(jsUrl.startsWith("http") ? jsUrl : `https://www.youtube.com${jsUrl}`);
    if (!r.ok) return undefined;
    const js = await r.text();
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
): Promise<PlayerResponse | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Youtube-Client-Name": "101",
    "X-Youtube-Client-Version": "1.02",
  };
  if (visitorData) headers["X-Goog-Visitor-Id"] = visitorData;

  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    credentials: "include",
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
  return (await res.json()) as PlayerResponse;
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


/** Wählt die Spur nach Einstellung: "auto" = erste nicht-automatische, sonst Sprachcode. */
export function pickTrack(tracks: CaptionTrack[], want: string): CaptionTrack | null {
  if (!tracks.length) return null;
  if (want !== "auto") {
    const exact = tracks.find((t) => t.lang === want && !t.auto);
    if (exact) return exact;
    const any = tracks.find((t) => t.lang === want);
    if (any) return any;
  }
  // YouTubes eigene Vorauswahl zuerst – bei 31 Community-Spuren ist alles andere Raten.
  // Danach: eine vom Kanal hochgeladene Spur schlägt die ASR-Spur.
  return (
    tracks.find((t) => t.standard) ?? tracks.find((t) => !t.auto) ?? tracks[0] ?? null
  );
}

export async function fetchCues(track: CaptionTrack): Promise<Cue[]> {
  const url = new URL(track.url);
  url.searchParams.set("fmt", "json3");

  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(`Untertitel: HTTP ${res.status}`);
  const body = await res.text();
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

/**
 * Zuerst der direkte Abruf, dann YouTubes eigenes Transkript-Panel.
 *
 * Der direkte Weg steht bewusst vorne, obwohl er am 01.09.2026 leer zurückkam: er ist
 * unabhängig von YouTubes DOM und würde sofort wieder greifen. Der Panel-Weg ist der
 * Rückfall, der heute tatsächlich trägt.
 */
export async function loadTranscript(
  videoId: string,
  captionLang: string,
): Promise<LoadResult> {
  let direkt: Error | null = null;
  try {
    const tracks = await fetchCaptionTracks(videoId);
    const track = pickTrack(tracks, captionLang);
    if (track) return { ...(await loadTrack(track)), tracks };
    direkt = new NoCaptionsError();
  } catch (e) {
    direkt = e as Error;
  }

  const { readTranscriptPanel } = await import("./transcript-panel");
  try {
    return await readTranscriptPanel(captionLang);
  } catch (panelFehler) {
    // Beide Wege leer. Kein Platzhalter, kein Ersatztext – aber auch keine Meldung,
    // die verschweigt, woran es lag.
    if (direkt instanceof NoCaptionsError) throw new NoCaptionsError();
    throw new Error(
      `Transkript nicht verfügbar.\n` +
        `Direkter Abruf: ${direkt?.message ?? "kein Ergebnis"}\n` +
        `YouTube-Panel: ${(panelFehler as Error)?.message ?? panelFehler}`,
    );
  }
}

/** Laedt genau eine Spur – fuer den Spurwechsel in der Sidebar. */
export async function loadTrack(
  track: CaptionTrack,
): Promise<{ transcript: Transcript; active: CaptionTrack }> {
  const cues = await fetchCues(track);
  if (!cues.length) throw new NoCaptionsError();

  return {
    active: track,
    transcript: {
      cues,
      lang: track.lang,
      source: `${track.name}${track.auto ? " (automatisch)" : ""}`,
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
