/**
 * Breite der rechten YouTube-Spalte.
 *
 * Es genügt, `--ytd-watch-flexy-sidebar-width` zu überschreiben – YouTube schreibt den
 * Wert als Inline-Custom-Property auf `ytd-watch-flexy`, eine Autorenregel mit
 * `!important` gewinnt also auch nach jedem Resize. `#columns` und `#primary` hängen an
 * derselben Variablen, den Rest erledigt Flexbox: `#secondary` schrumpft bis
 * `--ytd-watch-flexy-sidebar-min-width`, `#primary` bis zur Mindestbreite des Players.
 *
 * `--ytd-watch-flexy-max-player-width` wird bewusst **nicht** angefasst. Sie ist keine
 * Breiten-, sondern eine Höhendeckelung – `calc((100vh - Kopf - Ränder) * 16/9)`. Eine
 * eigene Formel aus `100vw` hebt den Deckel auf: gemessen am 02.09.2026 stand der Player
 * bei 1600x600 dann 884x663 px gross und ragte aus dem Fenster; ohne die Regel sind es
 * 645x484 px.
 *
 * Der Selektor schliesst drei Fälle aus, in denen die Spalte nicht neben dem Player
 * liegt: Theater, Vollbild und `fixed-panels` (Live-Chat als fixiertes Panel, dort ginge
 * die Breite doppelt in Padding und Panel ein). `[is-two-columns_]` ist die Bedingung
 * dafür, dass es überhaupt eine rechte Spalte gibt – unter rund 1000 px Fensterbreite
 * blendet YouTube `#secondary` samt Sidebar aus.
 */

export const SPALTE_MIN = 360;
export const SPALTE_MAX = 1000;

let element: HTMLStyleElement | null = null;

/** Setzt die Breite sofort, ohne den Umweg über die Einstellungen. */
export function setzeSpaltenbreite(px: number): void {
  const breite = Math.round(Math.min(SPALTE_MAX, Math.max(SPALTE_MIN, px)));
  if (!element) {
    element = document.createElement("style");
    element.id = "yt-summary-chat-breite";
    document.head.appendChild(element);
  }
  element.textContent = `ytd-watch-flexy[is-two-columns_]:not([theater]):not([fullscreen]):not([fixed-panels]) {
  --ytd-watch-flexy-sidebar-width: ${breite}px !important;
}`;
  // YouTube meldet dem Player seine Grösse in JavaScript und nur auf Anlass hin.
  window.dispatchEvent(new Event("resize"));
}

export function entferneSpaltenbreite(): void {
  element?.remove();
  element = null;
}
