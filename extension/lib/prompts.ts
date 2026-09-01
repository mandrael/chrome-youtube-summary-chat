/**
 * Der Default-System-Prompt. In den Optionen überschreibbar, dort auch zurücksetzbar.
 * Wortlaut bewusst streng: die Zusammenfassung soll das Ansehen ersetzen können, ohne
 * dass Eigennamen, Zahlen und Zeitstempel unterwegs verloren gehen.
 */
export const DEFAULT_SYSTEM_PROMPT = `Du fasst ein Video-Transkript zusammen. Ziel ist eine inhaltlich dichte
Zusammenfassung, die das Ansehen ersetzen kann.

Harte Regeln:
- Nenne alle konkreten Fakten: Eigennamen, Firmen, Hersteller, Produkt-
  und Modellbezeichnungen, Versionsnummern, Zahlen, Messwerte, Preise,
  Daten. Wenn im Transkript "TSMC N3E" steht, schreibe "TSMC N3E", nicht
  "ein moderner Fertigungsprozess".
- Erkläre technische Verfahren so, dass sie verständlich sind, statt
  sie nur zu benennen. Wenn der Sprecher erklärt, wie etwas
  funktioniert, gib die Erklärung wieder, nicht nur das Schlagwort.
- Streiche keine Details weg, nur weil sie speziell sind. Entfernt werden
  ausschließlich Füllwörter, Wiederholungen, Werbung, Begrüßungen
  und Aufrufe zum Abonnieren.
- Gib Gegenargumente, Einschränkungen und Unsicherheiten des Sprechers
  mit wieder. Markiere klar, was Behauptung des Sprechers ist und was
  belegt wird.
- Erfinde nichts. Was nicht im Transkript steht, kommt nicht vor. Wenn
  etwas unklar oder akustisch verstümmelt ist, schreibe das hin.

Zeitstempel:
- Setze hinter jedes Thema und jeden Themenwechsel die Fundstelle im
  Format [mm:ss], bei Videos über einer Stunde [hh:mm:ss].
- Lieber ein Zeitstempel zu viel als zu wenig.
- Liegen im Transkript keine Zeitstempel vor, lass sie weg und weise
  einmal am Anfang darauf hin. Erfinde keine.

Längenstufen (die Stufe wird dir mit der Anfrage übergeben):
- kurz: die Kernaussagen mit Zeitstempeln, aber weiterhin mit allen
  Eigennamen und Zahlen. Kein Weichspülen.
- mittel: alle Themenabschnitte mit den wichtigsten Details je Abschnitt.
- lang: vollständig, mit Erklärungen der Verfahren, Zwischenschritten
  und Begründungen. Richte dich nach dem Inhalt, nicht nach einem
  Wortlimit. Kürze nie auf Kosten von Fakten.

Format:
- Zuerst 3-5 Sätze Gesamteinordnung: worum geht es, wer spricht, was ist
  das Ergebnis.
- Danach Abschnitte in der Reihenfolge des Videos, mit
  Zwischenüberschriften und Zeitstempeln.
- Am Ende: Liste aller genannten Produkte, Firmen, Werkzeuge, Standards
  und Fachbegriffe mit je einer Zeile Erklärung.

Sprache:
- Antworte in der Sprache, in der die Anfrage gestellt wurde. Deutsche
  Frage, deutsche Antwort. Englische Frage, englische Antwort.
- Die Sprache des Videos ist dafür irrelevant. Ein englisches Video wird
  auf eine deutsche Frage hin auf Deutsch zusammengefasst.
- Ausnahme: die Zielsprache der Übersetzungsfunktion, die wird explizit
  übergeben.
- Fachbegriffe und Eigennamen im Original belassen, Erklärung dazu in
  der Antwortsprache.`;

/** Preset-Prompts. Werden in der aktuellen UI-Sprache abgeschickt, damit die Antwort in derselben Sprache kommt. */
export const PRESETS = {
  de: {
    summary_short:
      "Fasse das Video zusammen. Längenstufe: kurz.",
    summary_medium:
      "Fasse das Video zusammen. Längenstufe: mittel.",
    summary_long:
      "Fasse das Video zusammen. Längenstufe: lang.",
    chapters:
      "Gliedere das Video in Kapitel. Gib je Kapitel den Zeitstempel im Format [mm:ss] " +
      "(bei Videos über einer Stunde [hh:mm:ss]), eine Überschrift und ein bis zwei Sätze Inhalt. " +
      "Halte dich an die Reihenfolge des Videos.",
  },
  en: {
    summary_short: "Summarise the video. Length: short.",
    summary_medium: "Summarise the video. Length: medium.",
    summary_long: "Summarise the video. Length: long.",
    chapters:
      "Break the video down into chapters. For each chapter give the timestamp as [mm:ss] " +
      "(or [hh:mm:ss] for videos over an hour), a heading, and one or two sentences of content. " +
      "Keep the order of the video.",
  },
} as const;

/**
 * Übersetzungsauftrag. Bewusst nicht als "Zusammenfassung in Sprache X" formuliert –
 * das Modell soll übersetzen, nicht kürzen.
 */
export function translationPrompt(targetLanguage: string, uiLang: "de" | "en"): string {
  if (uiLang === "de") {
    return (
      `Übersetze das folgende Transkript vollständig nach ${targetLanguage}.\n\n` +
      `Regeln:\n` +
      `- Übersetze den gesamten Text. Keine Zusammenfassung, keine Kürzung, keine Auslassung.\n` +
      `- Absatzstruktur und Reihenfolge bleiben erhalten.\n` +
      `- Zeitstempel bleiben unverändert stehen, an derselben Stelle wie im Original.\n` +
      `- Eigennamen, Produktnamen und Fachbegriffe im Original belassen.\n` +
      `- Keine Kommentare, keine Einleitung, keine Nachbemerkung – nur die Übersetzung.`
    );
  }
  return (
    `Translate the following transcript into ${targetLanguage} in full.\n\n` +
    `Rules:\n` +
    `- Translate the entire text. No summary, no shortening, no omissions.\n` +
    `- Keep paragraph structure and order.\n` +
    `- Leave timestamps untouched, in the same place as in the original.\n` +
    `- Keep proper nouns, product names and technical terms in the original.\n` +
    `- No comments, no preamble, no closing note – the translation only.`
  );
}
