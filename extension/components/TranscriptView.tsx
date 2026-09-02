import * as React from "react";
import {
  AlignLeft,
  AudioLines,
  Captions,
  Copy,
  Download,
  Languages,
  Locate,
  LocateFixed,
  Play,
  Search,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTs } from "@/lib/timestamps";
import { bildeAbsaetze } from "@/lib/absaetze";
import { useFollow } from "@/lib/use-follow";
import { ZIELSPRACHEN, langcode, langname } from "@/lib/tracks";
import type { T } from "@/lib/i18n";
import type { CaptionTrack, Transcript, TranscriptTranslation } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Der Transkript-Tab.
 *
 * Zwei unabhängige Achsen, jede mit genau einem sichtbaren Schalter: **wie** man liest
 * (Untertitelzeilen oder Fliesstext) und **was** man liest (Original oder Übersetzung).
 * Ein Dreierschalter, der beides mischt, wäre genau der unklare Zustand, den es hier
 * nicht geben soll.
 *
 * Beide Lesearten teilen dasselbe Zweispalten-Layout: links die Zeitspalte, rechts der
 * Text. Im Fliesstext steht der Zeitstempel nur am Absatzanfang – die Marker mitten im
 * Satz waren der Grund, warum der Fliesstext vorher unlesbar war. Die feinen
 * Sprungmarken sind trotzdem da: jeder Cue ist ein Span, der beim Überfahren seine Zeit
 * zeigt und beim Klick dorthin springt.
 */

export type TranscriptMode = "cues" | "text";

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
  onTranslate,
  translationTarget,
  onTargetChange,
  uiLang = "de",
  translation,
  showTranslation,
  downloadShare = 0,
  mode,
  onMode,
  getVideo,
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
  /** Übersetzen, abbrechen, umschalten oder fortsetzen – je nach Zustand. */
  onTranslate?: () => void;
  translationTarget?: string;
  onTargetChange?: (name: string) => void;
  uiLang?: "de" | "en";
  translation: TranscriptTranslation | null;
  showTranslation: boolean;
  /** Anteil des Modell-Downloads, 0 wenn keiner läuft. */
  downloadShare?: number;
  mode: TranscriptMode;
  onMode: (m: TranscriptMode) => void;
  getVideo?: () => HTMLVideoElement | null;
  busy?: string | null;
}) {
  const [suche, setSuche] = React.useState("");

  const cues = transcript?.cues ?? [];
  const absaetze = React.useMemo(() => bildeAbsaetze(cues), [cues]);
  const suchbegriff = suche.trim().toLowerCase();

  const laeuft = translation?.status === "running";
  const textVon = React.useCallback(
    (i: number): string =>
      (showTranslation && translation?.texts[i]) || cues[i]?.text || "",
    [showTranslation, translation, cues],
  );
  /** Zeile gehört zur Übersetzung, ist aber noch nicht da. */
  const offen = (i: number) => showTranslation && !!translation && translation.texts[i] == null;

  const follow = useFollow(
    cues,
    getVideo ?? (() => null),
    !!transcript?.hasTimestamps,
    `${mode}|${showTranslation}|${suchbegriff}`,
  );

  const withHours =
    (cues.at(-1)?.start ?? 0) + (cues.at(-1)?.dur ?? 0) >= 3600;

  const passt = React.useCallback(
    (i: number) => !suchbegriff || textVon(i).toLowerCase().includes(suchbegriff),
    [suchbegriff, textVon],
  );

  // „Treffer" heisst Fundstellen, nicht gefilterte Zeilen – sonst zeigt die Zahl bei
  // mehreren Vorkommen in einer Zeile weniger an, als markiert ist.
  const trefferzahl = React.useMemo(() => {
    if (!suchbegriff) return 0;
    let n = 0;
    for (let i = 0; i < cues.length; i++)
      n += textVon(i).toLowerCase().split(suchbegriff).length - 1;
    return n;
  }, [cues.length, suchbegriff, textVon]);

  const zeilen = React.useMemo(
    () => cues.map((_, i) => i).filter(passt),
    [cues, passt],
  );
  const absaetzeGefiltert = React.useMemo(
    () =>
      absaetze.filter((a) => {
        if (!suchbegriff) return true;
        for (let i = a.von; i <= a.bis; i++) if (passt(i)) return true;
        return false;
      }),
    [absaetze, suchbegriff, passt],
  );

  /** Was Kopieren und Herunterladen liefern: genau das, was zu sehen ist. */
  const sichtbarerText = () =>
    mode === "cues"
      ? cues
          .map((c, i) => `[${formatTs(c.start, withHours)}] ${textVon(i)}`)
          .join("\n")
      : absaetze
          .map((a) => {
            const teile: string[] = [];
            for (let i = a.von; i <= a.bis; i++) teile.push(textVon(i));
            return `[${formatTs(a.start, withHours)}] ${teile.join(" ")}`;
          })
          .join("\n\n");

  if (!transcript) {
    return <p className="p-3 text-sm text-muted-foreground">{t("loadingTranscript")}</p>;
  }

  if (busy) {
    return <p className="p-3 text-sm text-muted-foreground">{busy}</p>;
  }

  // Quelle und Ziel gleich: es gibt nichts zu übersetzen, der Knopf bleibt aus.
  const zielCode = ZIELSPRACHEN.find(([n]) => n === translationTarget)?.[1];
  const gleicheSprache =
    !!zielCode && !!activeTrack && langcode(activeTrack.lang).split("-")[0] === zielCode;

  const fortschritt = laeuft
    ? downloadShare > 0
      ? downloadShare
      : (translation?.done ?? 0) / Math.max(1, cues.length)
    : 0;

  return (
    <>
      {/*
        Kopfzeile: links die Quelle, rechts die Aktionen darauf. Feste Höhe, weil die
        Spurwahl mal ein Auswahlfeld und mal eine Beschriftung ist.
      */}
      <div className="relative flex h-9 items-center gap-1 border-b border-border px-2">
        {activeTrack && tracks.length > 1 ? (
          <select
            value={activeTrack.url}
            onChange={(e) => {
              const next = tracks.find((tr) => tr.url === e.target.value);
              if (next) onSwitchTrack(next);
            }}
            title={t("captionTrackYouTube")}
            className="spur-select h-6 min-w-0 max-w-[190px] shrink"
          >
            {[...tracks]
              .sort((a, b) => langname(a, uiLang).localeCompare(langname(b, uiLang), uiLang))
              .map((tr) => (
                <option key={tr.url} value={tr.url}>
                  {langname(tr, uiLang)}
                </option>
              ))}
          </select>
        ) : (
          <span
            title={
              activeTrack
                ? `${t("captionTrackYouTube")}: ${langname(activeTrack, uiLang)}`
                : transcript.source
            }
            className="inline-flex h-6 min-w-0 max-w-[190px] items-center truncate px-1 text-xs font-medium text-muted-foreground"
          >
            {activeTrack ? langname(activeTrack, uiLang) : transcript.source}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {/*
            Zielsprache der Übersetzung. Sitzt hier und nicht nur in den Einstellungen,
            weil sie zur Sache gehört: ein deutsches Transkript ins Englische zu
            übersetzen war sonst gar nicht erreichbar. Die Wahl schreibt in die
            Einstellungen zurück und ist damit auch der neue Standard.
          */}
          {onTranslate && onTargetChange && !laeuft && (
            <select
              value={translationTarget}
              onChange={(e) => onTargetChange(e.target.value)}
              title={t("translationTargetTitle")}
              className="spur-select h-6 min-w-0 max-w-[110px] shrink"
            >
              {ZIELSPRACHEN.map(([name]) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          {onTranslate && (
            <Button
              size="iconSm"
              variant={laeuft ? "destructive" : "ghost"}
              aria-pressed={showTranslation}
              className={cn(
                "relative",
                !laeuft && showTranslation && "bg-secondary text-primary",
              )}
              title={
                laeuft
                  ? `${t("cancel")} · ${translation?.done ?? 0}/${cues.length}`
                  : translation?.status === "partial"
                    ? `${t("resumeTranslation")} · ${translation.done}/${cues.length}`
                    : translation && translation.status !== "error"
                      ? showTranslation
                        ? t("showOriginal")
                        : `${t("showTranslation")} (${translation.targetName})`
                      : gleicheSprache
                        ? t("translateSameLang")
                        : `${t("translateAiHint")}: ${activeTrack ? langname(activeTrack, uiLang).replace(/\s*\(auto\)$/, "") : "?"}` +
                          (translationTarget ? ` ➔ ${translationTarget}` : "")
              }
              disabled={!!busy || (gleicheSprache && !translation)}
              onClick={onTranslate}
            >
              {laeuft ? <Square /> : <Languages />}
              {/* Badge: es liegt eine Übersetzung bereit, auch wenn gerade das Original steht. */}
              {!laeuft && translation && translation.status !== "error" && (
                <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 rounded-sm bg-background px-px text-[9px] leading-none text-muted-foreground">
                  {translation.target}
                </span>
              )}
            </Button>
          )}
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
            onClick={() => void navigator.clipboard.writeText(sichtbarerText())}
          >
            <Copy />
          </Button>
          <Button
            size="iconSm"
            variant="ghost"
            title={t("exportMd")}
            onClick={() => onDownload(`transkript-${videoId}.md`, sichtbarerText())}
          >
            <Download />
          </Button>
        </div>

        {/* Fortschritt als 2-px-Linie – kostet keine eigene Zeile. */}
        {laeuft && (
          <span
            className="absolute bottom-0 left-0 h-0.5 bg-primary transition-[width]"
            style={{ width: `${Math.round(fortschritt * 100)}%` }}
          />
        )}
      </div>

      {transcript.hasTimestamps && (
        <div className="flex h-8 items-center gap-1 border-b border-border px-2">
          <div
            role="group"
            aria-label={t("viewMode")}
            className="flex shrink-0 rounded-md border border-border"
          >
            <Button
              size="iconSm"
              variant="ghost"
              aria-pressed={mode === "cues"}
              className={cn(mode === "cues" && "bg-secondary")}
              title={t("viewCues")}
              onClick={() => onMode("cues")}
            >
              <Captions />
            </Button>
            <Button
              size="iconSm"
              variant="ghost"
              aria-pressed={mode === "text"}
              className={cn(mode === "text" && "bg-secondary")}
              title={t("viewText")}
              onClick={() => onMode("text")}
            >
              <AlignLeft />
            </Button>
          </div>
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
                {trefferzahl} {t("hits")}
              </span>
              <Button size="iconSm" variant="ghost" title={t("clearSearch")} onClick={() => setSuche("")}>
                <X />
              </Button>
            </>
          )}
          <Button
            size="iconSm"
            variant="ghost"
            aria-pressed={follow.following}
            className={cn("shrink-0", follow.following && "bg-secondary text-primary")}
            title={follow.following ? t("followOn") : t("followOff")}
            onClick={() => (follow.following ? follow.stop() : follow.jump())}
          >
            {follow.following ? <LocateFixed /> : <Locate />}
          </Button>
        </div>
      )}

      {translation?.status === "error" && (
        <p className="border-b border-border px-3 py-1 text-xs text-destructive">
          {translation.error}
        </p>
      )}

      {/* `relative`, damit `offsetTop` der Zeilen sich auf diesen Container bezieht. */}
      <div
        {...follow.containerProps}
        className="relative flex-1 overflow-y-auto px-3 py-2 text-sm min-h-32 focus-visible:outline-none"
      >
        {!transcript.hasTimestamps ? (
          <>
            <p className="mb-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {t("noTimestamps")}
            </p>
            <p className="whitespace-pre-wrap leading-snug">{sichtbarerText()}</p>
          </>
        ) : mode === "cues" ? (
          zeilen.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noHits")}</p>
          ) : (
            zeilen.map((i) => (
              <React.Fragment key={i}>
                <Zeile
                  i={i}
                  start={cues[i]!.start}
                  text={textVon(i)}
                  pending={offen(i)}
                  aktiv={i === follow.active}
                  withHours={withHours}
                  suchbegriff={suchbegriff}
                  onSeek={onSeek}
                />
                {showTranslation &&
                  translation?.status === "partial" &&
                  i === translation.done - 1 && (
                    <button
                      type="button"
                      onClick={onTranslate}
                      className="mb-1 flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Play className="size-3" /> {t("translateResume")}
                    </button>
                  )}
              </React.Fragment>
            ))
          )
        ) : absaetzeGefiltert.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("noHits")}</p>
        ) : (
          absaetzeGefiltert.map((a) => (
            <p key={a.von} className="mb-2 flex gap-2 leading-relaxed">
              <button
                type="button"
                onClick={() => onSeek(a.start)}
                className={cn(
                  "shrink-0 cursor-pointer self-start pt-[3px] font-mono text-xs tabular-nums text-primary hover:underline",
                  withHours ? "w-[8ch]" : "w-[5ch]",
                )}
              >
                {formatTs(a.start, withHours)}
              </button>
              <span className="min-w-0">
                {Array.from({ length: a.bis - a.von + 1 }, (_, k) => a.von + k).map((i) => (
                  <span
                    key={i}
                    data-cue={i}
                    title={formatTs(cues[i]!.start, withHours)}
                    onClick={() => onSeek(cues[i]!.start)}
                    className={cn(
                      "cursor-pointer rounded-sm hover:bg-accent",
                      i === follow.active && "bg-secondary",
                      offen(i) && "text-muted-foreground",
                    )}
                  >
                    {hervorheben(textVon(i), suchbegriff)}{" "}
                  </span>
                ))}
              </span>
            </p>
          ))
        )}
      </div>
    </>
  );
}

/**
 * Eine Untertitelzeile. Memoisiert, weil bei einer laufenden Übersetzung je Zeile ein
 * Zustandswechsel kommt – ohne das würde bei jeder fertigen Zeile die ganze Liste neu
 * gerendert.
 */
const Zeile = React.memo(function Zeile({
  i,
  start,
  text,
  pending,
  aktiv,
  withHours,
  suchbegriff,
  onSeek,
}: {
  i: number;
  start: number;
  text: string;
  pending: boolean;
  aktiv: boolean;
  withHours: boolean;
  suchbegriff: string;
  onSeek: (s: number) => void;
}) {
  return (
    <p
      data-cue={i}
      className={cn("mb-1 flex gap-2 rounded-sm leading-snug", aktiv && "-mx-1 bg-secondary px-1")}
    >
      <button
        type="button"
        onClick={() => onSeek(start)}
        className={cn(
          "shrink-0 cursor-pointer font-mono text-xs tabular-nums hover:underline",
          withHours ? "w-[8ch]" : "w-[5ch]",
          aktiv ? "text-foreground" : "text-primary",
        )}
      >
        {formatTs(start, withHours)}
      </button>
      <span className={cn("min-w-0", pending && "text-muted-foreground")}>
        {hervorheben(text, suchbegriff)}
      </span>
    </p>
  );
});

/** Hebt den Suchbegriff hervor, ohne HTML aus dem Transkript zu bauen. */
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
