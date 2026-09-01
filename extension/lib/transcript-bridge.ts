import { NoCaptionsError } from "./transcript";
import type { CaptionTrack, Transcript } from "./types";

/**
 * Holt das Transkript über das Content-Script des YouTube-Tabs.
 *
 * Warum nicht direkt aus der Seitenleiste: der Player-Aufruf gegen
 * `/youtubei/v1/player` bekommt von einer Extension-Seite aus HTML statt JSON zurück –
 * gemessen, nicht vermutet. YouTube beantwortet ihn nur, wenn er von einer eigenen Seite
 * kommt. Das Content-Script läuft dort, also holt es die Daten und reicht sie weiter.
 *
 * Für den DOM-Rückfall gilt dasselbe aus einem zweiten Grund: er liest YouTubes
 * Transkript-Panel und braucht dafür überhaupt einen DOM.
 */
export interface BridgeResult {
  transcript: Transcript;
  tracks: CaptionTrack[];
  /** Die tatsächlich verwendete Spur, soweit bekannt. */
  active?: CaptionTrack;
}

export async function loadTranscriptViaTab(
  tabId: number,
  captionLang: string,
): Promise<BridgeResult> {
  return frage(tabId, { type: "loadTranscript", captionLang });
}

export async function loadTrackViaTab(
  tabId: number,
  track: CaptionTrack,
): Promise<BridgeResult> {
  return frage(tabId, { type: "loadTrack", track });
}

async function frage(tabId: number, msg: unknown): Promise<BridgeResult> {
  let antwort: {
    ok?: boolean;
    error?: string;
    noCaptions?: boolean;
    transcript?: Transcript;
    tracks?: CaptionTrack[];
    active?: CaptionTrack;
  };
  try {
    antwort = await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    throw new Error(
      "Die YouTube-Seite antwortet nicht. Lade den Tab neu und öffne die Seitenleiste erneut.",
    );
  }

  if (!antwort?.ok) {
    if (antwort?.noCaptions) throw new NoCaptionsError();
    throw new Error(antwort?.error ?? "Unbekannter Fehler beim Laden des Transkripts.");
  }
  return {
    transcript: antwort.transcript!,
    tracks: antwort.tracks ?? [],
    active: antwort.active,
  };
}
