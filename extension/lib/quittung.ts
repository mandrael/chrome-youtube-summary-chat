import * as React from "react";

/**
 * Kurz ein Häkchen statt des Symbols, wie ChatGPTs Kopierknopf: der Klick hat gewirkt.
 * Gedacht für Knöpfe, deren Wirkung man sonst nicht sieht – Kopieren, Datei speichern.
 * Ein zweiter Klick verlängert die Anzeige, statt sie vorzeitig zu beenden.
 */
export function useQuittung(ms = 1500): [boolean, () => void] {
  const [an, setAn] = React.useState(false);
  const uhr = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(uhr.current), []);
  const ausloesen = React.useCallback(() => {
    setAn(true);
    window.clearTimeout(uhr.current);
    uhr.current = window.setTimeout(() => setAn(false), ms);
  }, [ms]);
  return [an, ausloesen];
}
