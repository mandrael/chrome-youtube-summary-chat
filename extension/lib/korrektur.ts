/**
 * Deterministische Nacharbeit an Transkripten.
 *
 * Parakeet und YouTubes ASR verhören Eigennamen zuverlässig – aus „Claude Code" wird
 * „Cloud Code", aus „DiktaGo" wird „Dikta Go". Ein Prompt hilft dagegen nur beim
 * Chat-Modell; das Transkript selbst, das im Transkript-Tab steht und exportiert wird,
 * bliebe falsch. Also wird es vor der Anzeige korrigiert.
 *
 * Übernommen aus DiktaGo (`Data/DictionaryStore.swift`), aber bewusst nur die beiden
 * Stufen, die ohne Rechtschreibprüfung sicher sind:
 *
 *   1. Ersetzungspaare: „Cloud Code" → „Claude Code", an Wortgrenzen, Gross- und
 *      Kleinschreibung egal.
 *   2. Kanonische Schreibweise: ein Begriff ohne Ersatzwort setzt seine eigene
 *      Schreibung durch – erst gefaltet exakt („diktago" → „DiktaGo"), dann über
 *      Leerzeichen und Bindestriche hinweg („Dikta Go" → „DiktaGo").
 *
 * **Nicht übernommen sind DiktaGos Stufen 3 und 4** (ein vertauschter Buchstabe,
 * Kölner Phonetik). Sie brauchen das Realwort-Veto über NSSpellChecker – dort an 25.193
 * Wörtern gemessen: ohne Veto wird aus „Kind" ein „Contao" und aus „Bild" ein „Build".
 * Im Browser gibt es keine Rechtschreibprüfung als API, also fehlt genau die Absicherung,
 * die diese Stufen erst tragfähig macht. Wer einen Begriff gegen ein echtes Wort
 * durchsetzen will, trägt ein Ersetzungspaar ein.
 */

export interface Woerterbucheintrag {
  /** Der Begriff in seiner richtigen Schreibweise, oder das, was ersetzt werden soll. */
  begriff: string;
  /** Leer: der Begriff setzt seine eigene Schreibweise durch. Sonst: Ersatzwort. */
  ersatz?: string;
}

/** Kleinschreibung ohne Diakritika – „Fuß" und „fuss" sollen sich treffen. */
function falte(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");
}

/** Zusätzlich ohne Leerzeichen und Bindestriche: „Dikta-Go" und „dikta go" treffen sich. */
function presse(s: string): string {
  return falte(s).replace(/[\s\-_]/g, "");
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wendet das Wörterbuch auf einen Text an. Reine Funktion, damit sie auf jede einzelne
 * Untertitelzeile genauso läuft wie auf einen ganzen Fliesstext.
 */
export function korrigiere(text: string, eintraege: Woerterbucheintrag[]): string {
  if (!text || !eintraege.length) return text;
  let out = text;

  // Stufe 1: echte Ersetzungen.
  for (const e of eintraege) {
    const ersatz = e.ersatz?.trim();
    const begriff = e.begriff.trim();
    if (!ersatz || !begriff) continue;
    out = out.replace(new RegExp(`\\b${escape(begriff)}\\b`, "gi"), ersatz);
  }

  // Stufe 2: kanonische Schreibweise der Einträge ohne Ersatzwort.
  const kanonisch = eintraege
    .filter((e) => !e.ersatz?.trim() && e.begriff.trim())
    .map((e) => e.begriff.trim());
  if (!kanonisch.length) return out;

  // Erst die zusammengeschriebene Form suchen, damit „Dikta Go" als Ganzes ersetzt wird
  // und nicht vorher „Dikta" allein angefasst wird. Längste Begriffe zuerst.
  for (const begriff of [...kanonisch].sort((a, b) => b.length - a.length)) {
    const gepresst = presse(begriff);
    if (gepresst.length < 4) continue;
    // Ein Muster, das den Begriff auch mit Leerzeichen oder Bindestrichen dazwischen
    // findet: aus „DiktaGo" wird d[\s-]*i[\s-]*k…
    const teile = [...begriff.replace(/[\s\-_]/g, "")].map((c) => escape(c));
    const muster = new RegExp(`\\b${teile.join("[\\s\\-]?")}\\b`, "gi");
    out = out.replace(muster, (treffer) => (presse(treffer) === gepresst ? begriff : treffer));
  }

  return out;
}

/**
 * Die Begriffe, die im Text tatsächlich vorkommen – als Hinweis für das Chat-Modell.
 *
 * Aus DiktaGos `relevantHint` übernommen: der Prompt bleibt klein, egal wie gross das
 * Wörterbuch ist, weil nur einfliesst, was der Text auch enthält.
 */
export function schreibweisenHinweis(
  text: string,
  eintraege: Woerterbucheintrag[],
  grenze = 60,
): string {
  if (!text || !eintraege.length) return "";
  const gefaltet = falte(text);
  const treffer: string[] = [];
  const gesehen = new Set<string>();
  for (const e of eintraege) {
    const wort = (e.ersatz?.trim() || e.begriff.trim());
    if (!wort || gesehen.has(wort.toLowerCase())) continue;
    gesehen.add(wort.toLowerCase());
    if (gefaltet.includes(falte(wort))) {
      treffer.push(wort);
      if (treffer.length >= grenze) break;
    }
  }
  if (!treffer.length) return "";
  return `\n\nSchreibe diese Namen exakt so:\n${treffer.map((w) => `- ${w}`).join("\n")}`;
}
