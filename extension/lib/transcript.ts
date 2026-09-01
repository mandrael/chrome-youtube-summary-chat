import type { CaptionTrack, Cue, Transcript } from "./types";

/**
 * Die Untertitelspuren stehen in `ytInitialPlayerResponse` im HTML der Watch-Seite.
 * Gelesen wird über einen frischen same-origin-Abruf der Seite statt über das globale
 * Objekt: bei YouTubes SPA-Navigation bleibt das globale `ytInitialPlayerResponse`
 * nicht zuverlässig auf dem Stand der gerade sichtbaren Video-ID, ein Abruf mit
 * explizitem `?v=` schon. Cookies laufen mit, also sieht die Extension genau das,
 * was der angemeldete Nutzer auch sieht.
 */
export async function fetchCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Watch-Seite: HTTP ${res.status}`);
  const html = await res.text();

  const player = extractPlayerResponse(html);
  const tracks =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  return tracks
    .filter((t) => !!t.baseUrl)
    .map(
      (t): CaptionTrack => ({
        lang: t.languageCode ?? "?",
        name: t.name?.simpleText ?? t.name?.runs?.[0]?.text ?? t.languageCode ?? "?",
        url: t.baseUrl,
        auto: t.kind === "asr",
      }),
    );
}

interface PlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
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
 * Schneidet das JSON-Objekt hinter `ytInitialPlayerResponse =` heraus. Ein Regex auf
 * `\{.*\}` wäre hier falsch, weil das Objekt selbst geschweifte Klammern und Strings
 * mit Klammern enthält – deshalb wird von der ersten Klammer an gezählt.
 */
function extractPlayerResponse(html: string): PlayerResponse | null {
  const marker = "ytInitialPlayerResponse";
  let i = html.indexOf(marker);
  while (i !== -1) {
    const brace = html.indexOf("{", i);
    if (brace !== -1) {
      const json = sliceBalanced(html, brace);
      if (json) {
        try {
          return JSON.parse(json) as PlayerResponse;
        } catch {
          /* nächstes Vorkommen probieren */
        }
      }
    }
    i = html.indexOf(marker, i + marker.length);
  }
  return null;
}

function sliceBalanced(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (inStr) {
      if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
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
  // Original bevorzugt: eine vom Kanal hochgeladene Spur schlägt die ASR-Spur.
  return tracks.find((t) => !t.auto) ?? tracks[0] ?? null;
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

export async function loadTranscript(
  videoId: string,
  captionLang: string,
): Promise<LoadResult> {
  const tracks = await fetchCaptionTracks(videoId);
  const track = pickTrack(tracks, captionLang);
  if (!track) throw new NoCaptionsError();
  return { ...(await loadTrack(track)), tracks };
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
