import type { Cue, SttRoute, Transcript } from "./types";

/**
 * Native-Messaging-Brücke zum lokalen Audio-Fallback.
 *
 * Diese Datei wird ausschliesslich aus einem `if (__FALLBACK__)`-Zweig importiert und
 * ist im Store-Build damit nicht erreichbar. Der Beweis dafür ist der grep-Test in
 * `scripts/verify-store-bundle.sh`, nicht dieser Kommentar.
 *
 * Warum der Host alles macht und nicht nur herunterlädt: Native Messaging begrenzt eine
 * Nachricht auf 1 MB. Base64-Audio sprengt das bei jedem Video, das länger als ein paar
 * Sekunden ist. Über den Kanal geht deshalb nur fertiger Text.
 */
export const HOST_NAME = "at.gasperl.youtube_summary_chat";

export interface FallbackProgress {
  stage: "start" | "download" | "convert" | "transcribe" | "done" | "error";
  message: string;
  percent?: number;
}

interface HostResponse {
  type: "progress" | "result" | "error";
  stage?: FallbackProgress["stage"];
  message?: string;
  percent?: number;
  /** Segmente mit Zeitstempeln, wenn die Route welche liefert. */
  segments?: Array<{ start?: number; end?: number; text?: string }>;
  /** Reiner Text, wenn nicht. */
  text?: string;
  route?: string;
}

export interface FallbackRequest {
  videoId: string;
  /** "subtitles" ist der billige Weg und wird zuerst angeboten. */
  route: SttRoute | "subtitles";
  /** Nur für die beiden OpenRouter-Routen; der Host hält keinen eigenen Key. */
  apiKey?: string;
  language?: string;
}

/** Pingt den Host. Liefert die Version oder den Fehlertext für die Statusanzeige. */
export async function pingHost(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = (await chrome.runtime.sendNativeMessage(HOST_NAME, {
      type: "ping",
    })) as { version?: string; tools?: Record<string, boolean> };

    const missing = Object.entries(res.tools ?? {})
      .filter(([, present]) => !present)
      .map(([name]) => name);

    if (missing.length) {
      return { ok: false, detail: `Host läuft, aber es fehlen: ${missing.join(", ")}` };
    }
    return { ok: true, detail: `Host ${res.version ?? "?"} erreichbar` };
  } catch (e) {
    return { ok: false, detail: String((e as Error)?.message ?? e) };
  }
}

/**
 * Startet die Transkription. Läuft über einen Port statt über sendNativeMessage, weil
 * der Vorgang Minuten dauert und Zwischenstände melden soll.
 */
export function runFallback(
  req: FallbackRequest,
  onProgress: (p: FallbackProgress) => void,
): { promise: Promise<Transcript>; cancel: () => void } {
  const port = chrome.runtime.connectNative(HOST_NAME);
  let settled = false;

  const promise = new Promise<Transcript>((resolve, reject) => {
    port.onMessage.addListener((raw: unknown) => {
      const msg = raw as HostResponse;

      if (msg.type === "progress") {
        onProgress({
          stage: msg.stage ?? "transcribe",
          message: msg.message ?? "",
          percent: msg.percent,
        });
        return;
      }

      if (msg.type === "error") {
        settled = true;
        reject(new Error(msg.message ?? "Unbekannter Fehler im Native-Host"));
        port.disconnect();
        return;
      }

      if (msg.type === "result") {
        settled = true;
        resolve(toTranscript(msg));
        port.disconnect();
      }
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      const err = chrome.runtime.lastError?.message;
      reject(
        new Error(
          err
            ? `Native-Host nicht erreichbar: ${err}`
            : "Native-Host hat die Verbindung ohne Ergebnis beendet.",
        ),
      );
    });

    port.postMessage({ type: "transcribe", ...req });
  });

  return { promise, cancel: () => port.disconnect() };
}

/**
 * Ein Parser für alle Routen: Segmente mit Zeitstempeln und reiner Plaintext werden
 * gleichermassen verkraftet. Fehlen Zeitstempel, sagt `hasTimestamps: false` das
 * ehrlich weiter – die UI bietet dann keine Sprungmarken an.
 */
export function toTranscript(msg: HostResponse): Transcript {
  const route = msg.route ?? "Audio-Fallback";

  const segs = msg.segments ?? [];
  const timed = segs.filter(
    (s) => typeof s.start === "number" && typeof s.text === "string" && s.text.trim(),
  );

  if (timed.length) {
    const cues: Cue[] = timed.map((s) => ({
      start: s.start as number,
      dur: typeof s.end === "number" ? Math.max(0, s.end - (s.start as number)) : 0,
      text: (s.text as string).trim(),
    }));
    return { cues, source: route, hasTimestamps: true };
  }

  const text = (msg.text ?? segs.map((s) => s.text ?? "").join(" ")).trim();
  if (!text) throw new Error("Der Native-Host hat kein Transkript geliefert.");

  return {
    cues: [{ start: 0, dur: 0, text }],
    source: route,
    hasTimestamps: false,
  };
}
