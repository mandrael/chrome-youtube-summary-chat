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

/**
 * Stufe 3: Leseabsätze ohne Zeitmarken.
 *
 * Baut auf den Absätzen von `bildeAbsaetze` auf, damit die Grenzen ineinanderliegen und
 * ein Wechsel der Ansicht nicht den Ort verliert. Gezählt wird in **Wörtern**, nicht in
 * Sekunden: wie lang ein Absatz auf dem Bildschirm wirkt, hängt an der Wortzahl, nicht
 * an der Sprechgeschwindigkeit.
 *
 *   – Zusammenfassen bis 150 Wörter, dann an der nächsten Absatzgrenze schliessen.
 *   – Früher schliessen, wenn dort eine Sprechpause von mindestens drei Sekunden lag
 *     und der Block schon 50 Wörter hat – das ist die Stelle, an der ein Gedanke endet.
 *
 * Geschnitten wird nur an bestehenden Absatzgrenzen; eine harte Wortobergrenze braucht
 * es nicht, weil ein Absatz der Stufe 2 bei 60 Sekunden ohnehin endet.
 *
 * An einem 17-Minuten-Interview werden aus 218 Cues und 36 Absätzen etwa zwölf bis
 * fünfzehn Leseabsätze.
 */
export function bildeLeseabsaetze(cues: Cue[], absaetze: Absatz[]): Absatz[] {
  const out: Absatz[] = [];
  let von = 0;
  let woerter = 0;
  for (let a = 0; a < absaetze.length; a++) {
    const abs = absaetze[a]!;
    for (let i = abs.von; i <= abs.bis; i++) woerter += zaehleWoerter(cues[i]?.text ?? "");
    const naechster = absaetze[a + 1];
    const letzterCue = cues[abs.bis]!;
    const pause = naechster
      ? cues[naechster.von]!.start - (letzterCue.start + letzterCue.dur)
      : Infinity;
    const schliessen =
      !naechster || woerter >= 150 || (pause >= 3 && woerter >= 50);
    if (schliessen) {
      out.push({ von, bis: abs.bis, start: cues[von]!.start });
      von = naechster?.von ?? abs.bis + 1;
      woerter = 0;
    }
  }
  return out;
}

function zaehleWoerter(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
