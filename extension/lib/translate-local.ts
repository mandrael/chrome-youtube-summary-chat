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
 *
 * Reihenfolge ist wichtig: solange das Sprachmodell noch nicht geladen ist, verlangt
 * `Translator.create()` eine Nutzergeste. Real gemessen (01.09.2026):
 * *„NotAllowedError: Requires a user gesture when availability is 'downloading' or
 * 'downloadable'."* Jedes `await` vor dem Aufruf verbraucht die Geste des Klicks –
 * deshalb ist `create()` in `translateTranscript` die erste Anweisung, und der Aufrufer
 * darf davor nichts abwarten.
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


/**
 * Übersetzt Markdown, ohne die Auszeichnung zu zerstören.
 *
 * Die Translator API bekommt reinen Text und gibt reinen Text zurück – wirft man ihr
 * eine ganze Markdown-Antwort hin, kommen Überschriften, Listenpunkte und Zeitstempel
 * verändert oder gar nicht zurück. Deshalb geht hier jede Zeile einzeln durch, und der
 * strukturtragende Anfang der Zeile bleibt unangetastet:
 *
 *   `## Kapitel`     → `## ` bleibt, nur „Kapitel" wird übersetzt
 *   `- [02:13] Text` → `- [02:13] ` bleibt, nur „Text" wird übersetzt
 *   ` ```js `        → Codeblöcke werden komplett übersprungen
 *
 * Damit ist Formattreue strukturell garantiert statt nur erbeten.
 */
const ZEILENPRAEFIX =
  /^(\s*(?:[-*+]\s+|\d+[.)]\s+|>\s*|#{1,6}\s+)?(?:\[\d{1,2}:\d{2}(?::\d{2})?\]\s*)?)/;

export async function translateMarkdown(
  text: string,
  o: LocalTranslateOptions,
): Promise<string> {
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
    const zeilen = text.split("\n");
    const aus: string[] = [];
    let imCodeblock = false;

    for (const [i, zeile] of zeilen.entries()) {
      if (o.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");

      if (/^\s*```/.test(zeile)) {
        imCodeblock = !imCodeblock;
        aus.push(zeile);
        continue;
      }
      // Code, Trennlinien und Leerzeilen bleiben, wie sie sind.
      if (imCodeblock || !zeile.trim() || /^\s*([-*_])\1{2,}\s*$/.test(zeile)) {
        aus.push(zeile);
        continue;
      }

      const praefix = zeile.match(ZEILENPRAEFIX)?.[1] ?? "";
      const rest = zeile.slice(praefix.length);
      aus.push(rest.trim() ? praefix + (await translator.translate(rest)) : zeile);

      if (i % 10 === 0) o.onProgress?.(i + 1, zeilen.length);
    }
    o.onProgress?.(zeilen.length, zeilen.length);
    return aus.join("\n");
  } finally {
    translator.destroy?.();
  }
}
