import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Loader2,
  Settings,
  Square,
  Trash2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Markdown } from "@/components/Markdown";
import { TranscriptView } from "@/components/TranscriptView";
import { HistoryView } from "@/components/HistoryView";
import { startChat, startFallback } from "@/lib/chat-client";
import { makeT, resolveUiLang, type T } from "@/lib/i18n";
import { PRESETS, translationPrompt } from "@/lib/prompts";
import { FALLBACK_MODELS, listModels } from "@/lib/openrouter";
import {
  collapsedItem,
  deleteConversation,
  getSettings,
  loadConversation,
  saveConversation,
} from "@/lib/storage";
import { transcriptToText } from "@/lib/timestamps";
import { loadTrack, loadTranscript, NoCaptionsError } from "@/lib/transcript";
import type {
  CaptionTrack,
  ChatMessage,
  ModelInfo,
  Settings as AppSettings,
  Transcript,
  UiLang,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type LoadState = "loading" | "ready" | "no-captions" | "error";
type Tab = "chat" | "transcript" | "history";

export interface SidebarProps {
  videoId: string;
  videoTitle: string;
  /** Setzt die Wiedergabeposition im Player der Seite. */
  onSeek: (seconds: number) => void;
}

export function Sidebar({ videoId, videoTitle, onSeek }: SidebarProps) {
  const [settings, setSettings] = React.useState<AppSettings | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("chat");

  const [transcript, setTranscript] = React.useState<Transcript | null>(null);
  const [tracks, setTracks] = React.useState<CaptionTrack[]>([]);
  const [activeTrack, setActiveTrack] = React.useState<CaptionTrack | null>(null);
  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [loadError, setLoadError] = React.useState("");

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [extra, setExtra] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [fallbackState, setFallbackState] = React.useState<string | null>(null);
  const [models, setModels] = React.useState<ModelInfo[]>(FALLBACK_MODELS);

  const stopRef = React.useRef<(() => void) | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const uiLang: UiLang = resolveUiLang(settings?.uiLang ?? "auto");
  const t = React.useMemo(() => makeT(uiLang), [uiLang]);

  /* ---- Einstellungen und Modellliste ---- */

  React.useEffect(() => {
    void (async () => {
      setSettings(await getSettings());
      setCollapsed(await collapsedItem.getValue());
    })();
    // Änderungen in der Options-Page sollen ohne Reload ankommen.
    const onChange = () => void getSettings().then(setSettings);
    chrome.storage.local.onChanged.addListener(onChange);
    return () => chrome.storage.local.onChanged.removeListener(onChange);
  }, []);

  React.useEffect(() => {
    // Nur für die Reasoning-Fähigkeit des gewählten Modells; scheitert der Abruf,
    // bleibt die statische Liste stehen.
    listModels()
      .then(setModels)
      .catch(() => {});
  }, []);

  /* ---- Transkript laden, bei jedem Videowechsel neu ---- */

  React.useEffect(() => {
    if (!settings) return;
    let cancelled = false;

    setLoadState("loading");
    setTranscript(null);
    setTracks([]);
    setActiveTrack(null);
    setFallbackState(null);

    void (async () => {
      // Gespeicherten Verlauf zu diesem Video wiederherstellen.
      const conv = await loadConversation(videoId);
      if (!cancelled) setMessages(conv?.messages ?? []);

      try {
        const res = await loadTranscript(videoId, settings.captionLang);
        if (cancelled) return;
        setTranscript(res.transcript);
        setTracks(res.tracks);
        setActiveTrack(res.active);
        setLoadState("ready");
      } catch (e) {
        if (cancelled) return;
        if (e instanceof NoCaptionsError) {
          setLoadState("no-captions");
        } else {
          setLoadError(String((e as Error)?.message ?? e));
          setLoadState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [videoId, settings?.captionLang, settings !== null]);

  /* ---- Verlauf sichern ---- */

  React.useEffect(() => {
    if (!messages.length) return;
    void saveConversation({
      videoId,
      title: videoTitle,
      updatedAt: Date.now(),
      messages,
    });
  }, [messages, videoId, videoTitle]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  /* ---- Senden ---- */

  const activeModel = settings?.customModel?.trim()
    ? settings.customModel.trim()
    : (settings?.model ?? "");

  const modelInfo = models.find((m) => m.id === activeModel);

  function buildSystem(s: AppSettings, tr: Transcript, override?: string): string {
    const parts = [override ?? s.systemPrompt];

    if (s.answerLang === "de") {
      parts.push("Antworte auf Deutsch, unabhängig von der Sprache der Anfrage.");
    } else if (s.answerLang === "en") {
      parts.push("Answer in English, regardless of the language of the request.");
    }

    if (!tr.hasTimestamps) {
      parts.push(
        "Hinweis: Dieses Transkript enthält keine Zeitstempel. Gib keine an und erfinde keine.",
      );
    }

    parts.push(
      "--- TRANSKRIPT ---\n" +
        `Video: ${videoTitle}\n` +
        (tr.lang ? `Sprache der Spur: ${tr.lang}\n` : "") +
        `Quelle: ${tr.source}\n\n` +
        transcriptToText(tr),
    );
    return parts.join("\n\n");
  }

  async function send(text: string, systemOverride?: string) {
    if (!settings || !transcript || streaming) return;
    if (!settings.apiKey) {
      setMessages((m) => [...m, { role: "assistant", content: t("noKey"), error: true }]);
      return;
    }

    const prompt = extra.trim() ? `${text}\n\n${extra.trim()}` : text;
    const next: ChatMessage[] = [...messages, { role: "user", content: prompt }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setStreaming(true);
    setTab("chat");

    const handle = startChat({
      model: activeModel,
      supportsReasoning: modelInfo?.supportsReasoning ?? true,
      reasoning: settings.reasoning,
      system: buildSystem(settings, transcript, systemOverride),
      messages: next,
      onDelta: (d) =>
        setMessages((m) => {
          const copy = [...m];
          const last = copy.at(-1);
          if (last?.role === "assistant") last.content += d;
          return copy;
        }),
      onUsage: (u) =>
        setMessages((m) => {
          const copy = [...m];
          const last = copy.at(-1);
          if (last?.role === "assistant") last.usage = u;
          return copy;
        }),
    });
    stopRef.current = handle.stop;

    try {
      await handle.done;
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      setMessages((m) => {
        const copy = [...m];
        const last = copy.at(-1);
        if (last?.role === "assistant") {
          last.content = last.content || (msg === "NO_KEY" ? t("noKey") : msg);
          last.error = true;
        }
        return copy;
      });
    } finally {
      setStreaming(false);
      stopRef.current = null;
    }
  }

  function preset(key: keyof (typeof PRESETS)["de"]) {
    void send(PRESETS[uiLang][key]);
  }

  /* ---- Übersetzung ---- */

  async function translate() {
    if (!settings || !transcript) return;

    if (settings.preferLocalTranslate) {
      const { availability, baseLang, translateTranscript } = await import(
        "@/lib/translate-local"
      );
      const target = languageToCode(settings.translationTarget);
      const source = baseLang(transcript.lang) || "en";

      const av = await availability(source, target);
      if (av === "unavailable") {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: t("localTranslateUnavailable"), error: true },
        ]);
        return;
      }

      setStreaming(true);
      setTab("chat");
      setMessages((m) => [
        ...m,
        { role: "user", content: t("presetTranslate") },
        { role: "assistant", content: `${t("localTranslateDownloading")} …` },
      ]);

      try {
        const translated = await translateTranscript(transcript, {
          source,
          target,
          onProgress: (done, total) =>
            setMessages((m) => {
              const copy = [...m];
              const last = copy.at(-1);
              if (last?.role === "assistant") {
                last.content = `${t("presetTranslate")} … ${done}/${total}`;
              }
              return copy;
            }),
        });
        setMessages((m) => {
          const copy = [...m];
          const last = copy.at(-1);
          if (last?.role === "assistant") {
            last.content = transcriptToText(translated);
          }
          return copy;
        });
      } catch (e) {
        setMessages((m) => {
          const copy = [...m];
          const last = copy.at(-1);
          if (last?.role === "assistant") {
            last.content = String((e as Error)?.message ?? e);
            last.error = true;
          }
          return copy;
        });
      } finally {
        setStreaming(false);
      }
      return;
    }

    void send(
      `${t("presetTranslate")} → ${settings.translationTarget}`,
      translationPrompt(settings.translationTarget, uiLang),
    );
  }

  /* ---- Audio-Fallback (nur Build "full") ---- */

  function runFallbackJob() {
    if (!__FALLBACK__) return;
    setFallbackState(t("fallbackRunning"));
    const job = startFallback(videoId, (p) =>
      setFallbackState(`${p.message}${p.percent != null ? ` (${p.percent}%)` : ""}`),
    );
    job.promise
      .then((tr) => {
        setTranscript(tr);
        setLoadState("ready");
        setFallbackState(null);
      })
      .catch((e) => {
        setLoadError(String(e?.message ?? e));
        setLoadState("error");
        setFallbackState(null);
      });
  }

  /* ---- Spurwechsel ---- */

  async function switchTrack(track: CaptionTrack) {
    setLoadState("loading");
    try {
      const res = await loadTrack(track);
      setTranscript(res.transcript);
      setActiveTrack(res.active);
      setLoadState("ready");
    } catch (e) {
      setLoadError(String((e as Error)?.message ?? e));
      setLoadState("error");
    }
  }

  /* ---- Export ---- */

  const chatMarkdown = () =>
    messages
      .map((m) => `## ${m.role === "user" ? "Frage" : "Antwort"}\n\n${m.content}`)
      .join("\n\n");

  function download(name: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---- Darstellung ---- */

  if (collapsed) {
    return (
      <div className="mb-3 rounded-xl border border-border bg-card text-card-foreground">
        <button
          type="button"
          onClick={() => {
            setCollapsed(false);
            void collapsedItem.setValue(false);
          }}
          className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium cursor-pointer"
        >
          {t("sidebarTitle")}
          <ChevronDown className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 flex max-h-[75vh] flex-col rounded-xl border border-border bg-card text-card-foreground overflow-hidden">
      <Header
        t={t}
        tab={tab}
        setTab={setTab}
        onCollapse={() => {
          setCollapsed(true);
          void collapsedItem.setValue(true);
        }}
      />

      {tab === "chat" && (
        <>
          <div className="border-b border-border px-2 py-2">
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="secondary" disabled={!transcript || streaming} onClick={() => preset("summary_short")}>
                {t("presetShort")}
              </Button>
              <Button size="sm" variant="secondary" disabled={!transcript || streaming} onClick={() => preset("summary_medium")}>
                {t("presetMedium")}
              </Button>
              <Button size="sm" variant="secondary" disabled={!transcript || streaming} onClick={() => preset("summary_long")}>
                {t("presetLong")}
              </Button>
              <Button size="sm" variant="secondary" disabled={!transcript || streaming} onClick={() => preset("chapters")}>
                {t("presetChapters")}
              </Button>
              <Button size="sm" variant="secondary" disabled={!transcript || streaming} onClick={() => void translate()}>
                {t("presetTranslate")}
                {settings?.preferLocalTranslate ? " ⌂" : ""}
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 min-h-32">
            {loadState === "loading" && (
              <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("loadingTranscript")}
              </p>
            )}

            {loadState === "no-captions" && (
              <NoCaptions
                t={t}
                busy={fallbackState}
                onStart={runFallbackJob}
              />
            )}

            {loadState === "error" && (
              <p className="py-4 text-sm text-destructive whitespace-pre-wrap">{loadError}</p>
            )}

            {transcript && !transcript.hasTimestamps && (
              <p className="mb-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                {t("noTimestamps")}
              </p>
            )}

            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                t={t}
                showCost={settings?.showCost ?? false}
                onSeek={transcript?.hasTimestamps ? onSeek : undefined}
              />
            ))}

            {streaming && (
              <p className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                …
              </p>
            )}
          </div>

          <div className="border-t border-border p-2">
            <input
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder={t("extraPrompt")}
                className="mb-1 h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />

            <div className="flex items-end gap-1">
              <Textarea
                value={input}
                rows={2}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const v = input.trim();
                    if (v) {
                      setInput("");
                      void send(v);
                    }
                  }
                }}
                placeholder={t("ask")}
                disabled={!transcript}
                className="min-h-9 text-sm"
              />
              {streaming ? (
                <Button size="icon" variant="destructive" onClick={() => stopRef.current?.()} title={t("stop")}>
                  <Square />
                </Button>
              ) : (
                <Button
                  size="icon"
                  disabled={!transcript || !input.trim()}
                  onClick={() => {
                    const v = input.trim();
                    setInput("");
                    void send(v);
                  }}
                  title={t("send")}
                >
                  <Send />
                </Button>
              )}
            </div>

            {messages.length > 0 && (
              <div className="mt-1 flex gap-1">
                <Button size="iconSm" variant="ghost" title={t("copy")} onClick={() => void navigator.clipboard.writeText(chatMarkdown())}>
                  <Copy />
                </Button>
                <Button size="iconSm" variant="ghost" title={t("exportMd")} onClick={() => download(`chat-${videoId}.md`, chatMarkdown())}>
                  <Download />
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  title={t("clear")}
                  onClick={() => {
                    setMessages([]);
                    void deleteConversation(videoId);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "transcript" && (
        <TranscriptView
          t={t}
          transcript={transcript}
          videoId={videoId}
          onSeek={onSeek}
          onDownload={download}
          tracks={tracks}
          activeTrack={activeTrack}
          onSwitchTrack={(tr) => void switchTrack(tr)}
        />
      )}

      {tab === "history" && (
        <HistoryView
          t={t}
          currentVideoId={videoId}
          onOpen={(conv) => {
            if (conv.videoId === videoId) {
              setMessages(conv.messages);
              setTab("chat");
            } else {
              location.href = `https://www.youtube.com/watch?v=${conv.videoId}`;
            }
          }}
        />
      )}
    </div>
  );
}

function Header({
  t,
  tab,
  setTab,
  onCollapse,
}: {
  t: T;
  tab: Tab;
  setTab: (t: Tab) => void;
  onCollapse: () => void;
}) {
  const tabs: Array<[Tab, string]> = [
    ["chat", t("tabChat")],
    ["transcript", t("tabTranscript")],
    ["history", t("tabHistory")],
  ];
  return (
    <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setTab(key)}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium cursor-pointer",
            tab === key ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-accent",
          )}
        >
          {label}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-0.5">
        <Button size="iconSm" variant="ghost" title="Einstellungen" onClick={() => void chrome.runtime.sendMessage({ type: "openOptions" })}>
          <Settings />
        </Button>
        <Button size="iconSm" variant="ghost" title={t("collapse")} onClick={onCollapse}>
          <ChevronUp />
        </Button>
      </div>
    </div>
  );
}

function NoCaptions({
  t,
  busy,
  onStart,
}: {
  t: T;
  busy: string | null;
  onStart: () => void;
}) {
  // Im Store-Build endet es hier: klare Meldung, kein Platzhalter, keine erfundene Ausgabe.
  if (!__FALLBACK__) {
    return <p className="py-4 text-sm text-destructive">{t("noCaptionsStore")}</p>;
  }
  return (
    <div className="py-4 text-sm">
      <p className="mb-2 text-destructive">{t("noCaptionsFull")}</p>
      {busy ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {busy}
        </p>
      ) : (
        // Nie automatisch – der Download startet ausschliesslich auf diesen Klick.
        <Button size="sm" onClick={onStart}>
          {t("startFallback")}
        </Button>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  t,
  showCost,
  onSeek,
}: {
  message: ChatMessage;
  t: T;
  showCost: boolean;
  onSeek?: (s: number) => void;
}) {
  const [copied, setCopied] = React.useState(false);

  if (message.role === "user") {
    return (
      <div className="mb-2 rounded-lg bg-secondary px-2.5 py-1.5 text-sm text-secondary-foreground whitespace-pre-wrap">
        {message.content}
      </div>
    );
  }

  return (
    <div className="group mb-3">
      {message.error ? (
        <p className="text-sm text-destructive whitespace-pre-wrap">{message.content}</p>
      ) : (
        <Markdown onSeek={onSeek}>{message.content}</Markdown>
      )}

      <div className="mt-1 flex items-center gap-2">
        {message.content && (
          <Button
            size="iconSm"
            variant="ghost"
            className="opacity-0 group-hover:opacity-100"
            title={copied ? t("copied") : t("copy")}
            onClick={() => {
              void navigator.clipboard.writeText(message.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            <Copy />
          </Button>
        )}
        {showCost && message.usage && (
          <span className="text-[11px] text-muted-foreground">
            {t("tokens")}: {message.usage.prompt_tokens} / {message.usage.completion_tokens}
            {message.usage.cost != null && ` · ${t("cost")}: $${message.usage.cost.toFixed(5)}`}
          </span>
        )}
      </div>
    </div>
  );
}

/** Anzeigename der Zielsprache auf einen BCP-47-Code für die Chrome-Translator-API. */
function languageToCode(name: string): string {
  const map: Record<string, string> = {
    deutsch: "de",
    german: "de",
    englisch: "en",
    english: "en",
    französisch: "fr",
    french: "fr",
    spanisch: "es",
    spanish: "es",
    italienisch: "it",
    italian: "it",
    niederländisch: "nl",
    dutch: "nl",
    portugiesisch: "pt",
    portuguese: "pt",
    polnisch: "pl",
    polish: "pl",
    türkisch: "tr",
    turkish: "tr",
    japanisch: "ja",
    japanese: "ja",
    chinesisch: "zh",
    chinese: "zh",
    russisch: "ru",
    russian: "ru",
  };
  const key = name.trim().toLowerCase();
  return map[key] ?? (key.length === 2 ? key : "de");
}
