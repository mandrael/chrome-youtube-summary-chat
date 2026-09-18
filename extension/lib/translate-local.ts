import type { Transcript } from "@shared/lib/types";

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
    signal?: AbortSignal;
  }): Promise<{
    translate(text: string, o?: { signal?: AbortSignal }): Promise<string>;
    destroy?(): void;
  }>;
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

/**
 * Lädt das Sprachmodell für ein Paar herunter und meldet den Fortschritt.
 *
 * Muss aus einem Klick heraus aufgerufen werden: solange der Zustand `downloadable`
 * ist, verlangt `create()` eine Nutzergeste, und jedes `await` davor verbraucht sie.
 * Gemessen: rund 160 s für das erste Paar.
 */
export async function downloadModel(
  source: string,
  target: string,
  onProgress?: (anteil: number) => void,
): Promise<void> {
  if (!isSupported()) throw new Error("Translator API nicht vorhanden");
  const t = await Translator!.create({
    sourceLanguage: source,
    targetLanguage: target,
    monitor: (m) =>
      m.addEventListener("downloadprogress", (e) =>
        onProgress?.((e as ProgressEvent).loaded),
      ),
  });
  // Ein Probelauf stellt sicher, dass das Modell wirklich einsatzbereit ist – der
  // Zustand springt sonst je nach Zeitpunkt zwischen „downloading" und „available".
  await t.translate("ok");
  t.destroy?.();
}

export interface LocalTranslateOptions {
  source: string;
  target: string;
  /** Jede fertige Zeile sofort – die Ansicht läuft mit, und ein Abbruch verliert nichts. */
  onCue?: (index: number, text: string) => void;
  onProgress?: (done: number, total: number) => void;
  onDownload?: (loaded: number) => void;
  signal?: AbortSignal;
  /** Fortsetzen ab diesem Index (0 = von vorn). */
  from?: number;
}

export interface LocalTranslateResult {
  /** Übersetzte Zeilen in Cue-Reihenfolge; ab `done` steht null. */
  texts: (string | null)[];
  /** Zahl der zusammenhängend übersetzten Zeilen ab Anfang. */
  done: number;
  aborted: boolean;
}

function istAbbruch(e: unknown): boolean {
  return (e as DOMException | undefined)?.name === "AbortError";
}

/**
 * Übersetzt die Zeilen eines Transkripts.
 *
 * **Abbruch ist hier kein Fehler, sondern ein Ergebnis**: `aborted: true` mit dem Stand
 * bis `done`. Das `signal` geht in `create()` – damit bricht auch der Modell-Download ab,
 * der rund 160 s dauert – und in jeden einzelnen `translate()`-Aufruf, sodass der
 * laufende sofort abgewiesen wird und nicht erst die Zeile zu Ende übersetzt.
 *
 * Vorher lief die Schleife nach einem Abbruch weiter: der Stopp-Knopf der Sidebar hing
 * an einer Referenz, die nur der OpenRouter-Weg setzte, und dieser Zweig hatte gar keine.
 */
export async function translateTranscript(
  t: Transcript,
  o: LocalTranslateOptions,
): Promise<LocalTranslateResult> {
  if (!isSupported()) throw new Error("Translator API nicht verfügbar.");

  const total = t.cues.length;
  const from = Math.max(0, Math.min(o.from ?? 0, total));
  const texts: (string | null)[] = new Array<string | null>(total).fill(null);
  if (o.signal?.aborted) return { texts, done: from, aborted: true };

  // Erster await überhaupt – die Nutzergeste muss bis hierher durchhalten.
  let translator: Awaited<ReturnType<NonNullable<typeof Translator>["create"]>>;
  try {
    translator = await Translator!.create({
      sourceLanguage: o.source,
      targetLanguage: o.target,
      signal: o.signal,
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          o.onDownload?.((e as ProgressEvent).loaded);
        });
      },
    });
  } catch (e) {
    if (istAbbruch(e)) return { texts, done: from, aborted: true };
    throw e;
  }

  let done = from;
  try {
    for (let i = from; i < total; i++) {
      const quelle = t.cues[i]!.text;
      let text: string;
      try {
        text = quelle.trim()
          ? await translator.translate(quelle, { signal: o.signal })
          : quelle;
      } catch (e) {
        if (istAbbruch(e)) return { texts, done, aborted: true };
        throw e;
      }
      texts[i] = text;
      done = i + 1;
      o.onCue?.(i, text);
      o.onProgress?.(done, total);
    }
    return { texts, done, aborted: false };
  } finally {
    translator.destroy?.();
  }
}
