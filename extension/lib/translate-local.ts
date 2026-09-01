import type { Transcript } from "./types";
import { replaceCueTexts } from "./timestamps";

/**
 * Chromes eingebaute Translator API (stabil ab Chrome 138). Läuft auf dem Gerät, kostet
 * nichts und schickt nichts an einen Anbieter.
 *
 * Wichtig: die API ist in Web Workers nicht verfügbar, also auch nicht im Service Worker
 * einer MV3-Extension. Dieser Code gehört ins Content-Script.
 *
 * Übersetzt wird pro Untertitelzeile. Dadurch bleibt der Zeitstempel strukturell
 * unangetastet – anders als beim Modellweg kann hier gar nichts verrutschen.
 */

// Die API steht (noch) nicht in @types/chrome.
declare const Translator: {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
  create(o: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<{ translate(text: string): Promise<string>; destroy?(): void }>;
} | undefined;

type Availability = "unavailable" | "downloadable" | "downloading" | "available";

export function isSupported(): boolean {
  return typeof self !== "undefined" && "Translator" in self;
}

export async function availability(
  source: string,
  target: string,
): Promise<Availability> {
  if (!isSupported()) return "unavailable";
  try {
    return await Translator!.availability({
      sourceLanguage: source,
      targetLanguage: target,
    });
  } catch {
    return "unavailable";
  }
}

/** BCP-47-Sprachcode auf die Basissprache kürzen: "de-AT" → "de". */
export function baseLang(code: string | undefined): string {
  return ((code ?? "").split("-")[0] ?? "").toLowerCase();
}

export interface LocalTranslateOptions {
  source: string;
  target: string;
  onProgress?: (done: number, total: number) => void;
  onDownload?: (loaded: number) => void;
  signal?: AbortSignal;
}

export async function translateTranscript(
  t: Transcript,
  o: LocalTranslateOptions,
): Promise<Transcript> {
  if (!isSupported()) throw new Error("Translator API nicht verfügbar.");

  const translator = await Translator!.create({
    sourceLanguage: o.source,
    targetLanguage: o.target,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        o.onDownload?.((e as ProgressEvent).loaded);
      });
    },
  });

  try {
    const out: string[] = [];
    for (const [i, cue] of t.cues.entries()) {
      if (o.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
      out.push(await translator.translate(cue.text));
      // Die API arbeitet sequenziell; ein Fortschrittsbalken ist bei langen
      // Transkripten der Unterschied zwischen "hängt" und "läuft".
      if (i % 10 === 0) o.onProgress?.(i + 1, t.cues.length);
    }
    o.onProgress?.(t.cues.length, t.cues.length);

    return {
      ...replaceCueTexts(t, out),
      source: `${t.source} → ${o.target} (Chrome, lokal)`,
    };
  } finally {
    translator.destroy?.();
  }
}
