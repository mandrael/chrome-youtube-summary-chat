/**
 * Dislikes schätzen, wenn es keine echten Zahlen gibt – aus Aufrufen und Likes.
 *
 * Gelernt am YouTube-Dislike-Archiv von Ende 2021, der letzten Zeit mit echten Zahlen
 * (archive.org, von ClickHouse in S3 gespiegelt): 46 849 Videos mit mindestens 1000
 * Aufrufen und 50 Stimmen, geprüft an 41 888 anderen (docs/messungen.md, 29.09.2026).
 * Der Dislike-Anteil fällt steil mit der Like-Rate: bei 0,1 % Likes je Aufruf rund
 * 20 %, bei 10 % rund 1,4 %. Die Formel ist eine Gerade im Logit, gelegt durch die
 * Mediane je Stufe von 0,1 in log10(Like-Rate), gewichtet mit der Zahl der Videos:
 *
 *   logit(Dislike-Anteil) = −5,6911 − 1,3943 · log10(Likes / Aufrufe)
 *
 * Güte an den Prüfdaten: Anteil im Median 1,9 Prozentpunkte daneben (mit einem festen
 * Anteil für alle: 2,3), die Dislike-Zahl in 59 % der Fälle auf Faktor 2 genau, in 38 %
 * auf Faktor 1,5 – so gut wie die ganze Stufentabelle. Verworfen: die Gerade nach
 * kleinsten Quadraten über alle Videos (Videos ohne jeden Dislike ziehen sie nach unten,
 * 57 % auf Faktor 2) und die Aufrufzahl als zweite Grösse (verbesserte nichts). Eine
 * grobe Schätzung, die UI sagt das.
 */
export function schaetzeDislikes(aufrufe: number, likes: number): number | null {
  if (!(aufrufe > 0) || !(likes > 0) || likes > aufrufe) return null;
  const logit = -5.6911 - 1.3943 * Math.log10(likes / aufrufe);
  // Dislikes / Likes = Anteil / (1 − Anteil) = e^logit.
  return Math.round(likes * Math.exp(logit));
}

/** Anteil der Likes an allen Bewertungen; null ohne Bewertungen. */
export function anteilPositiv(likes: number, dislikes: number): number | null {
  const summe = likes + dislikes;
  return summe > 0 ? likes / summe : null;
}

/** Die erste ganze Zahl in einem Text, Tausendertrenner jeder Sprache entfernt. */
export function ganzeZahl(text: string | null | undefined): number | null {
  const m = text?.match(/\d[\d.,  ' ]*/);
  if (!m) return null;
  const n = Number(m[0].replace(/\D/g, ""));
  return Number.isFinite(n) ? n : null;
}
