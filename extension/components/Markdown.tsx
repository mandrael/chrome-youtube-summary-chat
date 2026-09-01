import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { TS_PATTERN, tsToSeconds } from "@/lib/timestamps";
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
  TS_PATTERN.lastIndex = 0;
  const out: HNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = TS_PATTERN.exec(text)) !== null) {
    const seconds = tsToSeconds(m[1], m[2], m[3]);
    if (seconds === null) continue;
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({
      type: "element",
      tagName: "button",
      properties: { dataTs: String(seconds), type: "button" },
      children: [{ type: "text", value: m[0] }],
    });
    last = m.index + m[0].length;
  }

  if (!out.length) return null;
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

export interface MarkdownProps {
  children: string;
  /** Setzt die Wiedergabeposition. Fehlt sie, werden Zeitstempel nur als Text gezeigt. */
  onSeek?: (seconds: number) => void;
  className?: string;
}

export function Markdown({ children, onSeek, className }: MarkdownProps) {
  return (
    <div className={cn("md-body", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeTimestamps, rehypeHighlight]}
        components={{
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
