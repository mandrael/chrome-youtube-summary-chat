import type { CaptionTrack } from "./types";

/**
 * Zielsprachen der Übersetzung.
 *
 * Bewusst kurz und westeuropäisch geschnitten: das sind die Sprachen, in denen die
 * verwendeten Modelle verlässlich sind und die hier gebraucht werden. Ein Freitextfeld
 * stand vorher da – es liess Tippfehler zu, die still zu „de" wurden.
 */
export const ZIELSPRACHEN = [
  ["Deutsch", "de"],
  ["Englisch", "en"],
  ["Französisch", "fr"],
  ["Italienisch", "it"],
  ["Niederländisch", "nl"],
  ["Polnisch", "pl"],
  ["Portugiesisch", "pt"],
  ["Russisch", "ru"],
  ["Spanisch", "es"],
  ["Tschechisch", "cs"],
  ["Türkisch", "tr"],
  ["Ungarisch", "hu"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

/**
 * Beschriftung der Untertitelspuren.
 *
 * YouTube schreibt „auto-generated" in den Namen und die Extension hängte zusätzlich
 * „(automatisch)" an – dabei kam „German (auto-generated) (automatisch)" heraus. Die
 * Wahrheit steht im Flag `auto`, der Name wird nur noch als Notnagel gebraucht.
 */

/** YouTube schreibt den Zusatz je nach Oberflächensprache anders. */
const AUTO_IM_NAMEN =
  /\s*\((?:auto-generated|automatisch(?: erzeugt)?|automatique|automático|automatico)\)\s*/i;

/** Normiert „de_de", „ZH-hans", „pt-br" auf BCP-47-Schreibung: de-DE, zh-Hans, pt-BR. */
export function langcode(lang: string): string {
  const [basis = "", ...rest] = lang.replace(/_/g, "-").split("-");
  const teile = [basis.toLowerCase()];
  for (const sub of rest) {
    if (sub.length === 4) teile.push(sub[0]!.toUpperCase() + sub.slice(1).toLowerCase());
    else if (sub.length <= 3) teile.push(sub.toUpperCase());
    else teile.push(sub.toLowerCase());
  }
  return teile.join("-");
}

/**
 * Kürzel für den geschlossenen Zustand: „de", „pt-BR".
 * Die Region steht nur da, wo sie unterscheidet – hat das Video nur eine
 * portugiesische Spur, ist „pt" eindeutig genug.
 */
export function kurzcode(track: CaptionTrack, alle: CaptionTrack[] = []): string {
  const code = langcode(track.lang);
  const basis = code.split("-")[0];
  const mehrdeutig = alle.some((tr) => {
    const anderer = langcode(tr.lang);
    return anderer !== code && anderer.split("-")[0] === basis;
  });
  return mehrdeutig ? code : (basis ?? code);
}

/** „de (auto)" – der Zusatz kommt genau einmal, aus dem Flag, nie aus dem Namen. */
export function kurzname(track: CaptionTrack, alle: CaptionTrack[] = []): string {
  return track.auto ? `${kurzcode(track, alle)} (auto)` : kurzcode(track, alle);
}

/**
 * Ausgeschriebener Name in der Sprache der Oberfläche – „Deutsch" statt „German".
 * `Intl.DisplayNames` kennt die Sprachcodes; YouTubes Rohname bleibt der Rückfall für
 * exotische Tags.
 */
export function langname(track: CaptionTrack, uiLang = "de"): string {
  const code = langcode(track.lang);
  let name: string | undefined;
  try {
    name = new Intl.DisplayNames([uiLang], { type: "language" }).of(code);
  } catch {
    /* ungültiger Tag – Rückfall unten */
  }
  if (!name || name === code) name = track.name.replace(AUTO_IM_NAMEN, " ").trim();
  return track.auto ? `${name} (auto)` : name;
}
