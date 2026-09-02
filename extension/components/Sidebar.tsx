import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Loader2,
  ArrowUp,
  BrushCleaning,
  Globe,
  Settings,
  Square,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Markdown } from "@/components/Markdown";
import { TranscriptView } from "@/components/TranscriptView";
import { HistoryView } from "@/components/HistoryView";
import { startChat, startFallback } from "@/lib/chat-client";
import { makeT, resolveUiLang, type T } from "@/lib/i18n";
import {
  answerTranslationPrompt,
  PRESETS,
  translationPrompt,
  webSearchPrompt,
} from "@/lib/prompts";
import { FALLBACK_MODELS, listModels } from "@/lib/openrouter";
import {
  collapsedItem,
  deleteConversation,
  getSettings,
  loadConversation,
  saveConversation,
  setSettings as speichereSettings,
  wideItem,
} from "@/lib/storage";
import { setzeSpaltenbreite, SPALTE_MAX, SPALTE_MIN } from "@/lib/spalte";
import { elementZuHtml, kopiereMitFormat } from "@/lib/clipboard";
import { transcriptToText } from "@/lib/timestamps";
import { NoCaptionsError } from "@/lib/transcript";
import { loadTrack, loadTranscript } from "@/lib/transcript";
import {
  availability as localAvailability,
  baseLang,
  isSupported as localTranslateSupported,
  translateMarkdown,
  translateTranscript,
} from "@/lib/translate-local";
import type {
  CaptionTrack,
  ChatMessage,
  HelperJob,
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
  /** In Chromes Seitenleiste gibt es nichts einzuklappen – dort schliesst man das Panel. */
  collapsible?: boolean;
  /** Seitenleiste: volle Höhe statt an YouTubes Spalte gebundene 75 vh. */
  fullHeight?: boolean;
}

export function Sidebar({
  videoId,
  videoTitle,
  onSeek,
  collapsible = true,
  fullHeight = false,
}: SidebarProps) {
  const [settings, setSettings] = React.useState<AppSettings | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  /*
   * Die Knopfleiste steht im leeren Chat und verschwindet, sobald etwas darin steht –
   * dort kostet sie zwei Zeilen, die zum Lesen fehlen. Bewusst flüchtig: sie leitet sich
   * aus `messages.length` ab und fällt beim Videowechsel und nach jedem Senden zurück.
   * Ein gespeicherter Zustand brächte verwaiste Einträge für den seltenen zweiten
   * Preset-Klick, der so genau einen Klick kostet.
   */
  const [presetsOpen, setPresetsOpen] = React.useState(false);
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
  // Vorab geprüft, damit der Klick-Handler ohne vorheriges await auskommt: die
  // Translator-API verlangt für den Modell-Download eine Nutzergeste.
  const [localTranslateOk, setLocalTranslateOk] = React.useState(false);


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
    // Änderungen in der Options-Page sollen ohne Reload ankommen, und das Symbol in der
    // Werkzeugleiste klappt über denselben Schlüssel auf und zu.
    const onChange = () => void getSettings().then(setSettings);
    chrome.storage.local.onChanged.addListener(onChange);
    const stop = collapsedItem.watch((v) => setCollapsed(!!v));
    return () => {
      chrome.storage.local.onChanged.removeListener(onChange);
      stop();
    };
  }, []);

  React.useEffect(() => {
    // Nur für die Reasoning-Fähigkeit des gewählten Modells; scheitert der Abruf,
    // bleibt die statische Liste stehen.
    listModels()
      .then(setModels)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!settings?.preferLocalTranslate || !transcript || !localTranslateSupported()) {
      setLocalTranslateOk(false);
      return;
    }
    const source = baseLang(transcript.lang) || "en";
    const target = languageToCode(settings.translationTarget);
    void localAvailability(source, target).then((a) => setLocalTranslateOk(a !== "unavailable"));
  }, [settings?.preferLocalTranslate, settings?.translationTarget, transcript]);

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
        setActiveTrack(res.active ?? null);
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

  const presetsVisible = messages.length === 0 || presetsOpen;

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming, presetsVisible]);

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
      // Der System-Prompt läuft in der Sprache der Oberfläche, sonst mischen sich hier
      // als einziger Stelle Deutsch und Englisch.
      parts.push(
        uiLang === "de"
          ? "Hinweis: Dieses Transkript enthält keine Zeitstempel. Gib keine an und erfinde keine."
          : "Note: this transcript has no timestamps. Do not give any and do not invent any.",
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

  /**
   * @param nutzlast Text, der statt des Transkripts als Grundlage dient – beim
   *   Übersetzen einer bereits erzeugten Antwort ist das diese Antwort. Ohne ihn
   *   arbeitet das Modell wie sonst auf dem Transkript im System-Prompt.
   */
  async function send(
    text: string,
    systemOverride?: string,
    nutzlast?: string,
    label?: string,
    web?: boolean,
  ) {
    if (!settings || !transcript || streaming) return;
    if (!settings.apiKey) {
      setMessages((m) => [...m, { role: "assistant", content: t("noKey"), error: true }]);
      return;
    }

    const basis = nutzlast ? `${text}\n\n---\n\n${nutzlast}` : text;
    const prompt = extra.trim() ? `${basis}\n\n${extra.trim()}` : basis;
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: prompt, ...(label ? { label } : {}) },
    ];
    setMessages([...next, { role: "assistant", content: "" }]);
    setStreaming(true);
    setPresetsOpen(false);
    setTab("chat");

    const handle = startChat({
      model: activeModel,
      supportsReasoning: modelInfo?.supportsReasoning ?? true,
      reasoning: settings.reasoning,
      system: buildSystem(settings, transcript, systemOverride),
      messages: next,
      web,
      onSources: (quellen) =>
        setMessages((m) => {
          const copy = [...m];
          const last = copy.at(-1);
          if (last?.role === "assistant") {
            const bekannt = new Set((last.sources ?? []).map((q) => q.url));
            last.sources = [
              ...(last.sources ?? []),
              ...quellen.filter((q) => !bekannt.has(q.url)),
            ];
          }
          return copy;
        }),
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

  const PRESET_LABELS = {
    summary_short: "presetShort",
    summary_medium: "presetMedium",
    summary_long: "presetLong",
    summary_facts: "presetFacts",
    chapters: "presetChapters",
  } as const;

  /**
   * Ziehgriff zwischen Video und Sidebar.
   *
   * Gezogen wird gegen ein gemerktes Delta, nicht gegen die Fensterkante – der rechte
   * Rand der Spalte hat je nach Scrollbar und Seitenrand einen anderen Abstand, und ein
   * Rechenfehler darin würde die Sidebar beim ersten Griff springen lassen. Während des
   * Ziehens wird nur die CSS-Regel angefasst; gespeichert wird einmal am Ende, sonst
   * schriebe jeder Mauspixel in chrome.storage.
   */
  function zieheBreite(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startBreite = settings?.columnWidth ?? 500;
    let letzte = startBreite;

    // Listener am window, nicht am Griff mit `setPointerCapture`: der Griff ist nur acht
    // Pixel breit, ohne Capture verlöre er den Zeiger sofort – und `setPointerCapture`
    // wirft, sobald die Zeiger-ID nicht mehr aktiv ist.
    const bewegen = (ev: PointerEvent) => {
      letzte = Math.min(SPALTE_MAX, Math.max(SPALTE_MIN, startBreite - (ev.clientX - startX)));
      setzeSpaltenbreite(letzte);
    };
    const beenden = () => {
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", beenden);
      window.removeEventListener("pointercancel", beenden);
      document.body.style.userSelect = "";
      void speichereSettings({ columnWidth: Math.round(letzte) });
    };
    void wideItem.setValue(true);
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", bewegen);
    window.addEventListener("pointerup", beenden);
    window.addEventListener("pointercancel", beenden);
  }

  /**
   * Recherchiert dieselbe Frage noch einmal im Internet, mit dem Videotitel als Kontext.
   * Ohne ihn ist eine Rückfrage wie „ist das besser?" für eine Suchmaschine wertlos.
   */
  function recherchiere(frage: string) {
    void send(webSearchPrompt(frage, videoTitle, uiLang), undefined, undefined, `${t("webSearch")}: ${frage}`, true);
  }

  function preset(key: keyof (typeof PRESETS)["de"]) {
    // Angezeigt wird der Name des Knopfes, gesendet der volle Anweisungstext.
    const beschriftung = PRESET_LABELS[key as keyof typeof PRESET_LABELS];
    void send(PRESETS[uiLang][key], undefined, undefined, beschriftung ? t(beschriftung) : undefined);
  }

  /* ---- Übersetzung ---- */

  /**
   * Übersetzt das, was gerade auf dem Tisch liegt: steht eine Antwort im Chat – eine
   * Zusammenfassung, Kapitel, eine Chatantwort –, wird die übersetzt. Erst wenn keine
   * da ist, geht es an das Transkript.
   *
   * Der Unterschied ist nicht kosmetisch: eine Zusammenfassung ist Markdown mit
   * Überschriften und Listen, ein Transkript sind Zeitstempelzeilen. Beides braucht
   * einen anderen Weg, sonst kommt die Formatierung zerlegt zurück.
   */
  function translate() {
    if (!settings) return;

    const letzteAntwort = [...messages].reverse().find((m) => m.role === "assistant" && !m.error);
    const quelle = letzteAntwort?.content?.trim();
    const target = languageToCode(settings.translationTarget);

    if (settings.preferLocalTranslate) {
      if (!localTranslateOk) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: t("localTranslateUnavailable"), error: true },
        ]);
        return;
      }

      const source = baseLang(transcript?.lang) || "en";
      setStreaming(true);
      setTab("chat");
      setMessages((m) => [
        ...m,
        { role: "user", content: quelle ? t("translateAnswer") : t("translateTranscriptLabel") },
        { role: "assistant", content: `${t("localTranslateDownloading")} …` },
      ]);

      const setLast = (content: string, error = false) =>
        setMessages((m) => {
          const copy = [...m];
          const last = copy.at(-1);
          if (last?.role === "assistant") {
            last.content = content;
            last.error = error;
          }
          return copy;
        });

      const optionen = {
        source,
        target,
        // Der Modell-Download blockiert create() – gemessen 160 s. Ohne diese Anzeige
        // sieht die Sidebar in der Zeit aus, als hinge sie.
        onDownload: (loaded: number) =>
          setLast(`${t("localTranslateDownloading")} … ${Math.round(loaded * 100)} %`),
        onProgress: (done: number, total: number) =>
          setLast(`${t("presetTranslate")} … ${done}/${total}`),
      };

      // Kein await vor diesem Aufruf: die Nutzergeste des Klicks muss bis zu
      // Translator.create() durchhalten, sonst NotAllowedError.
      const lauf = quelle
        ? translateMarkdown(quelle, optionen)
        : transcript
          ? translateTranscript(transcript, optionen).then(transcriptToText)
          : Promise.reject(new Error(t("noCaptions")));

      lauf
        .then((text) => setLast(text))
        .catch((e) => setLast(String((e as Error)?.message ?? e), true))
        .finally(() => setStreaming(false));
      return;
    }

    if (quelle) {
      void send(
        `${t("translateAnswer")} → ${settings.translationTarget}`,
        answerTranslationPrompt(settings.translationTarget, uiLang),
        quelle,
      );
      return;
    }

    void send(
      `${t("translateTranscriptLabel")} → ${settings.translationTarget}`,
      translationPrompt(settings.translationTarget, uiLang),
    );
  }

  /* ---- Audio-Fallback (nur Build "full") ---- */

  function runFallbackJob(kind: HelperJob) {
    if (!__FALLBACK__) return;
    setFallbackState(t("fallbackRunning"));
    const job = startFallback(videoId, kind, (p) =>
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

  /* ---- Erneut laden ---- */

  async function reloadTranscript() {
    if (!settings) return;
    setLoadState("loading");
    setLoadError("");
    try {
      const res = await loadTranscript(videoId, settings.captionLang);
      setTranscript(res.transcript);
      setTracks(res.tracks);
      setActiveTrack(res.active ?? null);
      setLoadState("ready");
    } catch (e) {
      if (e instanceof NoCaptionsError) {
        setLoadState("no-captions");
      } else {
        setLoadError(String((e as Error)?.message ?? e));
        setLoadState("error");
      }
    }
  }

  /* ---- Spurwechsel ---- */

  async function switchTrack(track: CaptionTrack) {
    setLoadState("loading");
    try {
      // Panel-Spuren kennen keine URL – sie werden im DOM umgeschaltet.
      const { isPanelTrack, switchPanelTrack } = await import("@/lib/transcript-panel");
      const res = isPanelTrack(track) ? await switchPanelTrack(track) : await loadTrack(track);
      if (!res) throw new Error("Die Spur liess sich nicht laden.");
      setTranscript(res.transcript);
      setActiveTrack(res.active ?? track);
      setLoadState("ready");
    } catch (e) {
      setLoadError(String((e as Error)?.message ?? e));
      setLoadState("error");
    }
  }

  /* ---- Export ---- */

  const chatMarkdown = () =>
    messages
      .map((m) => `## ${m.role === "user" ? "Frage" : "Antwort"}\n\n${m.label ?? m.content}`)
      .join("\n\n");

  /**
   * Dieselbe Unterhaltung als HTML – genommen wird das bereits gerenderte Markup, kein
   * zweiter Markdown-Umwandler. Was auf dem Schirm steht, landet damit unverändert in
   * der Zwischenablage.
   */
  const chatHtml = () => {
    const wurzel = scrollRef.current;
    if (!wurzel) return "";
    const teile: string[] = [];
    for (const el of wurzel.querySelectorAll("[data-frage], .md-body")) {
      teile.push(
        el.hasAttribute("data-frage")
          ? `<h2>Frage</h2><p>${(el.textContent ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</p>`
          : `<h2>Antwort</h2>${elementZuHtml(el)}`,
      );
    }
    return teile.join("\n");
  };

  function download(name: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---- Darstellung ---- */

  if (collapsed && collapsible) {
    return (
      <div
        className="mb-3 rounded-xl border border-border bg-card text-card-foreground"
        style={{ zoom: (settings?.uiScale ?? 110) / 100 }}
      >
        <button
          type="button"
          onClick={() => {
            setCollapsed(false);
            void wideItem.setValue(true);
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
    /*
     * Die Höhe hängt an der äusseren, **unskalierten** Hülle: `zoom` multipliziert
     * Viewport-Einheiten mit (gemessen: `100vh` bei `zoom: 1.1` sind 110 vh), Prozentwerte
     * dagegen nicht. Innen genügt deshalb `h-full`.
     * 80 px = 56 px Kopfzeile + 12 px oberer Abstand der Spalte (zusammen YouTubes
     * `--ytd-watch-flexy-non-player-height` ohne die 48 px unter dem Player) + 12 px Luft
     * unten, symmetrisch zum Abstand oben.
     */
    <div className={cn(fullHeight ? "h-full" : "mb-3 h-[calc(100vh-80px)] min-h-[440px]")}>
    <div
      className="relative flex h-full flex-col rounded-xl border border-border bg-card text-card-foreground overflow-hidden"
      // zoom skaliert den ganzen Baum – Schrift, Abstände, Knöpfe – in einem Zug.
      style={{ zoom: (settings?.uiScale ?? 110) / 100 }}
    >
      {collapsible && (
        <div
          role="separator"
          aria-orientation="vertical"
          title={t("resizeHint")}
          onPointerDown={zieheBreite}
          className="absolute inset-y-0 left-0 z-20 w-2 cursor-col-resize hover:bg-primary/25"
        />
      )}
      <Header
        t={t}
        tab={tab}
        setTab={setTab}
        presetsToggle={
          tab === "chat" && messages.length > 0
            ? { open: presetsOpen, toggle: () => setPresetsOpen((v) => !v) }
            : undefined
        }
        onCollapse={
          collapsible
            ? () => {
                setCollapsed(true);
                void collapsedItem.setValue(true);
              }
            : undefined
        }
      />

      {tab === "chat" && (
        <>
          {presetsVisible && (
          <div className="border-b border-border px-2 py-2">
            <div className="flex flex-wrap items-center gap-1">
              <Button size="sm" variant="secondary" disabled={!transcript || streaming} title={t("presetShortHint")} onClick={() => preset("summary_short")}>
                {t("presetShort")}
              </Button>
              <Button size="sm" variant="secondary" disabled={!transcript || streaming} onClick={() => preset("chapters")}>
                {t("presetChapters")}
              </Button>
              <Button size="sm" variant="secondary" disabled={!transcript || streaming} title={t("presetMediumHint")} onClick={() => preset("summary_medium")}>
                {t("presetMedium")}
              </Button>
              <Button size="sm" variant="secondary" disabled={!transcript || streaming} title={t("presetFactsHint")} onClick={() => preset("summary_facts")}>
                {t("presetFacts")}
              </Button>
              <Button size="sm" variant="secondary" disabled={!transcript || streaming} title={t("presetLongHint")} onClick={() => preset("summary_long")}>
                {t("presetLong")}
              </Button>
              <Button size="sm" variant="secondary" disabled={!transcript || streaming} onClick={() => translate()}>
                {t("presetTranslate")}
                {settings?.preferLocalTranslate ? " ⌂" : ""}
              </Button>
            </div>
          </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 min-h-32">
            {loadState === "loading" && (
              <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("loadingTranscript")}
              </p>
            )}

            {loadState === "no-captions" && (
              <NoCaptions t={t} busy={fallbackState} onStart={runFallbackJob} />
            )}

            {loadState === "error" && (
              <div className="py-4">
                <p className="mb-2 text-sm text-destructive whitespace-pre-wrap">
                  {loadError}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mb-3"
                  onClick={() => void reloadTranscript()}
                >
                  {t("retry")}
                </Button>
                {/* Der Helfer kommt auch dann an die Untertitel, wenn die Seite
                    selbst nichts liefert – deshalb hier dieselben Knöpfe. */}
                <NoCaptions t={t} busy={fallbackState} onStart={runFallbackJob} />
              </div>
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
                onDownload={() => download(`antwort-${videoId}-${i}.md`, m.content)}
                onWebSearch={
                  // Recherchiert wird die Frage, die zu dieser Antwort geführt hat.
                  !streaming && messages[i - 1]?.role === "user"
                    ? () => {
                        const frage = messages[i - 1];
                        if (frage) recherchiere(frage.label ?? frage.content);
                      }
                    : undefined
                }
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
                className="mb-1 h-6 w-full rounded-md border border-dashed border-input bg-transparent px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />

            <div className="flex items-end gap-1">
              <Textarea
                value={input}
                rows={1}
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
                className="max-h-40 min-h-8 px-2.5 py-[5px] text-sm [field-sizing:content]"
              />
              {streaming ? (
                <Button size="icon" variant="destructive" className="size-8 shrink-0 [&_svg]:size-[18px]" onClick={() => stopRef.current?.()} title={t("stop")}>
                  <Square />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="size-8 shrink-0 [&_svg]:size-[18px]"
                  disabled={!transcript || !input.trim()}
                  onClick={() => {
                    const v = input.trim();
                    setInput("");
                    void send(v);
                  }}
                  title={t("send")}
                >
                  <ArrowUp />
                </Button>
              )}
            </div>

            {messages.length > 0 && (
              <div className="mt-1 flex gap-1">
                <Button size="iconSm" variant="ghost" title={t("copy")} onClick={() => void kopiereMitFormat(chatMarkdown(), chatHtml())}>
                  <Copy />
                </Button>
                <Button size="iconSm" variant="ghost" title={t("exportMd")} onClick={() => download(`chat-${videoId}.md`, chatMarkdown())}>
                  <Download />
                </Button>
                <Button
                  size="iconSm"
                  variant="ghost"
                  disabled={streaming}
                  title={t("newChatHint")}
                  onClick={() => {
                    setMessages([]);
                    void deleteConversation(videoId);
                  }}
                >
                  <BrushCleaning />
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
          onForceAudio={__FALLBACK__ ? () => runFallbackJob("audio") : undefined}
          busy={fallbackState}
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
    </div>
  );
}

function Header({
  t,
  tab,
  setTab,
  presetsToggle,
  onCollapse,
}: {
  t: T;
  tab: Tab;
  setTab: (t: Tab) => void;
  presetsToggle?: { open: boolean; toggle: () => void };
  onCollapse?: () => void;
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
        {presetsToggle && (
          <Button
            size="iconSm"
            variant="ghost"
            aria-pressed={presetsToggle.open}
            className={cn(presetsToggle.open && "bg-secondary text-secondary-foreground")}
            title={t("presets")}
            onClick={presetsToggle.toggle}
          >
            <WandSparkles />
          </Button>
        )}
        <Button size="iconSm" variant="ghost" title="Einstellungen" onClick={() => void chrome.runtime.sendMessage({ type: "openOptions" })}>
          <Settings />
        </Button>
        {onCollapse && (
          <Button size="iconSm" variant="ghost" title={t("collapse")} onClick={onCollapse}>
            <ChevronUp />
          </Button>
        )}
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
  onStart: (job: HelperJob) => void;
}) {
  // Im Store-Build endet es hier: klare Meldung, kein Platzhalter, keine erfundene Ausgabe.
  if (!__FALLBACK__) {
    return <p className="py-4 text-sm text-destructive">{t("noCaptionsStore")}</p>;
  }

  if (busy) {
    return (
      <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {busy}
      </p>
    );
  }

  // Zwei Wege, billig zuerst. Beide starten ausschliesslich auf Klick, nie automatisch.
  return (
    <div className="text-sm">
      <p className="mb-3 text-destructive">{t("noCaptionsFull")}</p>

      <Button size="sm" className="mb-1" onClick={() => onStart("subtitles")}>
        {t("startSubtitles")}
      </Button>
      <p className="mb-4 text-xs text-muted-foreground">{t("subtitlesHint")}</p>

      <Button size="sm" variant="outline" className="mb-1" onClick={() => onStart("audio")}>
        {t("startFallback")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("audioHint")}</p>
    </div>
  );
}

function MessageBubble({
  message,
  t,
  showCost,
  onSeek,
  onDownload,
  onWebSearch,
}: {
  message: ChatMessage;
  t: T;
  showCost: boolean;
  onSeek?: (s: number) => void;
  onDownload: () => void;
  onWebSearch?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const inhalt = React.useRef<HTMLDivElement>(null);

  if (message.role === "user") {
    return (
      <div
        data-frage=""
        className="mb-2 rounded-lg bg-secondary px-2.5 py-1.5 text-sm text-secondary-foreground whitespace-pre-wrap"
      >
        {message.label ?? message.content}
      </div>
    );
  }

  return (
    <div className="group mb-3" ref={inhalt}>
      {message.error ? (
        <p className="text-sm text-destructive whitespace-pre-wrap">{message.content}</p>
      ) : (
        <Markdown onSeek={onSeek}>{message.content}</Markdown>
      )}

      <div className="mt-1 flex items-center gap-2">
        {message.content && !message.error && (
          <>
            <Button
              size="iconSm"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100"
              title={copied ? t("copied") : t("copy")}
              onClick={() => {
                const md = inhalt.current?.querySelector(".md-body");
                void kopiereMitFormat(message.content, md ? elementZuHtml(md) : "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              <Copy />
            </Button>
            <Button
              size="iconSm"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100"
              title={t("exportMd")}
              onClick={onDownload}
            >
              <Download />
            </Button>
            {onWebSearch && (
              <Button
                size="iconSm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100"
                title={t("webSearchHint")}
                onClick={onWebSearch}
              >
                <Globe />
              </Button>
            )}
          </>
        )}
        {showCost && message.usage && (
          <span className="text-xs text-muted-foreground">
            {t("tokens")}: {message.usage.prompt_tokens} / {message.usage.completion_tokens}
            {message.usage.cost != null && ` · ${t("cost")}: $${message.usage.cost.toFixed(5)}`}
          </span>
        )}
      </div>

      {/* Fundstellen der Recherche – ohne sie wäre nicht nachprüfbar, worauf sie beruht. */}
      {!!message.sources?.length && (
        <div className="mt-1 border-l-2 border-border pl-2">
          <p className="mb-0.5 text-xs text-muted-foreground">{t("sources")}</p>
          <ul className="space-y-0.5">
            {message.sources.map((q) => (
              <li key={q.url} className="truncate text-xs">
                <a
                  href={q.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary hover:underline"
                >
                  {q.title || q.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
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
