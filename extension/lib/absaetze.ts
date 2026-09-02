import type { Cue } from "./types";

export interface Absatz {
  von: number;
  bis: number;
  start: number;
}

/**
 * Fasst Untertitelzeilen zu lesbaren Absätzen zusammen.
 *
 * Drei Kriterien, weil zwei Sorten Spuren vorkommen: manuelle Spuren haben Satzzeichen,
 * automatische (json3, gemessen drei bis sechs Sekunden je Zeile) haben keine.
 *
 *   1. eine Sprechpause von mindestens zwei Sekunden beendet den Absatz,
 *   2. ab 25 Sekunden beendet ihn ein Satzzeichen,
 *   3. bei 60 Sekunden ist ohnehin Schluss – das greift bei Spuren ohne Satzzeichen.
 *
 * Ergebnis sind Absätze von etwa 60 bis 150 Wörtern; in einer 400 px schmalen Spalte
 * sind das sechs bis zwölf Zeilen, also eine lesbare Einheit. Die Indizes bleiben
 * dieselben wie im Original, deshalb gilt dieselbe Einteilung für die Übersetzung.
 */
export function bildeAbsaetze(cues: Cue[]): Absatz[] {
  const out: Absatz[] = [];
  if (!cues.length) return out;
  let von = 0;
  for (let i = 1; i <= cues.length; i++) {
    const prev = cues[i - 1]!;
    const cur = cues[i];
    const dauer = prev.start + prev.dur - cues[von]!.start;
    const luecke = cur ? cur.start - (prev.start + prev.dur) : Infinity;
    const satzende = /[.!?…]["»“”)]?$/.test(prev.text.trim());
    if (!cur || luecke >= 2 || (dauer >= 25 && satzende) || dauer >= 60) {
      out.push({ von, bis: i - 1, start: cues[von]!.start });
      von = i;
    }
  }
  return out;
}
