import type { Cue, Transcript } from "./types";

/** Sekunden nach [mm:ss] bzw. [hh:mm:ss], wenn das Video über einer Stunde liegt. */
export function formatTs(seconds: number, withHours: boolean): string {
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return withHours ? `${p(hh)}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
}

/**
 * Findet [mm:ss] und [hh:mm:ss] in einem Text. Bewusst auf eckige Klammern beschränkt:
 * ein Regex auf blanke Zahlenpaare würde Preise, Versionsnummern und Messwerte
 * zerschiessen, und genau die sollen laut System-Prompt unangetastet bleiben.
 */
export const TS_PATTERN = /\[(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\]/g;

/** Wandelt einen Treffer von TS_PATTERN in Sekunden. Gibt null bei Unsinn zurück. */
export function tsToSeconds(
  a: string | undefined,
  b: string | undefined,
  c?: string,
): number | null {
  if (a === undefined || b === undefined) return null;
  const n1 = Number(a);
  const n2 = Number(b);
  if (!Number.isFinite(n1) || !Number.isFinite(n2)) return null;
  if (c === undefined) return n1 * 60 + n2; // mm:ss
  const n3 = Number(c);
  if (!Number.isFinite(n3)) return null;
  return n1 * 3600 + n2 * 60 + n3; // hh:mm:ss
}

/**
 * Serialisiert das Transkript für den Modell-Kontext. Ungekürzt, kein Chunking –
 * die Modelle in der Liste fassen mindestens 128k Token, die Default-Modelle 1M.
 */
export function transcriptToText(t: Transcript): string {
  if (!t.hasTimestamps) return t.cues.map((c) => c.text).join(" ").trim();
  const last = t.cues.at(-1);
  const withHours = (last ? last.start + last.dur : 0) >= 3600;
  return t.cues
    .map((c) => `[${formatTs(c.start, withHours)}] ${c.text}`)
    .join("\n");
}

/** Zeilenweise Cues für die lokale Chrome-Übersetzung: nur `text` geht durchs Modell. */
export function replaceCueTexts(t: Transcript, texts: string[]): Transcript {
  return { ...t, cues: t.cues.map((c, i): Cue => ({ ...c, text: texts[i] ?? c.text })) };
}
