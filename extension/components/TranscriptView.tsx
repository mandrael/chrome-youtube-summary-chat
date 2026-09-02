import * as React from "react";
import { AudioLines, Copy, Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTs, transcriptToText } from "@/lib/timestamps";
import type { T } from "@/lib/i18n";
import type { CaptionTrack, Transcript } from "@/lib/types";

export function TranscriptView({
  t,
  transcript,
  videoId,
  onSeek,
  onDownload,
  tracks,
  activeTrack,
  onSwitchTrack,
  onForceAudio,
  busy,
}: {
  t: T;
  transcript: Transcript | null;
  videoId: string;
  onSeek: (seconds: number) => void;
  onDownload: (name: string, content: string) => void;
  /** Die tatsaechlich vorhandenen Spuren dieses Videos. */
  tracks: CaptionTrack[];
  activeTrack: CaptionTrack | null;
  onSwitchTrack: (track: CaptionTrack) => void;
  onForceAudio?: () => void;
  busy?: string | null;
}) {
  const [suche, setSuche] = React.useState("");

  if (!transcript) {
    return <p className="p-3 text-sm text-muted-foreground">{t("loadingTranscript")}</p>;
  }

  if (busy) {
    return <p className="p-3 text-sm text-muted-foreground">{busy}</p>;
  }

  const withHours =
    (transcript.cues.at(-1)?.start ?? 0) + (transcript.cues.at(-1)?.dur ?? 0) >= 3600;
  const text = transcriptToText(transcript);

  const suchbegriff = suche.trim().toLowerCase();
  const zeilen = suchbegriff
    ? transcript.cues.filter((c) => c.text.toLowerCase().includes(suchbegriff))
    : transcript.cues;

  return (
    <>
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        {tracks.length > 1 && activeTrack ? (
          // Welche Spuren es gibt, weiss erst die Seite - deshalb steht die Wahl
          // hier und nicht in den Optionen. Natives select: im Shadow DOM kommt es
          // ohne Portal aus.
          <select
            value={activeTrack.url}
            onChange={(e) => {
              const next = tracks.find((tr) => tr.url === e.target.value);
              if (next) onSwitchTrack(next);
            }}
            title={t("captionLangHint")}
            className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs text-foreground"
          >
            {tracks.map((tr) => (
              <option key={tr.url} value={tr.url}>
                {tr.name}
                {tr.auto && !/automatisch|auto-generated/i.test(tr.name)
                  ? " (automatisch)"
                  : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="truncate text-xs text-muted-foreground">
            {t("transcriptSource")}: {transcript.source}
          </span>
        )}
        <div className="ml-auto flex shrink-0 gap-0.5">
          {onForceAudio && (
            <Button
              size="iconSm"
              variant="ghost"
              title={t("forceAudioHint")}
              disabled={!!busy}
              onClick={onForceAudio}
            >
              <AudioLines />
            </Button>
          )}
          <Button
            size="iconSm"
            variant="ghost"
            title={t("copy")}
            onClick={() => void navigator.clipboard.writeText(text)}
          >
            <Copy />
          </Button>
          <Button
            size="iconSm"
            variant="ghost"
            title={t("exportMd")}
            onClick={() => onDownload(`transkript-${videoId}.md`, text)}
          >
            <Download />
          </Button>
        </div>
      </div>

      {transcript.hasTimestamps && (
        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder={t("searchTranscript")}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          />
          {suchbegriff && (
            <>
              <span className="shrink-0 text-xs text-muted-foreground">
                {zeilen.length} {t("hits")}
              </span>
              <Button size="iconSm" variant="ghost" title={t("clearSearch")} onClick={() => setSuche("")}>
                <X />
              </Button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 text-sm min-h-32">
        {transcript.hasTimestamps ? (
          zeilen.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noHits")}</p>
          ) : (
            zeilen.map((c, i) => (
              <p key={i} className="mb-1 leading-snug">
                <button
                  type="button"
                  onClick={() => onSeek(c.start)}
                  className="mr-1.5 shrink-0 font-mono text-xs text-primary hover:underline cursor-pointer"
                >
                  [{formatTs(c.start, withHours)}]
                </button>
                {hervorheben(c.text, suchbegriff)}
              </p>
            ))
          )
        ) : (
          <>
            <p className="mb-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {t("noTimestamps")}
            </p>
            <p className="whitespace-pre-wrap leading-snug">{text}</p>
          </>
        )}
      </div>
    </>
  );
}

/** Hebt den Suchbegriff in einer Zeile hervor, ohne HTML aus dem Transkript zu bauen. */
function hervorheben(text: string, begriff: string): React.ReactNode {
  if (!begriff) return text;
  const teile: React.ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (true) {
    const pos = rest.toLowerCase().indexOf(begriff);
    if (pos < 0) break;
    if (pos > 0) teile.push(rest.slice(0, pos));
    teile.push(
      <mark key={i++} className="rounded-sm bg-primary/20 text-foreground">
        {rest.slice(pos, pos + begriff.length)}
      </mark>,
    );
    rest = rest.slice(pos + begriff.length);
  }
  teile.push(rest);
  return teile;
}
