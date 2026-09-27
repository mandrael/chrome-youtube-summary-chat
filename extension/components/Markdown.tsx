import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  duenneMarkenAus,
  TS_GROUP_PATTERN,
  TS_RANGE_SEP,
  TS_SINGLE,
  tsToSeconds,
} from "@shared/lib/timestamps";
import { cn } from "@/lib/utils";

/* Minimal-Typen für den hast-Baum – ein Paket dafür wäre hier Ballast. */
interface HNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
}

/**
 * Ersetzt [mm:ss] und [hh:mm:ss] in Textknoten durch anklickbare Buttons.
 *
 * Läuft als rehype-Plugin und damit nach der Markdown-Umwandlung, aber vor dem Rendern.
 * Code- und Pre-Blöcke bleiben ausgespart: ein Zeitstempel-Button in einem Codeblock
 * wäre falsch und würde die Syntaxhervorhebung zerlegen.
 */
function rehypeTimestamps() {
  return (tree: HNode) => walk(tree);
}

function walk(node: HNode): void {
  if (!node.children) return;
  if (node.tagName === "code" || node.tagName === "pre") return;

  const out: HNode[] = [];
  let changed = false;

  for (const child of node.children) {
    if (child.type !== "text" || !child.value) {
      walk(child);
      out.push(child);
      continue;
    }
    const parts = splitTimestamps(child.value);
    if (parts === null) {
      out.push(child);
    } else {
      changed = true;
      out.push(...parts);
    }
  }
  if (changed) node.children = out;
}

/** null, wenn der Text keinen Zeitstempel enthält – dann bleibt der Knoten unangetastet. */
function splitTimestamps(text: string): HNode[] | null {
  TS_GROUP_PATTERN.lastIndex = 0;
  const out: HNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = TS_GROUP_PATTERN.exec(text)) !== null) {
    // „[18:46]–[21:03]“: die zweite Klammer ist das Ende einer Spanne und bleibt Text.
    if (out.length && TS_RANGE_SEP.test(text.slice(last, m.index))) continue;
    const knoepfe = zeitKnoepfe(m[1] ?? "");
    if (!knoepfe.length) continue;
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    // Die Klammern bleiben Text, jede Zeit darin wird ein eigener Knopf.
    out.push({ type: "text", value: "[" });
    out.push(...knoepfe);
    out.push({ type: "text", value: "]" });
    last = m.index + m[0].length;
  }

  if (!out.length) return null;
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/** Aus „18:46, 21:03“ werden zwei Knöpfe mit dem Komma dazwischen. */
function zeitKnoepfe(inhalt: string): HNode[] {
  TS_SINGLE.lastIndex = 0;
  const treffer: { index: number; laenge: number; sekunden: number }[] = [];
  let t: RegExpExecArray | null;
  let ende = 0;
  while ((t = TS_SINGLE.exec(inhalt)) !== null) {
    const seconds = tsToSeconds(t[1], t[2], t[3]);
    // Das Ende einer Spanne bleibt Text: verlinkt ist nur ihr Anfang.
    const spannenEnde = treffer.length > 0 && TS_RANGE_SEP.test(inhalt.slice(ende, t.index));
    ende = t.index + t[0].length;
    if (seconds !== null && !spannenEnde) {
      treffer.push({ index: t.index, laenge: t[0].length, sekunden: seconds });
    }
  }
  // Zu dichte Marken belegen dieselbe Stelle und fallen samt Trennzeichen weg.
  const behalten = duenneMarkenAus(treffer.map((x) => x.sekunden));

  const out: HNode[] = [];
  let last = 0;
  for (let k = 0; k < treffer.length; k++) {
    const x = treffer[k]!;
    if (!behalten[k]) {
      last = x.index + x.laenge;
      continue;
    }
    if (x.index > last) out.push({ type: "text", value: inhalt.slice(last, x.index) });
    out.push({
      type: "element",
      tagName: "button",
      properties: { dataTs: String(x.sekunden), type: "button" },
      children: [{ type: "text", value: inhalt.slice(x.index, x.index + x.laenge) }],
    });
    last = x.index + x.laenge;
  }
  if (last < inhalt.length) out.push({ type: "text", value: inhalt.slice(last) });
  return out;
}

export interface MarkdownProps {
  children: string;
  /** Setzt die Wiedergabeposition. Fehlt sie, werden Zeitstempel nur als Text gezeigt. */
  onSeek?: (seconds: number) => void;
  className?: string;
}

/**
 * Tabelle, die sich der Breite der Seitenleiste anpasst.
 *
 * Ueber 380 px bleibt es eine gewoehnliche Tabelle. Darunter wird jede Zeile zu einer
 * Karte, in der jede Zelle ihre Spaltenueberschrift vorangestellt bekommt - eine
 * dreispaltige Vergleichstabelle ist in einer 300-px-Spalte sonst unlesbar.
 *
 * Gemessen wird der Container, nicht das Fenster: Die Seitenleiste ist in der Breite
 * verstellbar, ein Media-Query auf die Fensterbreite ginge daran vorbei.
 */
function TabelleAdaptiv({ children }: { children?: React.ReactNode }) {
  const huelle = React.useRef<HTMLDivElement>(null);
  const [schmal, setSchmal] = React.useState(false);

  React.useEffect(() => {
    const el = huelle.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const beobachter = new ResizeObserver((eintraege) => {
      const breite = eintraege[0]?.contentRect.width;
      if (breite !== undefined) setSchmal(breite < 380);
    });
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  const { kopf, zeilen } = React.useMemo(() => zerlegeTabelle(children), [children]);

  if (!schmal || kopf.length === 0) {
    return (
      <div ref={huelle} className="my-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    );
  }

  return (
    <div ref={huelle} className="my-3 flex flex-col gap-2">
      {zeilen.map((zeile, i) => (
        <div key={i} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          {zeile.map((zelle, j) => (
            <p key={j} className="py-0.5 text-sm leading-snug">
              <span className="text-muted-foreground">{kopf[j] ?? ""}: </span>
              {zelle}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Holt Kopfzeile und Datenzeilen aus dem React-Baum, den react-markdown liefert. */
function zerlegeTabelle(children: React.ReactNode): {
  kopf: React.ReactNode[];
  zeilen: React.ReactNode[][];
} {
  const kopf: React.ReactNode[] = [];
  const zeilen: React.ReactNode[][] = [];

  const zellen = (tr: React.ReactElement): React.ReactNode[] =>
    React.Children.toArray(
      (tr.props as { children?: React.ReactNode }).children,
    ).map((td) =>
      React.isValidElement(td)
        ? (td.props as { children?: React.ReactNode }).children
        : td,
    );

  for (const teil of React.Children.toArray(children)) {
    if (!React.isValidElement(teil)) continue;
    const reihen = React.Children.toArray(
      (teil.props as { children?: React.ReactNode }).children,
    ).filter(React.isValidElement);
    if (teil.type === "thead") {
      if (reihen[0]) kopf.push(...zellen(reihen[0]));
    } else if (teil.type === "tbody") {
      for (const tr of reihen) zeilen.push(zellen(tr));
    }
  }
  return { kopf, zeilen };
}

export function Markdown({ children, onSeek, className }: MarkdownProps) {
  return (
    <div className={cn("md-body", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeTimestamps, rehypeHighlight]}
        components={{
          table: ({ node: _n, children: c }) => <TabelleAdaptiv>{c}</TabelleAdaptiv>,
          a: ({ node: _n, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener" />
          ),
          button: ({ node, children: c }) => {
            const raw = (node?.properties as Record<string, unknown> | undefined)?.dataTs;
            const seconds = Number(raw);
            if (!Number.isFinite(seconds) || !onSeek) return <span>{c}</span>;
            return (
              <button
                type="button"
                onClick={() => onSeek(seconds)}
                className="text-primary hover:underline font-medium cursor-pointer"
                title="Zu dieser Stelle springen"
              >
                {c}
              </button>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
