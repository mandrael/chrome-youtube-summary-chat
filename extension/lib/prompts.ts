/**
 * Der Default-System-Prompt. In den Optionen überschreibbar, dort auch zurücksetzbar.
 *
 * Er sagt, **was** gilt – nicht, wie lang oder wie gegliedert die Antwort ist. Das war
 * anfangs anders und der Grund, warum jede Stufe ein Protokoll entlang der Zeitachse
 * lieferte statt einer Zusammenfassung: der System-Prompt verlangte „Abschnitte in der
 * Reihenfolge des Videos", Vollständigkeit und Zeitstempel-Dichte, und übersteuerte damit
 * jede Verdichtungsanweisung des Presets. Widersprechen sich beide, gewinnt der längere
 * und konkretere Text. Form gehört deshalb ausschliesslich in die Presets.
 */
export const DEFAULT_SYSTEM_PROMPT = `Du fasst ein Video-Transkript zusammen. Ziel ist eine inhaltlich dichte
Zusammenfassung, die das Ansehen ersetzen kann.

Harte Regeln:
- Wo eine Zahl, ein Name oder eine Bezeichnung in der Antwort vorkommt,
  steht sie exakt so wie im Transkript. Nicht verallgemeinern: wenn dort
  "TSMC N3E" steht, schreibe "TSMC N3E", nicht "ein moderner
  Fertigungsprozess". Welche davon vorkommen, entscheidet die Anfrage.
- Erkläre technische Verfahren so, dass sie verständlich sind, statt
  sie nur zu benennen. Wenn der Sprecher erklärt, wie etwas
  funktioniert, gib die Erklärung wieder, nicht nur das Schlagwort.
- Füllwörter, Wiederholungen, Werbung, Begrüssungen und Aufrufe zum
  Abonnieren tragen keine Information und kommen nie vor.
- Gib Gegenargumente, Einschränkungen und Unsicherheiten des Sprechers
  mit wieder. Markiere klar, was Behauptung des Sprechers ist und was
  belegt wird.
- Erfinde nichts. Was nicht im Transkript steht, kommt nicht vor. Wenn
  etwas unklar oder akustisch verstümmelt ist, schreibe das hin.

Zeitstempel:
- Zeitstempel sind Belege, keine Gliederung: sie stehen dort, wo man
  nachprüfen oder hinspringen will – hinter einer Zahl, einem Zitat, einer
  Demonstration. Format [mm:ss], bei Videos über einer Stunde [hh:mm:ss].
- Wie viele es sind und ob überhaupt, sagt die Anfrage.
- Liegen im Transkript keine Zeitstempel vor, lass sie weg und weise
  einmal am Anfang darauf hin. Erfinde keine.

Form und Umfang:
- Form, Gliederung und Umfang bestimmt die Anfrage. Diese Regeln sagen
  nur, was inhaltlich gilt.
- Eine Zusammenfassung gibt Aussagen wieder, nicht den Ablauf: was
  behauptet wird, womit es begründet wird, wozu es kommt. Den Ablauf des
  Videos bildet die Kapitelfunktion ab, nicht die Zusammenfassung.

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
/*
 * Die drei Stufen unterscheiden sich nicht in der Länge, sondern im Zweck: was soll der
 * Leser danach können. Reine Mengenangaben („kurz", „lang") erzeugen Nacherzählung in
 * drei Grössen – das Modell deckt den Inhalt proportional ab, weil ihm ein Kriterium zum
 * Weglassen fehlt.
 *
 * Die Formulierungen stehen absichtlich so ausführlich da: Leser und Situation statt
 * Aufgabe, Aussage statt Thema (mit Kontrastpaar), ein Verbot der Nacherzähl-Wendungen
 * („behandelt", „spricht über"), Reihenfolge nach Gewicht statt nach Ablauf, Budget in
 * Sätzen statt Wörtern und vom Input entkoppelt, Zeitstempel an eine Funktion gebunden.
 * Jede dieser Zeilen ersetzt eine Fehlerart, die vorher auftrat.
 */
export const PRESETS = {
  de: {
    summary_short:
      "Schreib für jemanden, der das Video nicht ansehen wird und in 30 Sekunden wissen " +
      "will, was hier behauptet wird und wozu der Sprecher kommt. " +
      "Ein bis zwei Absätze, zusammen höchstens sechs Sätze. " +
      "Der erste Satz ist die Hauptaussage als Behauptung, nicht als Thema: nicht " +
      "„es geht um X“, sondern „X ist Y, weil Z“. Danach nur, was diese Aussage trägt: " +
      "das wichtigste Ergebnis, die entscheidende Zahl, die wichtigste Einschränkung. " +
      "Hat das Video mehrere unabhängige Themen (Nachrichten, Podcast), gilt das für die " +
      "zwei oder drei wichtigsten, je ein Satz. " +
      "Fließtext ohne Überschriften, Aufzählung oder Zeitstempel. " +
      "Keine Wiedergabe des Ablaufs und keine Wendungen wie „das Video behandelt“, " +
      "„es wird gesprochen über“, „der Moderator erklärt“. " +
      "Weglassen: Nebenthemen, Beispiele, Anekdoten, auch wenn sie im Transkript viel " +
      "Platz einnehmen. Beginne direkt mit dem ersten Satz, ohne Vorspann.",
    summary_medium:
      "Schreib für jemanden, der das Video nicht ansieht, aber die Aussagen nachvollziehen " +
      "und einordnen will. " +
      "Zuerst ein Absatz mit der Hauptaussage und dem Ergebnis, als Behauptung formuliert, " +
      "nicht als Thema. " +
      "Danach die drei bis fünf tragenden Punkte als Liste. Jeder Punkt beginnt fett mit " +
      "der Aussage als ganzem Satz (nicht mit einem Schlagwort) und sagt in zwei bis drei " +
      "Sätzen, womit sie begründet wird (Zahl, Beispiel, Beleg) und was der Sprecher " +
      "selbst einschränkt oder offen lässt. " +
      "Reihenfolge nach Gewicht, nicht nach Ablauf im Video. Kommt ein Thema mehrfach " +
      "vor, gehört alles dazu in einen Punkt. " +
      "Zeitstempel [mm:ss] nur dort, wo man hinspringen möchte: eine konkrete Zahl, ein " +
      "Zitat, eine Demonstration. Höchstens einer pro Punkt, am Satzende. " +
      "Zum Schluss ein Satz: was folgt daraus. " +
      "Nicht: Aufzählung der behandelten Themen, Beschreibung des Gesprächsverlaufs, " +
      "Wendungen wie „es wird diskutiert“. " +
      "Etwa 200 bis 300 Wörter; bei einem langen Video nicht mehr, sondern strenger " +
      "ausgewählt. Beginne direkt mit dem Inhalt, ohne Vorspann.",
    summary_long:
      "Schreib für jemanden, der das Video durch den Text ersetzen will. " +
      "Zuerst ein Absatz mit Hauptaussage und Ergebnis. " +
      "Dann Abschnitte mit Überschriften (##), gegliedert nach Sachfragen, nicht nach " +
      "Ablauf: jede Überschrift ist eine Aussage oder eine Frage, kein Themenname " +
      "(nicht „Akkulaufzeit“, sondern „Der Akku hält zwei Tage, aber nur ohne 5G“). " +
      "Kommt ein Thema im Video mehrfach vor, gehört alles dazu in einen Abschnitt. " +
      "Je Abschnitt: die Aussage, die Begründung, alle konkreten Zahlen, Namen und " +
      "Verfahren so erklärt, dass man sie ohne das Video versteht, sowie Gegenargumente " +
      "und Einschränkungen des Sprechers. Bei mehreren Personen: wer was vertritt. " +
      "Zeitstempel [mm:ss] hinter Zahlen, Zitaten und Demonstrationen, damit man sie " +
      "nachprüfen kann, nicht hinter jedem Satz. " +
      "Bei mehreren unabhängigen Themen (Nachrichten, Podcast): je Thema ein Abschnitt, " +
      "nach Gewicht sortiert. " +
      "Am Ende, nur wenn es sie gibt: offene Fragen oder Widersprüche. " +
      "Kein Wortlimit, aber keine Wiederholung und keine Wiedergabe des Gesprächsverlaufs " +
      "(nicht „dann kommt das Gespräch auf …“). Ausgelassen wird nur, was keine " +
      "Information trägt: Begrüßung, Werbung, Smalltalk. Beginne direkt mit dem Inhalt.",
    chapters:
      "Gliedere das Video in Kapitel. Gib je Kapitel den Zeitstempel im Format [mm:ss] " +
      "(bei Videos über einer Stunde [hh:mm:ss]), eine Überschrift und ein bis zwei Sätze " +
      "Inhalt. Halte dich an die Reihenfolge des Videos.",
  },
  en: {
    summary_short:
      "Write for someone who will not watch the video and wants to know in 30 seconds " +
      "what is being claimed and what the speaker concludes. " +
      "One or two paragraphs, six sentences at most in total. " +
      "The first sentence is the main point as a claim, not a topic: not \"it is about X\" " +
      "but \"X is Y because Z\". Then only what carries that claim: the key result, the " +
      "decisive figure, the main caveat. " +
      "If the video has several independent topics (news, podcast), do this for the two " +
      "or three most important ones, one sentence each. " +
      "Prose, no headings, bullet points or timestamps. " +
      "Do not retell the flow and do not use phrases like \"the video covers\", " +
      "\"they talk about\", \"the host explains\". " +
      "Leave out side topics, examples and anecdotes, even if they take up a lot of the " +
      "transcript. Start with the first sentence, no preamble.",
    summary_medium:
      "Write for someone who will not watch the video but wants to follow and weigh " +
      "the claims. " +
      "First a paragraph with the main point and the conclusion, phrased as a claim, " +
      "not a topic. " +
      "Then the three to five points that carry it, as a list. Each item starts in bold " +
      "with the claim as a full sentence (not a keyword) and says in two or three " +
      "sentences what supports it (figure, example, evidence) and what the speaker " +
      "qualifies or leaves open. " +
      "Order by weight, not by position in the video. If a topic comes up more than " +
      "once, everything about it goes into one item. " +
      "Timestamps [mm:ss] only where one would want to jump to: a specific figure, a " +
      "quote, a demonstration. At most one per item, at the end of the sentence. " +
      "Close with one sentence: what follows from this. " +
      "Not: a list of topics covered, a description of how the conversation went, " +
      "phrases like \"they discuss\". " +
      "About 200 to 300 words; for a long video not more, but selected more strictly. " +
      "Start with the content, no preamble.",
    summary_long:
      "Write for someone who wants to replace the video with the text. " +
      "First a paragraph with the main point and the conclusion. " +
      "Then sections with headings (##), organised by question, not by sequence: every " +
      "heading is a claim or a question, not a topic name (not \"Battery life\" but " +
      "\"The battery lasts two days, but only without 5G\"). " +
      "If a topic comes up more than once in the video, everything about it goes into " +
      "one section. " +
      "Per section: the claim, the reasoning, every specific figure, name and method " +
      "explained so it can be understood without the video, plus the speaker's " +
      "counter-arguments and caveats. With several people: who holds which position. " +
      "Timestamps [mm:ss] after figures, quotes and demonstrations so they can be " +
      "checked, not after every sentence. " +
      "With several independent topics (news, podcast): one section per topic, ordered " +
      "by weight. " +
      "At the end, only if there are any: open questions or contradictions. " +
      "No word limit, but no repetition and no retelling of the conversation (not " +
      "\"the talk then turns to\"). Leave out only what carries no information: " +
      "greetings, ads, small talk. Start with the content.",
    chapters:
      "Break the video down into chapters. For each chapter give the timestamp as [mm:ss] " +
      "(or [hh:mm:ss] for videos over an hour), a heading, and one or two sentences of " +
      "content. Keep the order of the video.",
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


/**
 * Übersetzt eine bereits erzeugte Antwort – Zusammenfassung, Kapitel, Chatantwort.
 *
 * Anders als beim Transkript geht es hier nicht um Vollständigkeit, sondern um
 * **Formattreue**: Überschriften, Listen, Fettungen und Zeitstempel müssen exakt so
 * wieder herauskommen, sonst zerfällt die Antwort beim Rendern.
 */
export function answerTranslationPrompt(
  targetLanguage: string,
  uiLang: "de" | "en",
): string {
  if (uiLang === "de") {
    return (
      `Übersetze den folgenden Text nach ${targetLanguage}.\n\n` +
      `Regeln:\n` +
      `- Die Markdown-Formatierung bleibt exakt erhalten: Überschriften (#), Listen, ` +
      `Nummerierungen, Fettungen, Codeblöcke, Zeilenumbrüche.\n` +
      `- Zeitstempel wie [12:34] bleiben unverändert und an derselben Stelle stehen.\n` +
      `- Übersetze den gesamten Text. Keine Zusammenfassung, keine Kürzung.\n` +
      `- Eigennamen, Produktnamen und Fachbegriffe im Original belassen.\n` +
      `- Keine Kommentare, keine Einleitung – nur die Übersetzung.`
    );
  }
  return (
    `Translate the following text into ${targetLanguage}.\n\n` +
    `Rules:\n` +
    `- Keep the Markdown formatting exactly: headings (#), lists, numbering, bold, ` +
    `code blocks, line breaks.\n` +
    `- Leave timestamps like [12:34] untouched and in the same place.\n` +
    `- Translate the entire text. No summary, no shortening.\n` +
    `- Keep proper nouns, product names and technical terms in the original.\n` +
    `- No comments, no preamble – the translation only.`
  );
}
