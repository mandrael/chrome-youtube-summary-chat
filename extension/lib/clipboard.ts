/**
 * Kopieren mit zwei Formaten: Markdown als Text, dazu formatiertes HTML.
 *
 * Das Betriebssystem hält beide Fassungen nebeneinander, und das Zielprogramm nimmt
 * sich, was es braucht – Word, Pages und Google Docs greifen zum HTML und behalten
 * Überschriften, Listen und Fettdruck, ein Editor nimmt den Markdown-Text. Chromium
 * bildet die beiden MIME-Typen auf die nativen Formate ab: `CF_HTML` und
 * `CF_UNICODETEXT` unter Windows, `NSPasteboard` unter macOS, MIME-Targets unter
 * X11/Wayland. Es ist derselbe Aufruf auf allen drei Systemen.
 *
 * Der Rückfall auf reinen Text ist kein Schmuck: `ClipboardItem` fehlt in älteren
 * Umgebungen, und ein fehlgeschlagenes `write()` darf nicht heissen, dass gar nichts
 * in der Zwischenablage landet.
 */
export async function kopiereMitFormat(markdown: string, html: string): Promise<void> {
  try {
    if (typeof ClipboardItem === "function" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([markdown], { type: "text/plain" }),
          "text/html": new Blob([huelle(html)], { type: "text/html" }),
        }),
      ]);
      return;
    }
  } catch {
    /* Weiter unten mit reinem Text – besser als nichts in der Zwischenablage. */
  }
  await navigator.clipboard.writeText(markdown);
}

/**
 * Macht aus einem gerenderten Element sauberes HTML für die Zwischenablage.
 *
 * Die Zeitstempel sind im Chat `<button>`-Elemente, damit man springen kann. In einem
 * Textverarbeitungsprogramm ist ein Knopf sinnlos, sein Text aber wichtig – deshalb wird
 * er durch seinen Inhalt ersetzt. Klassenattribute fliegen mit raus: die zugehörigen
 * Stile stecken im Shadow DOM und kommen ohnehin nicht mit.
 */
export function elementZuHtml(el: Element): string {
  const klon = el.cloneNode(true) as HTMLElement;
  for (const knopf of [...klon.querySelectorAll("button")]) {
    knopf.replaceWith(document.createTextNode(knopf.textContent ?? ""));
  }
  for (const kind of [...klon.querySelectorAll("[class]")]) kind.removeAttribute("class");
  klon.removeAttribute("class");
  return klon.innerHTML;
}

/** Ohne Kopf mit Zeichensatz kommen Umlaute in manchen Zielen als Fragezeichen an. */
function huelle(inhalt: string): string {
  return `<meta charset="utf-8">${inhalt}`;
}
