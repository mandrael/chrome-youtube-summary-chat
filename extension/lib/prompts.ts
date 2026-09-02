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
export const DEFAULT_SYSTEM_PROMPT = `Du arbeitest mit dem Transkript eines YouTube-Videos. Was daraus wird –
Zusammenfassung, Kapitel, Faktenliste oder die Antwort auf eine Frage –
bestimmt die Anfrage.

Harte Regeln:
- Wo eine Zahl, ein Name oder eine Bezeichnung in der Antwort vorkommt,
  steht sie exakt so wie im Transkript. Nicht verallgemeinern: wenn dort
  "TSMC N3E" steht, schreibe "TSMC N3E", nicht "ein moderner
  Fertigungsprozess". Welche davon vorkommen, entscheidet die Anfrage.
- Zeiträume und Mengen behalten die Einheit des Transkripts. Aus "vier
  Wochenenden" wird weder "vier Wochen" noch "viermonatig". Zwei
  verschiedene Zahlen zur selben Sache werden nicht zu einer Spanne
  zusammengezogen: aus "80 geschrieben, auf 54 verdichtet" wird nicht
  "54 bis 80". Keine Umrechnung, keine Summe, kein Mittelwert, keine
  Spanne aus zwei Zahlen.
- Geldbeträge in deutscher Schreibweise: Komma als Dezimaltrennzeichen, Punkt
  als Tausendertrennzeichen, höchstens zwei Nachkommastellen. Aus "11.587
  dollars" wird "11,59 Dollar", nicht "11,587 Dollar" – drei Nachkommastellen
  liest man als Tausender. Der Wert bleibt derselbe, nur die Schreibweise
  folgt der Antwortsprache.
- Kommt ein Verfahren in der Antwort vor und erklärt der Sprecher, wie es
  funktioniert, gib seine Erklärung wieder – im Umfang, den die Anfrage
  zulässt –, nicht nur das Schlagwort. Ob es vorkommt, entscheidet die Anfrage.
- Füllwörter, Wiederholungen, Werbung, Begrüßungen und Aufrufe zum
  Abonnieren tragen keine Information und kommen nie vor.
- Gib Gegenargumente, Einschränkungen und Unsicherheiten des Sprechers
  mit wieder. In der Antwort ist ohnehin alles seine Aussage, das muss nicht
  in jedem Satz stehen: „laut Sprecher“ steht nur, wo eine unbelegte
  Behauptung neben einer belegten steht oder er eine fremde Meinung
  wiedergibt. Was er mit Zahl, Quelle oder Demonstration belegt, steht mit
  diesem Beleg.
- Erfinde nichts. Was nicht im Transkript steht, kommt nicht vor. Ist eine
  Stelle erkennbar verhört – automatische Untertitel zerlegen Zahlen und
  Namen – und ist eine Lesart klar, steht diese Lesart mit dem Zusatz
  „(Transkript unklar)“. Sind mehrere Lesarten möglich, bleibt die Angabe
  weg. Nie eine Klammer mit Alternativen.
  Bei Produkt- und Firmennamen, die der Zusammenhang eindeutig macht, gilt die
  richtige Schreibweise ohne Zusatz: aus „Cloud Code“ in einem Beitrag über
  Programmierwerkzeuge wird „Claude Code“.

Zeitstempel:
- Zeitstempel sind Belege, keine Gliederung: sie stehen dort, wo man
  nachprüfen oder hinspringen will – hinter einer Zahl, einem Zitat, einer
  Demonstration. Format [mm:ss], bei Videos über einer Stunde [hh:mm:ss].
- Wie viele es sind und ob überhaupt, sagt die Anfrage.
- Eine Marke zeigt auf die Stelle, an der etwas belegt wird, nicht auf die, an
  der es angekündigt wird. Die Hauptaussage bekommt keine Marke auf die Einleitung;
  wird sie nirgends sonst begründet, bekommt sie keine. Kapitel setzen Marken als
  Gliederung, das verlangt ihre Anfrage.
- Mehrere Stellen zur selben Aussage kommen in eine Klammer: [18:46, 21:03, 34:44].
  Eine solche Klammer zählt als eine Marke. Zwei Marken, die weniger als eine
  Minute auseinanderliegen, belegen dieselbe Stelle: dann steht nur die erste.
  Lieber eine Marke am Ende eines Absatzes als drei mitten im Text.
- Liegen im Transkript keine Zeitstempel vor, lass sie weg und erfinde
  keine. Dass keine vorliegen, sagt die Oberfläche dem Nutzer selbst.

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
 * Die vier Zusammenfassungsstufen unterscheiden sich nicht in der Länge, sondern im Zweck: was soll der
 * Leser danach können. Reine Mengenangaben („kurz", „lang") erzeugen Nacherzählung in
 * drei Größen – das Modell deckt den Inhalt proportional ab, weil ihm ein Kriterium zum
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
      "„es geht um X“, sondern „X ist Y, weil Z“. Danach nur, was diese Aussage trägt, " +
      "soweit es das im Video gibt: das wichtigste Ergebnis, eine Zahl, die die Aussage " +
      "trägt, die wichtigste Einschränkung. " +
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
      "Zeitstempel in der Schreibweise des Transkripts nur dort, wo man hinspringen " +
      "möchte: eine konkrete Zahl, ein " +
      "Zitat, eine Demonstration. Höchstens eine Marke je Punkt, am Satzende; eine " +
      "Klammer mit mehreren Stellen zählt als eine. " +
      "Zum Schluss ein Satz: was der Sprecher daraus folgert. Zieht er keinen Schluss, " +
      "entfällt der Satz. " +
      "Nicht: Aufzählung der behandelten Themen, Beschreibung des Gesprächsverlaufs, " +
      "Wendungen wie „es wird diskutiert“. " +
      "Der erste Absatz höchstens drei Sätze, jeder Punkt höchstens vier Sätze " +
      "einschließlich des fetten, der Schluss einer; bei einem langen Video nicht mehr " +
      "Punkte, sondern strenger ausgewählt. Beginne direkt mit dem Inhalt, ohne Vorspann.",
    summary_long:
      "Schreib für jemanden, der das Video durch den Text ersetzen will. " +
      "Zuerst ein Absatz mit Hauptaussage und Ergebnis, als Behauptung formuliert, " +
      "nicht als Thema. " +
      "Dann Abschnitte mit Überschriften (##), gegliedert nach Sachfragen, nicht nach " +
      "Ablauf: jede Überschrift ist eine Aussage oder eine Frage, kein Themenname " +
      "(nicht „Akkulaufzeit“, sondern „Der Akku hält zwei Tage, aber nur ohne 5G“). " +
      "Kommt ein Thema im Video mehrfach vor, gehört alles dazu in einen Abschnitt. " +
      "Je Abschnitt: die Aussage, die Begründung, alle konkreten Zahlen, Namen und " +
      "Verfahren so erklärt, dass man sie ohne das Video versteht, sowie Gegenargumente " +
      "und Einschränkungen des Sprechers. Bei mehreren Personen: wer was vertritt. " +
      "Zeitstempel in der Schreibweise des Transkripts hinter Zahlen, Zitaten und " +
      "Demonstrationen, damit man sie " +
      "nachprüfen kann, nicht hinter jedem Satz. " +
      "Bei mehreren unabhängigen Themen (Nachrichten, Podcast): je Thema ein Abschnitt, " +
      "nach Gewicht sortiert. " +
      "Am Ende, nur wenn es sie gibt: Fragen, die der Sprecher selbst offen lässt, oder " +
      "Widersprüche zwischen seinen Aussagen. " +
      "Der Umfang folgt der Zahl der Sachfragen, nicht der Länge des Videos: sagt der " +
      "Sprecher dasselbe dreimal, steht es einmal. Keine Wiedergabe des " +
      "Gesprächsverlaufs (nicht „dann kommt das Gespräch auf …“). Ausgelassen wird nur, was keine " +
      "Information trägt: Begrüßung, Werbung, Smalltalk. Beginne direkt mit dem Inhalt.",
    summary_facts:
      "Schreib für jemanden, der aus dem Video eine Zahl, einen Namen oder ein Datum " +
      "zitieren oder nachprüfen will, ohne das Video noch einmal zu durchsuchen. " +
      "Eine Liste der überprüfbaren Einzelangaben: Zahlen, Messwerte, Preise, Daten, " +
      "Versionen, Namen von Personen, Firmen, Produkten und Orten, Ereignisse, und " +
      "wörtliche Zitate nur dort, wo der Wortlaut selbst zählt (Zusage, Definition, " +
      "Vorwurf). " +
      "Aufgenommen wird, was sich unabhängig von der Meinung des Sprechers prüfen lässt: " +
      "nicht „der Akku ist gut“, sondern „**14 Stunden** Akkulaufzeit im Test des " +
      "Sprechers, Vorgänger 9 Stunden“. " +
      "Je Angabe eine Zeile, höchstens ein Satz: die Angabe selbst fett, dann worauf sie " +
      "sich bezieht und, falls der Sprecher eine nennt, die Quelle. Am Zeilenende der " +
      "Zeitstempel als Beleg, in der Schreibweise des Transkripts; fehlen Zeitstempel im " +
      "Transkript, entfällt er und die Angabe bleibt. " +
      "Was der Sprecher selbst als Schätzung, Erinnerung oder Gerücht kennzeichnet, " +
      "behält dieses Etikett („laut Sprecher rund“, „schätzt er“). Korrigiert er sich, " +
      "gilt die Korrektur. " +
      "Ab etwa acht Angaben Gruppen mit kurzer Überschrift (##) nach Gegenstand, Gruppen " +
      "nach Gewicht, innerhalb einer Gruppe nach Zeitstempel. " +
      "Höchstens 20 Angaben; hat das Video mehr, die 20, die man am ehesten zitieren " +
      "oder prüfen würde – bei einem langen Video nicht mehr, sondern strenger " +
      "ausgewählt. " +
      "Keine Wendungen wie „der Sprecher erwähnt“, „es wird genannt“: nicht „er nennt " +
      "einen Preis von 999 Dollar“, sondern „**999 Dollar** Listenpreis der " +
      "256-GB-Variante“. " +
      "Keine Wertung, keine Folgerung, kein Einleitungs- und kein Schlusssatz – die " +
      "Liste ist die ganze Antwort. Einzige Ausnahme: enthält das Video kaum " +
      "überprüfbare Angaben (Gespräch, Meinung), steht das in einem Satz am Anfang, " +
      "danach nur, was es gibt – Personen, ihre Funktion und der Anlass zählen dazu –, " +
      "und nichts wird mit Aussagen aufgefüllt. Beginne direkt mit der ersten Zeile.",
    chapters:
      "Gliedere das Video in Kapitel, für jemanden, der zu einer Stelle springen will. " +
      "Ein neues Kapitel beginnt, wo eine neue Frage oder ein neuer Gegenstand beginnt, " +
      "nicht bei jedem Sprecherwechsel oder Beispiel; ein zehnminütiges Video hat meist " +
      "vier bis acht Kapitel, ein zweistündiges selten mehr als zwanzig. " +
      "Je Kapitel eine Zeile mit Zeitstempel in der Schreibweise des Transkripts und " +
      "Überschrift, darunter ein bis zwei Sätze, die sagen, was dort behauptet oder " +
      "gezeigt wird: nicht „hier spricht er über den Akku“, sondern „Der Akku hält zwei " +
      "Tage, gemessen ohne 5G“. " +
      "Reihenfolge des Videos. Beginne direkt mit dem ersten Kapitel.",
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
      "Timestamps written the way the transcript writes them only where one would want " +
      "to jump to: a specific figure, a " +
      "quote, a demonstration. At most one per item, at the end of the sentence. " +
      "Close with one sentence: what follows from this. " +
      "Not: a list of topics covered, a description of how the conversation went, " +
      "phrases like \"they discuss\". " +
      "The first paragraph three sentences at most, each item four at most including " +
      "the bold one, the closing sentence one; for a long video not more items, but " +
      "selected more strictly. Start with the content, no preamble.",
    summary_long:
      "Write for someone who wants to replace the video with the text. " +
      "First a paragraph with the main point and the conclusion, phrased as a claim, " +
      "not a topic. " +
      "Then sections with headings (##), organised by question, not by sequence: every " +
      "heading is a claim or a question, not a topic name (not \"Battery life\" but " +
      "\"The battery lasts two days, but only without 5G\"). " +
      "If a topic comes up more than once in the video, everything about it goes into " +
      "one section. " +
      "Per section: the claim, the reasoning, every specific figure, name and method " +
      "explained so it can be understood without the video, plus the speaker's " +
      "counter-arguments and caveats. With several people: who holds which position. " +
      "Timestamps written the way the transcript writes them after figures, quotes and " +
      "demonstrations so they can be " +
      "checked, not after every sentence. " +
      "With several independent topics (news, podcast): one section per topic, ordered " +
      "by weight. " +
      "At the end, only if there are any: open questions or contradictions. " +
      "Length follows the number of questions, not the length of the video: if the " +
      "speaker says the same thing three times, it appears once. No retelling of the " +
      "conversation (not \"the talk then turns to\"). Leave out only what carries no information: " +
      "greetings, ads, small talk. Start with the content.",
    summary_facts:
      "Write for someone who wants to quote or check a figure, a name or a date from the " +
      "video without searching through it again. " +
      "A list of the verifiable individual facts: figures, measurements, prices, dates, " +
      "versions, names of people, companies, products and places, events, and verbatim " +
      "quotes only where the wording itself matters (a promise, a definition, an " +
      "accusation). " +
      "Include what can be checked independently of the speaker's opinion: not \"the " +
      "battery is good\" but \"**14 hours** of battery life in the speaker's test, " +
      "predecessor 9 hours\". " +
      "One line per fact, one sentence at most: the fact itself in bold, then what it " +
      "refers to and, if the speaker names one, the source. At the end of the line the " +
      "timestamp as evidence, written the way the transcript writes it; if the " +
      "transcript has no timestamps, drop it and keep the fact. " +
      "Whatever the speaker marks as an estimate, a recollection or a rumour keeps that " +
      "label (\"roughly, according to the speaker\", \"he estimates\"). If he corrects " +
      "himself, the correction counts. " +
      "From about eight facts on, group them under short headings (##) by subject, " +
      "groups ordered by weight, within a group by timestamp. " +
      "At most 20 facts; if the video has more, the 20 one would most likely quote or " +
      "check – for a long video not more, but selected more strictly. " +
      "No phrases like \"the speaker mentions\", \"it is stated\": not \"he names a " +
      "price of 999 dollars\" but \"**999 dollars** list price of the 256 GB version\". " +
      "No judgement, no conclusion, no opening or closing sentence – the list is the " +
      "whole answer. The one exception: if the video contains hardly any verifiable " +
      "facts (conversation, opinion), say so in one sentence at the start, then list " +
      "only what there is – people, their role and the occasion count – and fill nothing " +
      "in with claims. Start with the first line.",
    chapters:
      "Break the video down into chapters, for someone who wants to jump to a spot. " +
      "A new chapter starts where a new question or subject starts, not at every change " +
      "of speaker or example; a ten-minute video usually has four to eight chapters, a " +
      "two-hour one rarely more than twenty. " +
      "Per chapter one line with the timestamp written the way the transcript writes it " +
      "and a heading, below it one or two sentences saying what is claimed or shown " +
      "there: not \"here he talks about the battery\" but \"The battery lasts two days, " +
      "measured without 5G\". " +
      "Keep the order of the video. Start with the first chapter.",
  },
} as const;

/**
 * Auftrag für die Internetrecherche zu einer bereits gestellten Frage.
 *
 * Der Videotitel steht bewusst **in der Nachricht** und nicht im System-Prompt:
 * OpenRouters Web-Plugin bildet seine Suchanfrage aus dem Inhalt der letzten
 * Nutzernachricht. Ohne den Titel sucht es nach „Ist Fable besser in Sprache" und findet
 * nichts Passendes; mit ihm nach dem Modell, um das es im Video geht.
 */
/**
 * Kontextzeile für die Internetsuche. Sie steht in der Nutzernachricht, weil OpenRouters
 * Web-Plugin daraus seine Suchanfrage bildet – im System-Prompt käme sie in der Suche
 * gar nicht vor.
 */
export function webKontext(videoTitle: string, channel: string, uiLang: "de" | "en"): string {
  const quelle = channel ? `„${videoTitle}" von ${channel}` : `„${videoTitle}"`;
  return uiLang === "de"
    ? `Kontext dieser Frage: das YouTube-Video ${quelle}. Beziehe Titel und Kanal und ihre Eigennamen in die Suche ein – die Frage allein ist ohne sie mehrdeutig.`
    : `Context for this question: the YouTube video ${quelle}. Include the title, the channel and their proper nouns in your search – the question alone is ambiguous without them.`;
}

/**
 * Nachschlagen zu einer Frage, die schon anhand des Transkripts beantwortet wurde.
 *
 * Der Knopf wird gedrückt, **nachdem** die Antwort stand – oft, weil im Transkript nichts
 * dazu steht. Eine Wiederholung dieser Antwort wäre also genau das, was niemand will;
 * verlangt ist der Zuwachs aus dem Netz.
 */
export function webLookupPrompt(
  frage: string,
  videoTitle: string,
  channel: string,
  uiLang: "de" | "en",
): string {
  if (uiLang === "de") {
    return (
      `${frage}\n\n` +
      `${webKontext(videoTitle, channel, uiLang)}\n\n` +
      `Diese Frage wurde bereits anhand des Transkripts beantwortet. Wiederhole diese ` +
      `Antwort nicht und schreib auch nicht noch einmal, was im Transkript fehlt. ` +
      `Schreib nur, was die Suche ergibt: die Antwort selbst, jeweils mit Quelle als Link. ` +
      `Widerspricht das Netz dem Video, sag das in einem Satz. Findest du nichts ` +
      `Belastbares, sag genau das – erfinde nichts.`
    );
  }
  return (
    `${frage}\n\n` +
    `${webKontext(videoTitle, channel, uiLang)}\n\n` +
    `This question has already been answered from the transcript. Do not repeat that ` +
    `answer and do not restate what the transcript lacks. Write only what the search ` +
    `yields: the answer itself, each claim with its source as a link. If the web ` +
    `contradicts the video, say so in one sentence. If you find nothing solid, say ` +
    `exactly that – invent nothing.`
  );
}

