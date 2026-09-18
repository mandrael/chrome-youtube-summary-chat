import React from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ModelInfo } from "@shared/lib/types";

/**
 * Auswahlfeld mit Suche für die knapp 300 Modelle.
 *
 * Warum kein Radix-Select mit Filterfeld: Radix setzt den Fokus neu, sobald sich die
 * Liste ändert. Gemessen am 03.09.2026 – nach dem ersten Zeichen lag er auf
 * `[role=listbox]`, danach auf `[role=option]`, im Feld stand ein einzelner Buchstabe,
 * und jeder weitere Anschlag landete im Typeahead des Auswahlfelds. Weder das
 * Zurückholen des Fokus im nächsten Frame noch das Abfangen der Tasten am Content halfen:
 * das eine überschrieb Radix wieder, das andere machte aus dem Feld eine Anzeige ohne
 * Cursor, in der sich nichts mehr korrigieren liess.
 *
 * Deshalb hier ein gewöhnliches Eingabefeld in einem eigenen Panel: markieren,
 * überschreiben, löschen – alles, was ein Suchfeld können muss. Pfeiltasten bewegen die
 * Vorauswahl, Eingabe wählt sie, Esc schliesst.
 */
export function ModellWahl({
  value,
  onChange,
  models,
  empfehlung,
  zeile,
  auslöser,
}: {
  value: string;
  onChange: (id: string) => void;
  models: ModelInfo[];
  /** Kuratierte Auswahl, wird ungefiltert oben gezeigt, solange nicht gesucht wird. */
  empfehlung: readonly (readonly [ModelInfo, string[]])[];
  zeile: (m: ModelInfo, marken?: string[]) => React.ReactNode;
  auslöser: (m: ModelInfo | undefined) => React.ReactNode;
}) {
  const [offen, setOffen] = React.useState(false);
  const [suche, setSuche] = React.useState("");
  const [aktiv, setAktiv] = React.useState(0);
  const huelle = React.useRef<HTMLDivElement>(null);
  const feld = React.useRef<HTMLInputElement>(null);

  const gefiltert = React.useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [models, suche]);

  /*
   * Unter der Empfehlung die vollständige Liste nach Anbietern. Der Anbieter steht im
   * Namen vor dem Doppelpunkt, dem einzigen Feld, aus dem er sich ohne gepflegte Liste
   * ergibt. Anbieter mit ein oder zwei Modellen zerhacken die Liste in Grüppchen und
   * wandern zusammen nach „Weitere" ans Ende.
   */
  const gruppen = React.useMemo(() => {
    const nachAnbieter = new Map<string, ModelInfo[]>();
    for (const m of gefiltert) {
      const anbieter = m.name.includes(":") ? m.name.split(":")[0]!.trim() : "Weitere";
      const bisher = nachAnbieter.get(anbieter);
      if (bisher) bisher.push(m);
      else nachAnbieter.set(anbieter, [m]);
    }
    const gross: [string, ModelInfo[]][] = [];
    const klein: ModelInfo[] = [];
    for (const [anbieter, liste] of nachAnbieter) {
      if (anbieter !== "Weitere" && liste.length >= 3) gross.push([anbieter, liste]);
      else klein.push(...liste);
    }
    if (klein.length) gross.push(["Weitere", klein]);
    return gross;
  }, [gefiltert]);

  const sucht = suche.trim().length > 0;
  // Reihenfolge der Tastaturnavigation – dieselbe, in der gerendert wird.
  const reihenfolge = React.useMemo(
    () => (sucht ? gefiltert : [...empfehlung.map(([m]) => m), ...gruppen.flatMap(([, l]) => l)]),
    [sucht, gefiltert, empfehlung, gruppen],
  );

  React.useEffect(() => setAktiv(0), [suche, offen]);

  // Klick daneben schliesst. `mousedown` statt `click`, sonst schliesst das Panel erst
  // nach dem Klick auf einen Eintrag und verschluckt ihn.
  React.useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [offen]);

  React.useEffect(() => {
    if (offen) feld.current?.focus();
    else setSuche("");
  }, [offen]);

  function waehle(id: string) {
    onChange(id);
    setOffen(false);
  }

  function taste(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOffen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktiv((i) => Math.min(i + 1, reihenfolge.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktiv((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = reihenfolge[aktiv];
      if (m) waehle(m.id);
    }
  }

  const gewaehlt = models.find((m) => m.id === value);

  return (
    <div ref={huelle} className="relative">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-sm"
      >
        <span className="flex min-w-0 items-center gap-1.5">{auslöser(gewaehlt)}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </button>

      {offen && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 flex max-h-96 flex-col overflow-hidden rounded-md border border-border bg-card shadow-md">
          <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
            <Search className="size-3.5 shrink-0 opacity-60" />
            <Input
              ref={feld}
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              onKeyDown={taste}
              placeholder="Suchen – Name oder Slug"
              className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="overflow-y-auto p-1">
            {reihenfolge.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Kein Modell passt zu „{suche}".
              </p>
            ) : (
              <>
                {!sucht && empfehlung.length > 0 && (
                  <Abschnitt titel="Empfohlen">
                    {empfehlung.map(([m, marken], i) => (
                      <Eintrag
                        key={`tipp-${m.id}`}
                        aktiv={reihenfolge[aktiv]?.id === m.id && i === aktiv}
                        gewaehlt={m.id === value}
                        onClick={() => waehle(m.id)}
                      >
                        {zeile(m, marken)}
                      </Eintrag>
                    ))}
                  </Abschnitt>
                )}
                {gruppen.map(([anbieter, liste]) => (
                  <Abschnitt key={anbieter} titel={anbieter}>
                    {liste.map((m) => (
                      <Eintrag
                        key={m.id}
                        aktiv={reihenfolge[aktiv]?.id === m.id}
                        gewaehlt={m.id === value}
                        onClick={() => waehle(m.id)}
                      >
                        {zeile(m)}
                      </Eintrag>
                    ))}
                  </Abschnitt>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{titel}</p>
      {children}
    </div>
  );
}

function Eintrag({
  aktiv,
  gewaehlt,
  onClick,
  children,
}: {
  aktiv: boolean;
  gewaehlt: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLButtonElement>(null);
  // Die Vorauswahl muss sichtbar bleiben, wenn sie mit den Pfeiltasten aus dem Bild läuft.
  React.useEffect(() => {
    if (aktiv) ref.current?.scrollIntoView({ block: "nearest" });
  }, [aktiv]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start rounded-sm px-2 py-1.5 text-left text-sm",
        aktiv && "bg-accent text-accent-foreground",
        gewaehlt && !aktiv && "bg-muted",
      )}
    >
      {children}
    </button>
  );
}
