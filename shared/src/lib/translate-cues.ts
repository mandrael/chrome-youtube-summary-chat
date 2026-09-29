import type { Cue, ReasoningEffort, StreamArgs, StreamHandle } from "./types";

/**
 * Übersetzt Untertitelzeilen über OpenRouter – zeilenweise, mit Indexanker.
 *
 * Ein ganzes Transkript in einem Stück zu übersetzen war der falsche Weg: die Antwort
 * landete als 22-kB-Markdown-Block im Chat, mit den Zeitstempeln mitten im Fliesstext.
 * Hier bekommt das Modell nummerierte Zeilen zurück, jede Zeile geht an ihre Cue, und
 * die Zeitspalte bleibt, wo sie hingehört.
 *
 * Die Nummer statt des Zeitstempels als Anker: zwei Cues können dieselbe Sekunde tragen,
 * zwei Indizes nie.
 */

const BLOCK = 150;

export interface CueTranslateOptions {
  model: string;
  supportsReasoning: boolean;
  reasoning: ReasoningEffort;
  targetName: string;
  /** Fortsetzen ab diesem Index. */
  from?: number;
  signal: AbortSignal;
  onCue: (index: number, text: string) => void;
  /**
   * Wie ein Chat-Strom gestartet wird – in der Erweiterung `startChat` über den Port zum
   * Service Worker, in der App der direkte Aufruf. Injiziert statt importiert, weil diese
   * Datei sonst die einzige im geteilten Kern wäre, die `chrome.runtime` kennt.
   */
  stream: (args: StreamArgs) => StreamHandle;
}

export async function translateCuesViaOpenRouter(
  cues: Cue[],
  o: CueTranslateOptions,
): Promise<{ done: number; aborted: boolean }> {
  const system =
    `Du übersetzt Untertitelzeilen nach ${o.targetName}. Jede Eingabezeile beginnt mit ` +
    `"#<Nummer> ". Gib jede Zeile einzeln zurück, mit exakt derselben Nummer am Anfang, ` +
    `in derselben Reihenfolge, ohne Zeilen zu verschmelzen, wegzulassen oder ` +
    `hinzuzufügen. Keine Erklärungen, kein Markdown, keine Anführungszeichen.`;

  let done = o.from ?? 0;
  for (let von = done; von < cues.length; von += BLOCK) {
    if (o.signal.aborted) return { done, aborted: true };
    const bis = Math.min(von + BLOCK, cues.length);
    const eingabe = cues
      .slice(von, bis)
      .map((c, k) => `#${von + k} ${c.text}`)
      .join("\n");

    let puffer = "";
    let letzte = -1;
    const zeile = (z: string) => {
      const m = z.match(/^#(\d+)\s*(.*)$/);
      if (m) {
        letzte = Number(m[1]);
        if (letzte >= von && letzte < bis) o.onCue(letzte, (m[2] ?? "").trim());
      } else if (letzte >= 0 && z.trim()) {
        // Das Modell hat mitten in einer Zeile umgebrochen: an die letzte anhängen.
        o.onCue(letzte, z.trim());
      }
    };

    const handle = o.stream({
      model: o.model,
      supportsReasoning: o.supportsReasoning,
      reasoning: o.reasoning,
      system,
      messages: [{ role: "user", content: eingabe }],
      onDelta: (d) => {
        puffer += d;
        let nl: number;
        while ((nl = puffer.indexOf("\n")) >= 0) {
          zeile(puffer.slice(0, nl));
          puffer = puffer.slice(nl + 1);
        }
      },
      onUsage: () => {},
    });
    const abbruch = () => handle.stop();
    o.signal.addEventListener("abort", abbruch, { once: true });
    try {
      await handle.done;
    } finally {
      o.signal.removeEventListener("abort", abbruch);
    }
    if (puffer.trim()) zeile(puffer);
    if (o.signal.aborted) return { done, aborted: true };
    done = bis;
  }
  return { done, aborted: false };
}
