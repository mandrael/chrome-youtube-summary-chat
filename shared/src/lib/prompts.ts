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
- Erfinde nichts. Was nicht im Transkript steht, kommt nicht vor. Ist eine
  Stelle erkennbar verhört – automatische Untertitel zerlegen Zahlen und
  Namen – und ist eine Lesart klar, steht diese Lesart mit dem Zusatz
  „(Transkript unklar)“. Sind mehrere Lesarten möglich, bleibt die Angabe
  weg. Nie eine Klammer mit Alternativen.
  Bei Produkt- und Firmennamen, die der Zusammenhang eindeutig macht, gilt die
  richtige Schreibweise ohne Zusatz: aus „Cloud Code“ in einem Beitrag über
  Programmierwerkzeuge wird „Claude Code“.
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
- An einer Zahl wird nichts gerechnet und nichts gerundet. Sie steht mit
  denselben Ziffern da wie im Transkript.
- **Tausendertrennzeichen kommen nie vor**, in keiner Antwortsprache: aus
  "1,500 dollars" wird auf Deutsch "1500 Dollar" und auf Englisch
  "1500 dollars". Punkt und Komma bleiben allein dem Dezimalzeichen
  vorbehalten – als Tausenderzeichen machen sie dieselbe Ziffernfolge in der
  jeweils anderen Sprache mehrdeutig. Das Dezimalzeichen folgt der
  Antwortsprache: Komma auf Deutsch, Punkt auf Englisch. Aus dem englischen
  "3.5 hours" – Punkt als Dezimalzeichen – wird auf Deutsch "3,5 Stunden";
  die Ziffern bleiben, nur das Zeichen wechselt.
- Ist die Lesart nicht eindeutig, bleibt die Zahl **unverändert** in der
  Schreibweise des Transkripts stehen, samt ihrer Trennzeichen. Drei Ziffern
  hinter einem Trennzeichen sind kein Beweis für Tausender: "11,587" kann
  ebenso ein Wert mit drei Dezimalstellen sein. Entscheidend ist, was der
  Sprecher sagt – nennt er die Zahl in Worten ("eleven thousand"), gilt das;
  sagt er sie nicht aus und ist das Format zweideutig, wird nichts
  umgeschrieben.
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
  Eine solche Klammer zählt als eine Marke. Zwei Marken, die weniger als
  30 Sekunden auseinanderliegen, belegen dieselbe Stelle: dann steht nur die
  erste. Lieber eine Marke am Ende eines Absatzes als drei mitten im Text.
- Fehlen im Transkript Zeitstempel, stehen in der Antwort keine, und das
  Fehlen wird nicht erwähnt.

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
      "Keine Wiedergabe des Ablaufs und keine Wendungen wie „das Video behandelt“, " +
      "„es wird gesprochen über“, „der Moderator erklärt“. " +
      "Weglassen: Nebenthemen, Beispiele, Anekdoten, auch wenn sie im Transkript viel " +
      "Platz einnehmen. " +
      "Fließtext ohne Überschriften, ohne Aufzählung und ohne Zeitstempel – auch dann keine Sprungmarken, wenn das Transkript welche enthält. " +
      "Beginne direkt mit dem ersten Satz, ohne Vorspann.",
    summary_medium:
      "Fasse das Video zusammen, für jemanden, der es nicht ansieht und in wenigen " +
      "Minuten wissen will, was darin gesagt wird. " +
      "Je Thema ein Absatz, höchstens vier; hat das Video mehr Themen (Nachrichten, " +
      "Podcast), kommen die vier wichtigsten. Jeder Absatz beginnt fett mit dem " +
      "Thema als kurzer Aussage von drei bis acht Wörtern, kein Schlagwort: nicht " +
      "„**Akku**“, sondern „**Der Akku hält zwei Tage.**“ Danach in derselben Zeile zwei " +
      "bis vier weitere Sätze: was der Sprecher dazu sagt, womit er es begründet (Zahl, " +
      "Beispiel, Beleg) und was er selbst einschränkt. " +
      "Reihenfolge nach Gewicht, nicht nach Ablauf im Video. Kommt ein Thema mehrfach " +
      "vor, gehört alles dazu in einen Absatz. " +
      "Keine Überschriften, keine Aufzählungen, keine Zeitstempel – auch dann keine " +
      "Sprungmarken, wenn das Transkript welche enthält. " +
      "Keine Wiedergabe des Ablaufs und keine Wendungen wie „das Video behandelt“, " +
      "„es wird gesprochen über“, „der Moderator erklärt“. " +
      "Weglassen: Begrüßung, Werbung, Anekdoten ohne Aussage. " +
      "Beginne direkt mit dem ersten Absatz, ohne Vorspann.",
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
      "Information trägt: Begrüßung, Werbung, Smalltalk. " +
      "Passt nicht alles in eine Antwort, kommen die Sachfragen nach Gewicht, und am " +
      "Ende steht in einem Satz, welche fehlen – nichts wird still weggelassen. " +
      "Beginne direkt mit dem Inhalt.",
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
      "Nicht hierher gehört, was sich nur mit Argumenten prüfen lässt – Ursache und " +
      "Wirkung, Vorhersagen, Vergleichsurteile: das ist eine Behauptung, keine Angabe. " +
      "Jede Angabe ein Aufzählungspunkt (die Zeile beginnt mit „- “), höchstens ein Satz: " +
      "die Angabe selbst fett, dann worauf sie " +
      "sich bezieht und, falls der Sprecher eine nennt, die Quelle. Am Ende des Punktes der " +
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
    howto:
      "Schreib für jemanden, der das Gezeigte selbst nachmachen will, ohne das Video " +
      "dabei laufen zu lassen. " +
      "Zuerst ein Satz: was am Ende steht, und was man vorher braucht, soweit der " +
      "Sprecher es nennt (Geräte, Programme, Versionen, Konten, Kosten). " +
      "Dann die Schritte als nummerierte Liste in der Reihenfolge, in der man sie " +
      "ausführt. Jeder Schritt beginnt mit dem Tun, nicht mit dem Thema: nicht " +
      "„Einstellungen“, sondern „In den Einstellungen unter Netzwerk den DNS auf " +
      "1.1.1.1 setzen“. " +
      "Befehle, Code, Dateinamen, Menüpfade, Tastenkürzel und Einstellwerte stehen " +
      "wörtlich; Befehle und Code in einem Codeblock. " +
      "Bei körperlichen Abläufen (Übung, Griff, Test) stehen je Schritt Position, " +
      "Kontaktpunkt, Richtung, Druck, Dauer und Wiederholungen, und woran man das " +
      "Ergebnis erkennt – so, wie der Sprecher es sagt. " +
      "Was der Sprecher nur auf dem Bildschirm zeigt und nicht ausspricht („diesen " +
      "Befehl hier“), wird nicht erraten: an der Stelle steht „(nur gezeigt, siehe " +
      "Video)“. " +
      "Jeder Schritt endet mit dem Zeitstempel, an dem er beginnt, in der Schreibweise " +
      "des Transkripts, damit man den Bildschirm dazu sehen kann. " +
      "Warnungen, Voraussetzungen, Fehler, die der Sprecher nennt, und Alternativen " +
      "(„wer Windows hat, nimmt stattdessen …“) stehen bei dem Schritt, zu dem sie " +
      "gehören, nicht gesammelt am Ende. " +
      "Warum etwas funktioniert, steht nur als Halbsatz und nur dort, wo man sonst " +
      "einen falschen Wert wählen würde. " +
      "Zeigt der Sprecher mehrere Wege zum selben Ziel, je Weg eine eigene Liste mit " +
      "Überschrift (##). " +
      "Weglassen: Hintergrund, Meinung, Vergleiche mit anderen Videos. " +
      "Enthält das Video keine Anleitung, steht das in einem Satz, danach nichts. " +
      "Beginne direkt mit dem ersten Satz.",
    pro_contra:
      "Schreib für jemanden, der sich entscheiden muss – kaufen oder nicht, zustimmen " +
      "oder nicht – und dafür die Argumente beider Seiten braucht, so wie das Video sie " +
      "liefert. " +
      "Zuerst ein Satz: worum es geht (das getestete Produkt oder die strittige These) " +
      "und wozu der Sprecher kommt. " +
      "Dann zwei Listen mit Überschrift (##): Dafür und Dagegen. Jeder Punkt ist ein " +
      "ganzer Satz mit dem Argument und seinem Beleg – Messwert, Preis, Vergleich, " +
      "Vorführung, Erfahrung –, kein Schlagwort: nicht „guter Akku“, sondern „Der Akku " +
      "hielt im Test des Sprechers 14 Stunden, der Vorgänger 9“. Ein Zeitstempel in der " +
      "Schreibweise des Transkripts hinter Messwerten und Vorführungen, höchstens einer " +
      "je Punkt. " +
      "Reihenfolge nach dem Gewicht, das der Sprecher dem Argument gibt, nicht nach " +
      "Ablauf. Ein Argument, das der Sprecher selbst entkräftet, steht mit dieser " +
      "Entkräftung, nicht als offenes Argument. Bei mehreren Personen steht, wer es " +
      "vertritt. " +
      "Die Punkte beider Listen beginnen mit „- “. " +
      "Zum Schluss ein Abschnitt mit Überschrift (##) und bis zu drei Aufzählungspunkten, " +
      "jeder nur, wenn das Video ihn hergibt: „**Für wen**“ " +
      "– wem der Sprecher es empfiehlt und wem nicht; „Alternativen“ – was er " +
      "stattdessen nennt, mit seinem Grund; „Nicht geprüft“ – was er ausdrücklich offen " +
      "lässt oder nicht getestet hat. " +
      "Gibt es mehrere Streitfragen (Diskussion, Podcast), je Streitfrage ein eigener " +
      "Block Dafür/Dagegen, nach Gewicht sortiert, und am Ende ein Satz, worin sich die " +
      "Beteiligten einig sind. " +
      "Keine eigene Wertung und kein eigenes Argument: was hier steht, hat jemand im " +
      "Video gesagt. Fehlt eine Seite im Video, steht das in einem Satz statt einer " +
      "erfundenen Liste. Beginne direkt mit dem ersten Satz.",
    claims:
      "Schreib für jemanden, der prüfen will, ob stimmt, was im Video gesagt wird, und " +
      "dafür wissen muss, was genau behauptet wird und worauf es sich stützt. " +
      "Eine Liste der Behauptungen, die das Video tragen: Tatsachen, Zahlen, Ursache " +
      "und Wirkung, Vergleiche, Vorhersagen. Nicht: Geschmack, Selbstverständliches, " +
      "Beiläufiges. Eine blosse Angabe ohne Aussage – ein Preis, ein Datum, eine " +
      "Version – ist keine Behauptung und gehört in die Faktenliste. " +
      "Jede Behauptung ein eigener Absatz, durch eine Leerzeile vom nächsten getrennt " +
      "(ein blosser Zeilenumbruch reicht nicht, der wird zu Fliesstext). Der Absatz " +
      "beginnt mit der Behauptung als einem fetten Satz, so formuliert, dass man sie " +
      "ohne das Video prüfen kann: mit Gegenstand, Zahl, Zeitraum und Ort, wie der " +
      "Sprecher sie nennt; bei einer Vorhersage mit dem Zeitpunkt, für den sie gilt. " +
      "Danach im selben Absatz ein Satz, womit der Sprecher sie stützt, mit einem dieser " +
      "Etiketten vorneweg: **Gemessen** (eigener Test, eigene Zahl), **Quelle** (Studie, Bericht, " +
      "Person – mit dem Namen, den er nennt; nennt er keinen: „Quelle, nicht benannt“), " +
      "**Gezeigt** (Vorführung im Video), **Erfahrung** (eigenes Erleben), **Unbelegt** " +
      "(nur behauptet). Am Ende dieses Satzes der Zeitstempel in der Schreibweise des " +
      "Transkripts, mehrere Stellen in einer Klammer; fehlen Zeitstempel im Transkript, " +
      "entfällt er. " +
      "Was der Sprecher selbst einschränkt („wahrscheinlich“, „schätze ich“) oder als " +
      "fremde Meinung wiedergibt, ohne sie zu übernehmen, behält diese Einschränkung. " +
      "Reihenfolge: zuerst die Behauptungen, ohne die das Video seine Aussage verliert, " +
      "dann die übrigen. Höchstens 15; hat das Video mehr, die 15, deren Widerlegung " +
      "dem Video am meisten schadet. " +
      "Keine Bewertung, ob eine Behauptung stimmt, keine Einleitung, kein Schluss – die " +
      "Liste ist die ganze Antwort. Enthält das Video keine prüfbaren Behauptungen, " +
      "steht das in einem Satz, danach nichts. Beginne direkt mit der ersten " +
      "Behauptung.",
    chapters:
      "Gliedere das Video in Kapitel, für jemanden, der zu einer Stelle springen will. " +
      "Ein neues Kapitel beginnt, wo eine neue Frage oder ein neuer Gegenstand beginnt, " +
      "nicht bei jedem Sprecherwechsel oder Beispiel; ein zehnminütiges Video hat meist " +
      "vier bis acht Kapitel, ein zweistündiges selten mehr als zwanzig. " +
      "Je Kapitel ein Aufzählungspunkt (die Zeile beginnt mit „- “): Zeitstempel in der " +
      "Schreibweise des Transkripts und Überschrift fett, dann nach einem Gedankenstrich " +
      "ein bis zwei Sätze, die sagen, was dort behauptet oder " +
      "gezeigt wird: nicht „hier spricht er über den Akku“, sondern „Der Akku hält zwei " +
      "Tage, gemessen ohne 5G“. " +
      "Reihenfolge des Videos. Beginne direkt mit dem ersten Kapitel.",
    comparison:
      "Stelle die im Video verglichenen Dinge in einer Tabelle gegenüber. " +
      "Das können zwei oder drei Produkte, Verfahren, Positionen, Lizenzen, Werkzeuge " +
      "oder Zeitpunkte sein - was auch immer im Video tatsächlich verglichen wird. " +
      "Erste Spalte: das Merkmal. Danach je eine Spalte pro verglichener Sache, mit " +
      "deren Namen als Überschrift. " +
      "Fünf bis acht Zeilen, jede ein Merkmal, zu dem das Video für **jede** Seite " +
      "etwas sagt. Sagt es zu einer Seite nichts, schreib in die Zelle „nicht gesagt“ - " +
      "erfinde nichts und schliesse nichts aus dem Umkehrschluss. " +
      "In den Zellen stehen kurze Aussagen, keine ganzen Absätze; Zahlen und Einheiten " +
      "genau so, wie sie im Video fallen. " +
      "Das wichtigste Wort einer Zelle darf **fett** stehen, höchstens eines je Zelle. " +
      "Danach ein Abschnitt **Kurz gesagt:** mit einem Aufzählungspunkt je verglichener " +
      "Sache, jeder ein Satz, der sie aus ihrer eigenen Sicht auf den Punkt bringt. " +
      "Zum Schluss, nach einer Leerzeile als eigener Absatz, **Unterschied, der zählt:** " +
      "– der eine Punkt, an dem sich " +
      "eine Entscheidung zwischen ihnen entscheidet. " +
      "Vergleicht das Video gar nichts, schreib das in einem Satz und biete stattdessen " +
      "die Zusammenfassung an. " +
      "Keine Zeitstempel in der Tabelle; wenn eine Aussage eine Sprungmarke verdient, " +
      "setz sie in die Kurzfassung.",
    glossary:
      "Schreib für jemanden, der das Fachvokabular des Videos lernen oder nachschlagen " +
      "will. " +
      "Eine Liste der Fachbegriffe, Methoden, Modelle und Verfahrensnamen, die der " +
      "Sprecher benutzt und erklärt oder erkennbar voraussetzt. " +
      "Jeder Begriff ein Aufzählungspunkt (die Zeile beginnt mit „- “): der Begriff fett " +
      "und im Original, dann in ein bis zwei " +
      "Sätzen, was er laut Sprecher bedeutet und wofür er ihn verwendet – seine " +
      "Erklärung, nicht eine allgemeine. Erklärt er ihn nicht, steht „(nicht erklärt)“ " +
      "und es wird nichts ergänzt. Grenzt er ihn von einem anderen Begriff ab, steht " +
      "die Abgrenzung mit. " +
      "Am Zeilenende der Zeitstempel in der Schreibweise des Transkripts, an dem er ihn " +
      "erklärt oder zuerst benutzt. " +
      "Reihenfolge: zuerst die Begriffe, ohne die man das Video nicht versteht, dann die " +
      "übrigen; höchstens 20, bei mehr die 20 wichtigsten. " +
      "Kein Einleitungs- und kein Schlusssatz, die Liste ist die ganze Antwort. Enthält " +
      "das Video kein Fachvokabular, steht das in einem Satz, danach nichts. Beginne " +
      "direkt mit der ersten Zeile.",
    quiz:
      "Schreib für jemanden, der prüfen will, ob er den Stoff des Videos verstanden hat. " +
      "Acht bis zwölf Fragen zu dem, was das Video lehrt oder behauptet – Zusammenhänge, " +
      "Begründungen, Zahlen, Abläufe –, nicht zu Beiläufigem. Jede Frage so, dass sie " +
      "sich nur mit dem Inhalt des Videos beantworten lässt, nicht mit Allgemeinwissen. " +
      "Die Frage steht fett und nummeriert in einer eigenen Zeile. " +
      "Darunter die Antwort als Zitatblock – die Zeile beginnt mit „> “ –, in ein bis " +
      "zwei Sätzen, so wie der Sprecher sie gibt, mit seinen Zahlen und Begriffen, am " +
      "Ende der Zeitstempel der Stelle in der Schreibweise des Transkripts. Nach jedem " +
      "Zitatblock eine Leerzeile, sonst hängt die nächste Frage im Zitat. Der " +
      "Zitatblock trennt Antwort von Frage sichtbar; ohne ihn verschwimmt beides zu " +
      "einem Absatz. " +
      "Keine Frage, deren Antwort im Video fehlt. Reihenfolge des Videos. " +
      "Kein Einleitungs- und kein Schlusssatz. Beginne direkt mit der ersten Frage.",
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
      "Do not retell the flow and do not use phrases like \"the video covers\", " +
      "\"they talk about\", \"the host explains\". " +
      "Leave out side topics, examples and anecdotes, even if they take up a lot of the " +
      "transcript. " +
      "Prose, no headings, no bullet points and no timestamps – no jump marks even if the transcript carries them. " +
      "Start with the first sentence, no preamble.",
    summary_medium:
      "Summarise the video for someone who will not watch it and wants to know in a " +
      "few minutes what is said in it. " +
      "One paragraph per topic, four at most; a video with more topics (news, podcast) " +
      "gets the four most important. " +
      "Each paragraph opens in bold " +
      "with the topic as a short statement of three to eight words, not a keyword: not " +
      "\"**Battery**\" but \"**The battery lasts two days.**\" Then, on the same line, two " +
      "to four further sentences: what the speaker says about it, what supports it (figure, " +
      "example, evidence) and what the speaker qualifies. " +
      "Order by weight, not by position in the video. If a topic comes up more than " +
      "once, everything about it goes into one paragraph. " +
      "No headings, no lists, no timestamps – no jump marks even if the transcript has " +
      "them. " +
      "Do not retell the flow and avoid phrases like \"the video covers\", \"they talk " +
      "about\", \"the host explains\". " +
      "Leave out greetings, ads and anecdotes without a point. " +
      "Start with the first paragraph, no preamble.",
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
      "One bullet per fact (the line starts with \"- \"), one sentence at most: the fact itself in bold, then what it " +
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
    howto:
      "Write for someone who wants to do the thing themselves, without the video " +
      "running alongside. " +
      "First one sentence: what you end up with, and what you need beforehand as far as " +
      "the speaker names it (devices, software, versions, accounts, cost). " +
      "Then the steps as a numbered list in the order you carry them out. Every step " +
      "starts with the doing, not the topic: not \"Settings\" but \"In Settings under " +
      "Network set the DNS to 1.1.1.1\". " +
      "Commands, code, file names, menu paths, keyboard shortcuts and values are quoted " +
      "verbatim; commands and code in a code block. " +
      "What the speaker only shows on screen without saying it (\"this command here\") " +
      "is not guessed: that spot reads \"(only shown, see video)\". " +
      "Every step ends with the timestamp where it starts, written the way the " +
      "transcript writes it, so the screen can be watched alongside. " +
      "Warnings, prerequisites, errors the speaker names and alternatives (\"on Windows " +
      "use … instead\") go with the step they belong to, not collected at the end. " +
      "Why something works appears only as a half sentence and only where one would " +
      "otherwise pick a wrong value. " +
      "If the speaker shows several routes to the same goal, one list per route with a " +
      "heading (##). " +
      "Leave out background, opinion and comparisons with other videos. " +
      "If the video contains no instructions, say so in one sentence and nothing more. " +
      "Start with the first sentence.",
    pro_contra:
      "Write for someone who has to decide – buy it or not, agree or not – and needs " +
      "the arguments of both sides as the video supplies them. " +
      "First one sentence: what this is about (the product tested or the contested " +
      "claim) and what the speaker concludes. " +
      "Then two lists with headings (##): For and Against. Every item is a full " +
      "sentence with the argument and its evidence – measurement, price, comparison, " +
      "demonstration, experience – not a keyword: not \"good battery\" but \"The battery " +
      "lasted 14 hours in the speaker's test, the predecessor 9\". One timestamp " +
      "written the way the transcript writes it after measurements and demonstrations, " +
      "at most one per item. " +
      "Order by the weight the speaker gives the argument, not by sequence. An argument " +
      "the speaker refutes himself appears with that refutation, not as an open one. " +
      "With several people, say who holds it. " +
      "Items in both lists start with \"- \". " +
      "Close with a section under a heading (##) and up to three bullets, each only if " +
      "the video supplies it: \"**For whom**\" – " +
      "who he recommends it to and who not; \"Alternatives\" – what he names instead, " +
      "with his reason; \"Not tested\" – what he explicitly leaves open. " +
      "If there are several contested questions (discussion, podcast), one For/Against " +
      "block per question, ordered by weight, and at the end one sentence on what the " +
      "participants agree about. " +
      "No judgement and no argument of your own: what stands here was said by someone " +
      "in the video. If one side is missing from the video, say so in one sentence " +
      "instead of inventing a list. Start with the first sentence.",
    claims:
      "Write for someone who wants to check whether what the video says is true, and " +
      "needs to know what exactly is claimed and what it rests on. " +
      "A list of the claims the video rests on: facts, figures, cause and effect, " +
      "comparisons, predictions. Not: taste, the obvious, the incidental. " +
      "Every claim is its own paragraph, separated from the next by a blank line (a " +
      "bare line break is not enough, it collapses into running text). The paragraph " +
      "opens with the claim as one bold sentence, phrased so it can be checked without " +
      "the video: with subject, figure, period and place as the speaker gives them; for " +
      "a prediction with the point in time it applies to. " +
      "Then, in the same paragraph, one sentence on what the speaker rests it on, led by " +
      "one of these labels: " +
      "**Measured** (own test, own figure), **Source** (study, report, person – with " +
      "the name he gives; if he gives none: \"source, not named\"), **Shown** " +
      "(demonstration in the video), **Experience** (own experience), **Unsupported** " +
      "(merely asserted). At the end of that sentence the timestamp written the way the " +
      "transcript writes it, several spots in one bracket; if the transcript has no " +
      "timestamps, it is omitted. " +
      "What the speaker qualifies himself (\"probably\", \"I reckon\") or reports as " +
      "someone else's view without adopting it keeps that qualification. " +
      "Order: first the claims without which the video loses its point, then the rest. " +
      "At most 15; if the video has more, the 15 whose refutation would damage it most. " +
      "No assessment of whether a claim is true, no introduction, no conclusion – the " +
      "list is the whole answer. If the video contains no checkable claims, say so in " +
      "one sentence and nothing more. Start with the first claim.",
    chapters:
      "Break the video down into chapters, for someone who wants to jump to a spot. " +
      "A new chapter starts where a new question or subject starts, not at every change " +
      "of speaker or example; a ten-minute video usually has four to eight chapters, a " +
      "two-hour one rarely more than twenty. " +
      "One bullet per chapter (the line starts with \"- \"): the timestamp written the way " +
      "the transcript writes it and a heading in bold, then after a dash one or two " +
      "sentences saying what is claimed or shown " +
      "there: not \"here he talks about the battery\" but \"The battery lasts two days, " +
      "measured without 5G\". " +
      "Keep the order of the video. Start with the first chapter.",
    comparison:
      "Lay out what the video compares as a table. " +
      "It may be two or three products, methods, positions, licences, tools or points " +
      "in time - whatever the video actually sets against each other. " +
      "First column: the feature. Then one column per compared thing, its name as the " +
      "heading. " +
      "Five to eight rows, each a feature the video addresses for **every** side. If it " +
      "says nothing about one side, write \"not stated\" in that cell - invent nothing " +
      "and infer nothing from silence. " +
      "Cells hold short statements, not paragraphs; numbers and units exactly as spoken. " +
      "One word per cell may be **bold**, at most one. " +
      "Then a section **In short:** with one bullet per compared thing, each a single " +
      "sentence putting it in its own terms. " +
      "Finally, after a blank line as its own paragraph, **The difference that matters:** " +
      "– the single point a decision " +
      "between them turns on. " +
      "If the video compares nothing, say so in one sentence and offer the summary " +
      "instead. " +
      "No timestamps inside the table; if a statement deserves a jump mark, put it in " +
      "the short section.",
    glossary:
      "Write for someone who wants to learn or look up the technical vocabulary of the " +
      "video. " +
      "A list of the terms, methods, models and named procedures the speaker uses and " +
      "explains or evidently takes for granted. " +
      "One bullet per term (the line starts with \"- \"): the term in bold and in the " +
      "original language, then in one or " +
      "two sentences what it means according to the speaker and what he uses it for – " +
      "his explanation, not a general one. If he does not explain it, write \"(not " +
      "explained)\" and add nothing. If he distinguishes it from another term, the " +
      "distinction goes with it. " +
      "At the end of the line the timestamp written the way the transcript writes it, " +
      "where he explains or first uses it. " +
      "Order: first the terms without which the video cannot be understood, then the " +
      "rest; at most 20, if there are more the 20 most important. " +
      "No opening or closing sentence – the list is the whole answer. If the video " +
      "contains no technical vocabulary, say so in one sentence and nothing more. Start " +
      "with the first line.",
    quiz:
      "Write for someone who wants to check whether they have understood the material " +
      "of the video. " +
      "Eight to twelve questions on what the video teaches or claims – connections, " +
      "reasons, figures, procedures – not on the incidental. Every question phrased so " +
      "it can only be answered from the video, not from general knowledge. " +
      "The question stands in bold and numbered on a line of its own. " +
      "Below it the answer as a block quote – the line starts with \"> \" – in one or " +
      "two sentences as the speaker gives it, with his figures and terms, ending with " +
      "the timestamp of the spot, written the way the transcript writes it. A blank line " +
      "after every block quote, otherwise the next question hangs inside the quote. The block " +
      "quote keeps answer and question visibly apart; without it the two blur into one " +
      "paragraph. " +
      "No question whose answer the video does not contain. Keep the order of the " +
      "video. No opening or closing sentence. Start with the first question.",
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


/**
 * Stimmung der Kommentare. Grundlage sind die Top-Kommentare mit ihren Likes (bis zu 100,
 * `kommentareAlsText`), nicht alle: YouTube sortiert dort nach Zustimmung, die Auswahl ist
 * also das, was Zuschauer zuerst sehen – und nicht repräsentativ für alle Kommentare. Das
 * soll die Antwort auch sagen.
 */
export function kommentarStimmungPrompt(uiLang: "de" | "en", anzahl: number, gesamt: string): string {
  if (uiLang === "de") {
    return (
      `Unten stehen die ${anzahl} obersten Kommentare zu diesem Video (YouTube-Sortierung ` +
      `„Top“${gesamt ? `, insgesamt ${gesamt}` : ""}), je mit ihren Likes. Werte ihre Stimmung ` +
      `gegenüber dem Video aus:\n` +
      `1. Eine Zeile: Anteil positiv / neutral / negativ in Prozent, gezählt je Kommentar; ` +
      `danach ein Satz, ob die Likes das Bild verschieben (etwa wenn kritische Kommentare ` +
      `viel Zustimmung haben).\n` +
      `2. Die häufigsten Lobpunkte und die häufigsten Kritikpunkte, je höchstens vier, ` +
      `knapp, mit ungefährer Häufigkeit.\n` +
      `3. Höchstens drei kurze, typische Zitate im Wortlaut.\n` +
      `Witze, Zeitstempel-Kommentare und Grüsse zählen als neutral. Sag am Ende in einem ` +
      `Satz, dass nur die obersten Kommentare ausgewertet sind. Erfinde nichts, was nicht ` +
      `in den Kommentaren steht.`
    );
  }
  return (
    `Below are the top ${anzahl} comments on this video (YouTube's "Top" sort` +
    `${gesamt ? `, ${gesamt} in total` : ""}), each with its likes. Assess their sentiment ` +
    `towards the video:\n` +
    `1. One line: share positive / neutral / negative in percent, counted per comment; then ` +
    `one sentence on whether the likes shift the picture.\n` +
    `2. The most frequent praise and criticism, at most four each, brief, with rough frequency.\n` +
    `3. At most three short, typical verbatim quotes.\n` +
    `Jokes, timestamp comments and greetings count as neutral. End with one sentence saying ` +
    `only the top comments were assessed. Invent nothing that is not in the comments.`
  );
}
