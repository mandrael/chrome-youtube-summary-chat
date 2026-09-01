import { AudioLines, Copy, Download } from "lucide-react";
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
  if (!transcript) {
    return <p className="p-3 text-sm text-muted-foreground">{t("loadingTranscript")}</p>;
  }

  if (busy) {
    return <p className="p-3 text-sm text-muted-foreground">{busy}</p>;
  }

  const withHours =
    (transcript.cues.at(-1)?.start ?? 0) + (transcript.cues.at(-1)?.dur ?? 0) >= 3600;
  const text = transcriptToText(transcript);

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
            className="max-w-[60%] truncate rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs text-foreground"
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
        <div className="ml-auto flex gap-0.5">
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

      <div className="flex-1 overflow-y-auto px-3 py-2 text-sm min-h-32">
        {transcript.hasTimestamps ? (
          transcript.cues.map((c, i) => (
            <p key={i} className="mb-1 leading-snug">
              <button
                type="button"
                onClick={() => onSeek(c.start)}
                className="mr-1.5 font-mono text-xs text-primary hover:underline cursor-pointer"
              >
                [{formatTs(c.start, withHours)}]
              </button>
              {c.text}
            </p>
          ))
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
