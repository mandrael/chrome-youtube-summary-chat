import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  Loader2,
  ArrowUp,
  BrushCleaning,
  FolderOpen,
  Globe,
  Settings,
  Square,
  WandSparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Markdown } from "@/components/Markdown";
import { TranscriptView } from "@/components/TranscriptView";
import { HistoryView } from "@/components/HistoryView";
import { ask, startChat, startDownload, startFallback } from "@/lib/chat-client";
import { makeT, resolveUiLang, type T } from "@/lib/i18n";
import {
  PRESETS,
  webKontext,
  webLookupPrompt,
} from "@/lib/prompts";
import {
  empfohleneModelle,
  FALLBACK_MODELS,
  formatPreis,
  isLiteModel,
  listModels,
  ONE_M_CONTEXT,
  preisProAnfrage,
} from "@/lib/openrouter";
import {
  collapsedItem,
  deleteConversation,
  getSettings,
  loadConversation,
  loadTranslation,
  saveConversation,
  saveTranslation,
  setSettings as speichereSettings,
  wideItem,
} from "@/lib/storage";
import { setzeSpaltenbreite, SPALTE_MAX, SPALTE_MIN } from "@/lib/spalte";
import { ZIELSPRACHEN } from "@/lib/tracks";
import { elementZuHtml, kopiereMitFormat } from "@/lib/clipboard";
import { transcriptToText } from "@/lib/timestamps";
import { translateCuesViaOpenRouter } from "@/lib/translate-cues";
import { NoCaptionsError } from "@/lib/transcript";
import { formatTs } from "@/lib/timestamps";
import { starteLiveTranskription } from "@/lib/audio-live";
import { STT_MODEL_IDS } from "@/lib/openrouter";
import { loadTrack, loadTranscript } from "@/lib/transcript";
import { korrigiereTranskript, parseWoerterbuch, schreibweisenHinweis } from "@/lib/korrektur";
import {
  availability as localAvailability,
  baseLang,
  isSupported as localTranslateSupported,
  translateTranscript,
} from "@/lib/translate-local";
import type {
  CaptionTrack,
  ChatMessage,
  HelperJob,
  ModelInfo,
  Settings as AppSettings,
  Transcript,
  TranscriptTranslation,
  UiLang,
  VideoFormat,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type LoadState = "loading" | "ready" | "no-captions" | "error";
type Tab = "chat" | "transcript" | "history";

export interface SidebarProps {
  videoId: string;
  videoTitle: string;
  /** Kanalname, nur als Kontext für die Internetrecherche. */
  channel?: string;
  /** Setzt die Wiedergabeposition im Player der Seite. */
  onSeek: (seconds: number) => void;
  /** Das `<video>` der Seite – für den Folgemodus im Transkript. */
  getVideo?: () => HTMLVideoElement | null;
  /** In Chromes Seitenleiste gibt es nichts einzuklappen – dort schliesst man das Panel. */
  collapsible?: boolean;
  /** Seitenleiste: volle Höhe statt an YouTubes Spalte gebundene 75 vh. */
  fullHeight?: boolean;
}

export function Sidebar({
  videoId,
  videoTitle,
  channel,
  onSeek,
  getVideo = () => document.querySelector<HTMLVideoElement>("video"),
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
  /*
   * Schalter unter dem Eingabefeld: die nächste Frage geht mit Internetsuche los. Bleibt
   * an, bis er ausgeschaltet wird – wer einmal recherchiert, tut es meist mehrfach.
   */
  const [webAn, setWebAn] = React.useState(false);
  /* ---- Übersetzung des Transkripts: eigener Zustand, eigener Abbruch ---- */
  const [uebersetzung, setUebersetzung] = React.useState<TranscriptTranslation | null>(null);
  const [zeigeUebersetzung, setZeigeUebersetzung] = React.useState(false);
  const [downloadAnteil, setDownloadAnteil] = React.useState(0);
  const abbruchRef = React.useRef<AbortController | null>(null);
  const [tab, setTab] = React.useState<Tab>("chat");

  const [transcript, setTranscript] = React.useState<Transcript | null>(null);

  const woerterbuch = React.useMemo(
    () => parseWoerterbuch(settings?.dictionary ?? ""),
    [settings?.dictionary],
  );
  /*
   * Jedes Transkript geht durch das Wörterbuch, egal woher es kommt – YouTubes
   * automatische Untertitel verhören Eigennamen genauso wie Parakeet. Korrigiert wird
   * einmal beim Übernehmen, nicht bei jeder Anzeige: so steht die richtige Schreibweise
   * auch im Export, im Prompt und in der Übersetzung.
   */
  function uebernimmTranskript(tr: Transcript | null) {
    setTranscript(tr ? korrigiereTranskript(tr, woerterbuch) : null);
  }
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
    // bleibt die statische Liste stehen. Bei Mistral gar kein Kontakt zu OpenRouter –
    // auch keine Metadaten-Anfrage (Codex-Befund 05.09.2026).
    if (settings?.provider !== "openrouter") return;
    listModels()
      .then(setModels)
      .catch(() => {});
  }, [settings?.provider]);

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
    uebernimmTranskript(null);
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
        uebernimmTranskript(res.transcript);
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

  /*
   * Eine gespeicherte Übersetzung gehört zu Video, Spursprache und Zielsprache. Passt
   * eine davon nicht, gibt es keine – angezeigt wird dann das Original. So sieht man nie
   * die Übersetzung von etwas anderem.
   */
  React.useEffect(() => {
    setUebersetzung(null);
    setZeigeUebersetzung(false);
    if (!transcript || !settings) return;
    const target = languageToCode(settings.translationTarget);
    let abgebrochen = false;
    void loadTranslation(videoId, transcript.lang ?? "?", target).then((tr) => {
      if (!abgebrochen && tr && tr.texts.length === transcript.cues.length) setUebersetzung(tr);
    });
    return () => {
      abgebrochen = true;
    };
  }, [videoId, transcript, settings?.translationTarget]);

  // Ein Videowechsel beendet einen laufenden Übersetzungslauf.
  React.useEffect(() => () => abbruchRef.current?.abort(), [videoId]);

  const presetsVisible = messages.length === 0 || presetsOpen;

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming, presetsVisible]);

  /* ---- Senden ---- */

  // Bei Mistral gibt es keinen Web-Schalter, kein Reasoning und keine Kosten; der
  // Service Worker setzt Modell und Schlüssel selbst aus den Einstellungen.
  const mistralAktiv = settings?.provider === "mistral";
  const activeModel = (mistralAktiv ? settings?.mistralModel : settings?.model) ?? "";

  const modelInfo = models.find((m) => m.id === activeModel);

  /** Der Fehlercode aus dem Service Worker als Satz in der Oberfläche. */
  function fehlerText(code: string): string {
    if (code === "NO_KEY") return mistralAktiv ? t("noKeyMistral") : t("noKey");
    if (code === "NO_MODEL") return t("noModelMistral");
    if (code === "WEB_ONLY_OPENROUTER") return t("webOnlyOpenRouter");
    // Nach Update oder Neuladen der Erweiterung lebt das alte Content-Script weiter,
    // aber ohne Verbindung: `chrome.runtime.connect` wirft. Vorher stand dann nur die
    // Frage im Chat und nichts passierte (Michael, 05.09.2026).
    if (/context invalidated/i.test(code)) return t("contextLost");
    return code;
  }

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

    // Nur die Begriffe, die im Transkript vorkommen – der Prompt bleibt klein, egal wie
    // gross das Wörterbuch ist.
    const hinweis = schreibweisenHinweis(transcriptToText(tr), woerterbuch);
    if (hinweis) parts.push(hinweis.trim());

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
    const fehlt = mistralAktiv
      ? !settings.mistralApiKey
        ? "NO_KEY"
        : !settings.mistralModel
          ? "NO_MODEL"
          : null
      : !settings.apiKey
        ? "NO_KEY"
        : null;
    if (fehlt) {
      setMessages((m) => [...m, { role: "assistant", content: fehlerText(fehlt), error: true }]);
      return;
    }

    // Der Zusatz gehört zu den Schnellbefehlen und wird dort angehängt (siehe
    // `preset`). Hier bleibt er draussen: sonst verdirbt ein liegengebliebener Zusatz
    // still auch Übersetzung und Netzrecherche.
    const prompt = nutzlast ? `${text}\n\n---\n\n${nutzlast}` : text;
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: prompt, ...(label ? { label } : {}) },
    ];
    setMessages([...next, { role: "assistant", content: "" }]);
    setStreaming(true);
    setPresetsOpen(false);
    setTab("chat");

    try {
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
      await handle.done;
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      setMessages((m) => {
        const copy = [...m];
        const last = copy.at(-1);
        if (last?.role === "assistant") {
          last.content = last.content || fehlerText(msg);
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
    claims: "presetClaims",
    howto: "presetHowto",
    pro_contra: "presetProContra",
    comparison: "presetComparison",
    glossary: "presetGlossary",
    references: "presetReferences",
    quiz: "presetQuiz",
    positions: "presetPositions",
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
  /** Eine getippte Frage – mit Suche, wenn der Schalter an ist. */
  function frageSenden(frage: string) {
    if (!webAn || mistralAktiv) {
      void send(frage);
      return;
    }
    // Angezeigt wird die Frage, gesendet die Frage plus Kontextzeile: aus ihr bildet
    // OpenRouter die Suchanfrage.
    void send(
      `${frage}\n\n${webKontext(videoTitle, channel ?? "", uiLang)}`,
      undefined,
      undefined,
      frage,
      true,
    );
  }

  /**
   * Nachschlagen zu einer bereits beantworteten Frage. Der Auftrag verbietet ausdrücklich
   * die Wiederholung der Transkript-Antwort – man drückt den Knopf ja gerade deshalb,
   * weil man sie schon gelesen hat.
   */
  function recherchiere(frage: string) {
    void send(
      webLookupPrompt(frage, videoTitle, channel ?? "", uiLang),
      undefined,
      undefined,
      `${t("webSearch")}: ${frage}`,
      true,
    );
  }

  function preset(key: keyof (typeof PRESETS)["de"]) {
    // Angezeigt wird der Name des Knopfes, gesendet der volle Anweisungstext.
    const beschriftung = PRESET_LABELS[key as keyof typeof PRESET_LABELS];
    const basis = PRESETS[uiLang][key];
    const zusatz = extra.trim();
    // Der Vorrang muss dastehen: sonst weiss das Modell bei „nur drei Punkte" nicht,
    // ob sein „drei bis fünf" aus dem Schnellbefehl gilt oder der Wunsch des Nutzers.
    const prompt = zusatz ? `${basis}\n\n${t("extraPrecedence")}\n${zusatz}` : basis;
    void send(prompt, undefined, undefined, beschriftung ? t(beschriftung) : undefined);
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
  /**
   * @param nurTranskript Aus dem Transkript-Tab: dort ist das Transkript gemeint, auch
   *   wenn im Chat eine Antwort steht.
   */
  /* ---- Übersetzung des Transkripts – bleibt im Transkript-Tab ---- */

  /**
   * Ein Knopf, vier Zustände: läuft → abbrechen, fertig → zwischen Original und
   * Übersetzung umschalten, unvollständig → fortsetzen, sonst → übersetzen.
   *
   * Das Ergebnis landet zeilenweise in `texts[]` und nicht als Chat-Antwort: der
   * Transkript-Tab ist der Ort des Transkripts, die Zeitspalte bleibt erhalten, und ein
   * Abbruch verliert nichts.
   */
  function transkriptUebersetzen() {
    if (!settings || !transcript) return;
    const n = transcript.cues.length;

    if (uebersetzung?.status === "running") {
      abbruchRef.current?.abort();
      return;
    }
    if (uebersetzung?.status === "done") {
      setZeigeUebersetzung((v) => !v);
      return;
    }

    const from = uebersetzung?.status === "partial" ? uebersetzung.done : 0;
    const target = languageToCode(settings.translationTarget);
    const route: "chrome" | "openrouter" | "mistral" = settings.preferLocalTranslate
      ? "chrome"
      : settings.provider;
    if (route === "chrome" && !localTranslateOk) {
      setUebersetzung({
        target,
        targetName: settings.translationTarget,
        route,
        texts: new Array<string | null>(n).fill(null),
        done: 0,
        status: "error",
        error: t("localTranslateUnavailable"),
      });
      setZeigeUebersetzung(true);
      return;
    }

    const controller = new AbortController();
    abbruchRef.current = controller;
    setUebersetzung({
      target,
      targetName: settings.translationTarget,
      route,
      texts: from ? [...uebersetzung!.texts] : new Array<string | null>(n).fill(null),
      done: from,
      status: "running",
    });
    setZeigeUebersetzung(true);

    const onCue = (i: number, text: string) =>
      setUebersetzung((u) => {
        if (!u) return u;
        const texts = [...u.texts];
        texts[i] = texts[i] ? `${texts[i]} ${text}` : text;
        return { ...u, texts, done: Math.max(u.done, i + 1) };
      });

    const abschluss = (r: { done: number; aborted: boolean }) =>
      setUebersetzung((u) => {
        if (!u) return u;
        const fertig = {
          ...u,
          done: r.done,
          status: (r.aborted ? "partial" : "done") as "partial" | "done",
        };
        void saveTranslation(videoId, transcript.lang ?? "?", fertig);
        return fertig;
      });

    // Kein await vor translateTranscript: die Nutzergeste muss bis create() halten.
    const lauf =
      route === "chrome"
        ? translateTranscript(transcript, {
            source: baseLang(transcript.lang) || "en",
            target,
            from,
            signal: controller.signal,
            onCue,
            onDownload: (loaded) => setDownloadAnteil(loaded),
          })
        : translateCuesViaOpenRouter(transcript.cues, {
            model: activeModel,
            supportsReasoning: modelInfo?.supportsReasoning ?? true,
            reasoning: settings.reasoning,
            targetName: settings.translationTarget,
            from,
            signal: controller.signal,
            onCue,
          });

    lauf
      .then(abschluss)
      .catch((e) =>
        setUebersetzung(
          (u) => u && { ...u, status: "error", error: String((e as Error)?.message ?? e) },
        ),
      )
      .finally(() => {
        abbruchRef.current = null;
        setDownloadAnteil(0);
      });
  }

  /* ---- Spracherkennung aus dem laufenden Ton (beide Builds) ---- */

  /**
   * Der Weg für Videos ohne Untertitel, den auch der Store-Build gehen darf: kein
   * Download, der Ton wird im Arbeitsspeicher gelesen. Läuft ausschliesslich auf Klick.
   *
   * Fest auf whisper-large-v3-turbo: es ist die einzige Route, die über OpenRouter
   * Zeitstempel liefert (parakeet lehnt verbose_json mit HTTP 400 ab). Ohne Zeitstempel
   * gäbe es keine Sprungmarken, und darauf beruht der halbe Nutzen des Transkripts.
   */
  const liveRef = React.useRef<{ cancel: () => void } | null>(null);

  function runLive() {
    const schluessel = settings?.apiKey;
    if (!schluessel) return;
    setFallbackState(`${t("liveRunning")} …`);
    const job = starteLiveTranskription({
      apiKey: schluessel,
      model: STT_MODEL_IDS[0],
      zeitstempel: true,
      onProgress: ({ position, dauer, phase }) =>
        setFallbackState(
          phase === "werbung"
            ? t("liveWaitingAd")
            : `${t("liveRunning")} … ${formatTs(position, dauer >= 3600)} / ${formatTs(dauer, dauer >= 3600)}`,
        ),
    });
    liveRef.current = job;
    job.promise
      .then((tr) => {
        uebernimmTranskript(tr);
        setLoadState("ready");
        setFallbackState(null);
      })
      .catch((e) => {
        setLoadError(String((e as Error)?.message ?? e));
        setLoadState("error");
        setFallbackState(null);
      })
      .finally(() => {
        liveRef.current = null;
      });
  }

  // Beim Videowechsel läuft sonst die Erkennung des alten Videos weiter und stellt am
  // Ende die Wiedergabezeit des neuen zurück.
  React.useEffect(() => () => liveRef.current?.cancel(), [videoId]);

  /* ---- Audio-Fallback (nur Build "full") ---- */

  function runFallbackJob(kind: HelperJob) {
    if (!__FALLBACK__) return;
    setFallbackState(t("fallbackRunning"));
    const job = startFallback(videoId, kind, (p) =>
      setFallbackState(`${p.message}${p.percent != null ? ` (${p.percent}%)` : ""}`),
    );
    job.promise
      .then((tr) => {
        uebernimmTranskript(tr);
        setLoadState("ready");
        setFallbackState(null);
      })
      .catch((e) => {
        setLoadError(String(e?.message ?? e));
        setLoadState("error");
        setFallbackState(null);
      });
  }

  /* ---- Videodownload (nur Build "full", §4a) ---- */

  const [dl, setDl] = React.useState<DownloadLage | null>(null);
  const dlRef = React.useRef<{ cancel: () => void } | null>(null);
  // Zählt jede neue Anfrage; verspätete Antworten älterer Anfragen (anderes Video,
  // abgebrochener Job) erkennen sich daran und fassen den Zustand nicht mehr an.
  const dlLauf = React.useRef(0);

  function brichDownloadAb() {
    dlLauf.current++;
    dlRef.current?.cancel();
    dlRef.current = null;
  }

  // Der Dialog gehört zum Video, mit dem er geöffnet wurde; Unmount räumt genauso auf.
  React.useEffect(() => {
    brichDownloadAb();
    setDl(null);
    return brichDownloadAb;
  }, [videoId]);

  function oeffneDownload() {
    if (!__FALLBACK__) return;
    brichDownloadAb();
    const lauf = dlLauf.current;
    // Öffnen lädt nur die Formatliste – der Download selbst wartet auf den zweiten Klick.
    setDl({ formate: null, fehler: "", hoehe: null, status: "wahl", fortschritt: "", pfad: "", ordner: "", name: "", ziel: "" });
    ask<VideoFormat[]>("videoFormats", { videoId })
      .then((formate) => {
        if (lauf !== dlLauf.current) return;
        const wunsch = settings?.downloadHeight ?? 720;
        const passend = formate.filter((f) => f.height <= wunsch);
        // Nächstkleinere vorhandene Höhe; gibt es keine darunter, die kleinste darüber.
        const hoehe = passend.length
          ? Math.max(...passend.map((f) => f.height))
          : formate.length
            ? Math.min(...formate.map((f) => f.height))
            : null;
        setDl((d) => d && { ...d, formate, hoehe });
      })
      .catch((e) => {
        if (lauf !== dlLauf.current) return;
        setDl((d) => d && { ...d, formate: [], fehler: String(e?.message ?? e) });
      });
  }

  async function starteDownload() {
    if (!__FALLBACK__ || !dl || dl.hoehe == null) return;
    const lauf = dlLauf.current;
    const hoehe = dl.hoehe;
    let ziel: string | undefined;
    if (settings?.downloadAsk) {
      // Ordnerdialog des Systems über den Helfer; Abbruch dort heisst: kein Download.
      setDl({ ...dl, status: "laeuft", fehler: "", fortschritt: t("downloadChoosing") });
      try {
        const gewaehlt = await ask<string | null>("chooseFolder");
        if (lauf !== dlLauf.current) return;
        if (!gewaehlt) {
          setDl((d) => d && { ...d, status: "wahl", fortschritt: "" });
          return;
        }
        ziel = gewaehlt;
      } catch (e) {
        if (lauf === dlLauf.current)
          setDl((d) => d && { ...d, status: "wahl", fehler: String((e as Error)?.message ?? e) });
        return;
      }
    }
    setDl((d) => d && { ...d, status: "laeuft", fehler: "", fortschritt: "" });
    const job = startDownload(videoId, hoehe, (p) => {
      if (lauf !== dlLauf.current) return;
      setDl((d) => d && {
        ...d,
        fortschritt: `${p.message}${p.percent != null ? ` (${p.percent}%)` : ""}`,
      });
    }, ziel);
    dlRef.current = job;
    job.promise
      .then((erg) => {
        if (lauf === dlLauf.current)
          setDl((d) => d && { ...d, status: "fertig", pfad: erg.path, ordner: erg.dir, name: erg.name, ziel: ziel ?? "" });
      })
      .catch((e) => {
        if (lauf === dlLauf.current)
          setDl((d) => d && { ...d, status: "wahl", fehler: String(e?.message ?? e) });
      })
      .finally(() => {
        if (dlRef.current === job) dlRef.current = null;
      });
  }

  /* ---- Erneut laden ---- */

  async function reloadTranscript() {
    if (!settings) return;
    setLoadState("loading");
    setLoadError("");
    try {
      const res = await loadTranscript(videoId, settings.captionLang);
      uebernimmTranskript(res.transcript);
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
      uebernimmTranskript(res.transcript);
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
      {__FALLBACK__ && dl && (
        <DownloadDialog
          t={t}
          lage={dl}
          onHoehe={(h) => setDl((d) => d && { ...d, hoehe: h })}
          onStart={starteDownload}
          onCancel={() => {
            brichDownloadAb();
            setDl((d) => d && { ...d, status: "wahl", fortschritt: "" });
          }}
          onClose={() => {
            brichDownloadAb();
            setDl(null);
          }}
          onReveal={(pfad) =>
            void ask("revealFile", { videoId, path: pfad, target: dl.ziel })
              .then(() => setDl((d) => d && { ...d, fehler: "" }))
              .catch((e) => setDl((d) => d && { ...d, fehler: String(e?.message ?? e) }))
          }
        />
      )}
      <Header
        t={t}
        tab={tab}
        setTab={setTab}
        onVideoDownload={__FALLBACK__ ? oeffneDownload : undefined}
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
            {/*
              Drei Reihen mit je einem Zweck: oben das ganze Video in vier Formen, von
              kurz nach lang, dann die Zeitachse. In der Mitte der Ausschnitt für einen
              Zweck, nach Reichweite geordnet – Fakten passen auf jedes Video, Anleitung
              und Pro/Contra nur auf ihren Typ. Unten das Aneignen und Weiterverfolgen,
              für Ausbildungsvideos. Reihen statt einer Leiste, weil eine einzige Reihe
              mehrfach umbricht und dann nicht mehr gelesen wird; eine vierte Reihe
              bräuchte ein Menü, und das wäre das Zeichen, wieder zu streichen.
              Ausgeblendet wird nichts: passt ein Knopf nicht zum Video, sagt sein Prompt
              das in einem Satz.
            */}
            {[
              [
                ["summary_short", "presetShort", "presetShortHint"],
                ["summary_medium", "presetMedium", "presetMediumHint"],
                ["summary_long", "presetLong", "presetLongHint"],
                ["chapters", "presetChapters", "presetChaptersHint"],
              ],
              [
                ["summary_facts", "presetFacts", "presetFactsHint"],
                ["claims", "presetClaims", "presetClaimsHint"],
                ["howto", "presetHowto", "presetHowtoHint"],
                ["pro_contra", "presetProContra", "presetProContraHint"],
                ["comparison", "presetComparison", "presetComparisonHint"],
              ],
              [
                ["glossary", "presetGlossary", "presetGlossaryHint"],
                ["references", "presetReferences", "presetReferencesHint"],
                ["quiz", "presetQuiz", "presetQuizHint"],
                ["positions", "presetPositions", "presetPositionsHint"],
              ],
            ].map((reihe, n) => (
              <div key={n} className={`flex flex-wrap items-center gap-1${n ? " mt-1" : ""}`}>
                {reihe.map(([key, label, hinweis]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant="secondary"
                    disabled={!transcript || streaming}
                    title={t(hinweis as Parameters<typeof t>[0])}
                    onClick={() => preset(key as keyof (typeof PRESETS)["de"])}
                  >
                    {t(label as Parameters<typeof t>[0])}
                  </Button>
                ))}
              </div>
            ))}
            {/*
              Der Zusatz zum Prompt gehört zu den Schnellbefehlen: er ergänzt einen
              Knopfdruck. Unten stand er dauerhaft im Weg, obwohl er selten gebraucht wird.
            */}
            <input
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder={t("extraPrompt")}
              className="mt-1.5 h-6 w-full rounded-md border border-dashed border-input bg-transparent px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
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
              <NoCaptions
                t={t}
                busy={fallbackState}
                onStart={runFallbackJob}
                onLive={runLive}
                onCancel={() => liveRef.current?.cancel()}
                keyFehlt={!settings?.apiKey}
                spurenVorhanden={tracks.length > 0}
              />
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
                <NoCaptions
                t={t}
                busy={fallbackState}
                onStart={runFallbackJob}
                onLive={runLive}
                onCancel={() => liveRef.current?.cancel()}
                keyFehlt={!settings?.apiKey}
                spurenVorhanden={tracks.length > 0}
              />
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
                  // Nur mit OpenRouter: die Suche ist dessen Web-Plugin.
                  !streaming && !mistralAktiv && messages[i - 1]?.role === "user"
                    ? () => {
                        const frage = messages[i - 1];
                        if (!frage) return;
                        // Bei einem Schnellbefehl steht in `label` nur „Fazit" – das als
                        // Suchanfrage zu schicken, sucht nach dem Wort statt nach der
                        // Sache. Dann geht die Antwort selbst mit ins Netz.
                        recherchiere(
                          frage.label
                            ? `${frage.label} – prüfe die Aussagen dieser Antwort im Netz:\n\n${m.content}`
                            : frage.content,
                        );
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
                      void frageSenden(v);
                    }
                  }
                }}
                placeholder={t("ask")}
                disabled={!transcript}
                className="max-h-40 min-h-8 px-2.5 py-[5px] text-sm [field-sizing:content]"
              />
              {/*
                Der Schalter gilt für die nächste getippte Frage: Transkript und Netz
                zusammen – deshalb steht er am Eingabefeld, nicht in der Werkzeugzeile.
                Die Weltkugel unter einer Antwort ist etwas anderes, sie schlägt zu einer
                schon beantworteten Frage nach. Der An-Zustand braucht eine eigene Farbe:
                bg-secondary ist im hellen Thema vom Kartengrund kaum zu unterscheiden.
              */}
              {/* Die Suche ist OpenRouters Web-Plugin; bei Mistral bleibt der Schalter
                  gesperrt und sagt warum – kein stiller Fehlschlag. */}
              <Button
                size="icon"
                variant="ghost"
                aria-pressed={webAn && !mistralAktiv}
                disabled={mistralAktiv}
                className={cn(
                  "size-8 shrink-0 [&_svg]:size-[18px]",
                  webAn && !mistralAktiv && "bg-primary/15 text-primary ring-1 ring-primary hover:bg-primary/25",
                )}
                title={mistralAktiv ? t("webOnlyOpenRouter") : webAn ? t("webToggleOn") : t("webToggleOff")}
                onClick={() => setWebAn((v) => !v)}
              >
                <Globe />
              </Button>
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
                    void frageSenden(v);
                  }}
                  title={t("send")}
                >
                  <ArrowUp />
                </Button>
              )}
            </div>

            {/*
              Das Modell steht klein unter dem Eingabefeld und lässt sich dort wechseln,
              ohne die Einstellungen zu öffnen (Vorbild Brave Leo). Bei Mistral führt der
              Knopf in die Einstellungen – dort liegt die geladene Modellliste.
            */}
            <div className="mt-1 flex items-center justify-between gap-1">
              <ModellMenue
                t={t}
                models={models}
                activeModel={activeModel}
                mistral={mistralAktiv}
                disabled={streaming}
                onPick={(id) =>
                  void speichereSettings({
                    model: id,
                    reasoning: isLiteModel(id) ? "minimal" : (settings?.reasoning ?? "minimal"),
                  })
                }
              />
            {messages.length > 0 && (
              <div className="flex items-center gap-1">
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
          onTranslate={transkriptUebersetzen}
          translationTarget={settings?.translationTarget ?? ""}
          onTargetChange={(name) => void speichereSettings({ translationTarget: name })}
          uiLang={uiLang}
          translation={uebersetzung}
          showTranslation={zeigeUebersetzung}
          downloadShare={downloadAnteil}
          mode={settings?.transcriptMode ?? "cues"}
          onMode={(m) => void speichereSettings({ transcriptMode: m })}
          getVideo={getVideo}
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
  onVideoDownload,
  onCollapse,
}: {
  t: T;
  tab: Tab;
  setTab: (t: Tab) => void;
  presetsToggle?: { open: boolean; toggle: () => void };
  /** Nur im Build "full" gesetzt (§4a): der Knopf muss sofort sichtbar sein, ohne Transkript. */
  onVideoDownload?: () => void;
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
        {onVideoDownload && (
          <Button size="iconSm" variant="ghost" title={t("downloadVideo")} onClick={onVideoDownload}>
            <Download />
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
  onLive,
  onCancel,
  keyFehlt,
  spurenVorhanden,
}: {
  t: T;
  busy: string | null;
  onStart: (job: HelperJob) => void;
  /** Spracherkennung aus dem laufenden Ton – in beiden Builds erlaubt. */
  onLive: () => void;
  onCancel: () => void;
  /** Ohne hinterlegten OpenRouter-Zugang geht die Spracherkennung nicht. */
  keyFehlt: boolean;
  /**
   * Ob YouTube überhaupt eine Untertitelspur meldet. Zwei verschiedene Lagen, die
   * bisher gleich aussahen: gibt es gar keine Spur, kann auch yt-dlp keine holen –
   * gemessen an vier Videos liest yt-dlp dieselbe Player-Antwort wie der Browser und
   * findet keine Spur, die hier fehlt. Dann bleibt nur die Tonspur.
   */
  spurenVorhanden: boolean;
}) {
  if (busy) {
    return (
      <div className="py-2 text-sm">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {busy}
        </p>
        <Button size="sm" variant="outline" className="mt-2" onClick={onCancel}>
          {t("liveCancel")}
        </Button>
      </div>
    );
  }

  // Jeder Weg startet ausschliesslich auf Klick, nie automatisch.
  return (
    <div className="text-sm">
      <p className="mb-3 text-destructive">
        {!spurenVorhanden
          ? t("noTracksAtAll")
          : __FALLBACK__
            ? t("noCaptionsFull")
            : t("noCaptionsStore")}
      </p>

      {__FALLBACK__ && spurenVorhanden && (
        <>
          <Button size="sm" className="mb-1" onClick={() => onStart("subtitles")}>
            {t("startSubtitles")}
          </Button>
          <p className="mb-4 text-xs text-muted-foreground">{t("subtitlesHint")}</p>
        </>
      )}

      {__FALLBACK__ && (
        <>
          <Button
            size="sm"
            variant={spurenVorhanden ? "outline" : "default"}
            className="mb-1"
            onClick={() => onStart("audio")}
          >
            {t("startFallback")}
          </Button>
          <p className="mb-4 text-xs text-muted-foreground">
            {spurenVorhanden ? t("audioHint") : t("audioHintOnly")}
          </p>
        </>
      )}

      {/*
        Ohne Download und ohne lokalen Helfer: das Video läuft stumm und beschleunigt,
        der Ton wird im Arbeitsspeicher erkannt. Deshalb steht dieser Weg auch im
        Store-Build – dort ist er der einzige.
      */}
      <Button
        size="sm"
        variant={__FALLBACK__ ? "outline" : "default"}
        className="mb-1"
        disabled={keyFehlt}
        onClick={onLive}
      >
        {t("liveStart")}
      </Button>
      <p className="text-xs text-muted-foreground">
        {keyFehlt ? t("noKey") : t("liveHint")}
      </p>
    </div>
  );
}

interface DownloadLage {
  /** null, solange die Formatliste geholt wird. */
  formate: VideoFormat[] | null;
  fehler: string;
  hoehe: number | null;
  status: "wahl" | "laeuft" | "fertig";
  fortschritt: string;
  pfad: string;
  /** Ordner mit ~ und Dateiname getrennt, wie der Helfer sie meldet. */
  ordner: string;
  name: string;
  /** Absoluter Ordner aus dem Ordnerdialog; leer heisst Einstellung bzw. Downloads. */
  ziel: string;
}

/**
 * Auflösungsdialog des Videodownloads (nur Build "full", §4a in CLAUDE.md). Liegt als
 * Fläche über der Sidebar; der Player der Seite wird nicht berührt. Geladen wird
 * ausschliesslich nach dem Klick auf „Herunterladen“.
 */
function DownloadDialog({
  t,
  lage,
  onHoehe,
  onStart,
  onCancel,
  onClose,
  onReveal,
}: {
  t: T;
  lage: DownloadLage;
  onHoehe: (h: number) => void;
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
  onReveal: (pfad: string) => void;
}) {
  const mb = (bytes: number | null) =>
    bytes == null ? t("downloadSizeUnknown") : `ca. ${(bytes / 1_048_576).toFixed(0)} MB`;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-card/95 p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium">{t("downloadTitle")}</span>
        <Button size="iconSm" variant="ghost" title={t("close")} onClick={onClose}>
          <X />
        </Button>
      </div>

      {lage.formate === null && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("downloadLoadingFormats")}
        </p>
      )}

      {lage.formate !== null && lage.status !== "fertig" && (
        <div className="mb-3 flex flex-col gap-1">
          {lage.formate.length === 0 && !lage.fehler && (
            <p className="text-muted-foreground">{t("downloadNoFormats")}</p>
          )}
          {lage.formate.map((f) => (
            <label key={f.height} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="download-hoehe"
                checked={lage.hoehe === f.height}
                disabled={lage.status === "laeuft"}
                onChange={() => onHoehe(f.height)}
              />
              <span className="w-14">{f.height}p</span>
              <span className="text-muted-foreground">{mb(f.bytes)}</span>
            </label>
          ))}
        </div>
      )}

      {lage.fehler && (
        <p className="mb-3 whitespace-pre-wrap text-destructive">{lage.fehler}</p>
      )}

      {lage.status === "laeuft" && (
        <p className="mb-3 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {lage.fortschritt || t("fallbackRunning")}
        </p>
      )}

      {lage.status === "fertig" && (
        <div className="mb-3">
          <p className="font-medium">{t("downloadDone")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("downloadFolder")}</p>
          <p className="break-all font-mono text-xs">{lage.ordner}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("downloadFile")}</p>
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 break-all font-mono text-xs">{lage.name}</p>
            <Button size="iconSm" variant="outline" title={t("downloadReveal")} onClick={() => onReveal(lage.pfad)}>
              <FolderOpen />
            </Button>
          </div>
          <button
            type="button"
            className="mt-3 cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => void chrome.runtime.sendMessage({ type: "openOptions" })}
          >
            {t("downloadFolderAdjust")}
          </button>
        </div>
      )}

      <p className="mb-3 text-xs text-muted-foreground">{t("downloadLegal")}</p>

      <div className="flex gap-2">
        {lage.status === "wahl" && (
          <Button size="sm" disabled={lage.hoehe == null} onClick={onStart}>
            {t("downloadStart")}
          </Button>
        )}
        {lage.status === "laeuft" && (
          <Button size="sm" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
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
  const aus_liste = ZIELSPRACHEN.find(([n]) => n.toLowerCase() === name.trim().toLowerCase());
  if (aus_liste) return aus_liste[1];
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

/** Kurzname ohne Anbieter: aus „Google: Gemini 3.8 Flash" wird „Gemini 3.8 Flash". */
function kurzName(m: ModelInfo | undefined, id: string): string {
  return m ? m.name.replace(/^[^:]+:\s*/, "") : id || "–";
}

function ModellMenue({
  t,
  models,
  activeModel,
  mistral,
  disabled,
  onPick,
}: {
  t: T;
  models: ModelInfo[];
  activeModel: string;
  mistral: boolean;
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  const [offen, setOffen] = React.useState(false);
  const huelle = React.useRef<HTMLDivElement>(null);
  const ausloeser = React.useRef<HTMLButtonElement>(null);

  // Beginnt ein Stream, während das Menü offen ist, schliesst es – sonst liesse sich
  // das Modell mitten in der laufenden Antwort umstellen.
  React.useEffect(() => {
    if (disabled) setOffen(false);
  }, [disabled]);

  const schliessen = () => {
    setOffen(false);
    ausloeser.current?.focus();
  };

  React.useEffect(() => {
    if (!offen) return;
    // composedPath statt contains: die Sidebar sitzt im Shadow DOM, dort zeigt
    // event.target am Dokument nur noch auf den Host.
    const zu = (e: MouseEvent) => {
      if (huelle.current && !e.composedPath().includes(huelle.current)) setOffen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") schliessen();
    };
    document.addEventListener("mousedown", zu);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", zu);
      document.removeEventListener("keydown", esc);
    };
  }, [offen]);

  const oeffneOptionen = () => void chrome.runtime.sendMessage({ type: "openOptions" });
  const aktiv = models.find((m) => m.id === activeModel);
  const empfohlen = empfohleneModelle(models);

  return (
    <div ref={huelle} className="relative min-w-0">
      <button
        ref={ausloeser}
        type="button"
        disabled={disabled}
        title={t("modelPick")}
        aria-haspopup="listbox"
        aria-expanded={offen}
        aria-controls="yt-summary-modellmenue"
        className="flex max-w-full items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
        onClick={() => (mistral ? oeffneOptionen() : setOffen((v) => !v))}
      >
        <span className="truncate">{kurzName(aktiv, activeModel)}</span>
        <ChevronDown className="size-3 shrink-0" />
      </button>
      {offen && (
        <div
          id="yt-summary-modellmenue"
          className="absolute bottom-full left-0 z-50 mb-1 w-72 overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-md"
        >
          <ul role="listbox" aria-label={t("modelPick")} className="max-h-80 overflow-y-auto py-1">
            {empfohlen.map(([m, marken]) => {
              const preis = preisProAnfrage(m);
              return (
                <li key={m.id} role="option" aria-selected={m.id === activeModel}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start px-2.5 py-1.5 text-left hover:bg-secondary",
                      m.id === activeModel && "bg-primary/10",
                    )}
                    onClick={() => {
                      onPick(m.id);
                      schliessen();
                    }}
                  >
                    <span className="flex items-center gap-1.5 text-sm">
                      {kurzName(m, m.id)}
                      {m.contextLength >= ONE_M_CONTEXT && (
                        <span className="rounded border border-border px-1 text-[10px] text-muted-foreground">1M</span>
                      )}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {marken.join(" · ")}
                      {preis != null && ` · ≈ ${formatPreis(preis)} je Anfrage`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="flex w-full items-center justify-between border-t border-border px-2.5 py-1.5 text-sm hover:bg-secondary"
            onClick={oeffneOptionen}
          >
            {t("allModels")}
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
