import type { UiLang } from "./types";

// ponytail: zwei Sprachobjekte und ein t(). Ein i18n-Paket würde hier nur Gewicht
// hinzufügen – es gibt genau zwei Sprachen und keine Pluralregeln.

const de = {
  sidebarTitle: "Transkript-Chat",
  collapse: "Einklappen",
  expand: "Ausklappen",
  ask: "Frage zum Video …",
  send: "Senden",
  stop: "Abbrechen",
  copy: "Kopieren",
  copied: "Kopiert",
  exportMd: "Als Markdown",
  clear: "Verlauf löschen",
  newChat: "Leeren",
  resizeHint: "Breite ziehen",
  presets: "Schnellbefehle",
  webSearch: "Recherche",
  webSearchHint: "Diese Frage im Internet recherchieren – mit dem Videotitel als Kontext (kostet rund 0,007 $ zusätzlich)",
  sources: "Fundstellen",
  searchTranscript: "Im Transkript suchen …",
  hits: "Treffer",
  noHits: "Keine Zeile enthält diesen Begriff.",
  clearSearch: "Suche leeren",
  captionTrackYouTube: "Untertitelspur von YouTube",
  translateAiHint: "Transkript übersetzen",
  newChatHint: "Unterhaltung zu diesem Video verwerfen und neu anfangen",
  presetShort: "Fazit",
  presetMedium: "Argumente",
  presetLong: "Ausführlich",
  presetShortHint: "Was behauptet wird und wozu es kommt – ein bis zwei Absätze, ohne Zeitstempel.",
  presetMediumHint: "Hauptaussage plus die drei bis fünf tragenden Punkte mit Begründung und Belegstellen.",
  presetLongHint: "Jede Sachfrage als eigener Abschnitt, mit Begründung, Zahlen, Namen und Zeitstempeln.",
  presetFacts: "Fakten",
  presetFactsHint: "Zahlen, Namen, Daten und Zitate als Liste, je Angabe ein Zeitstempel als Beleg – ohne Wertung.",
  presetChapters: "Kapitel",
  presetTranslate: "Übersetzen",
  tabChat: "Chat",
  tabTranscript: "Transkript",
  tabHistory: "Verlauf",
  extraPrompt: "Zusatz zum Prompt (optional)",
  loadingTranscript: "Transkript wird geladen …",
  waitingVisible:
    "Wartet, bis dieser Tab im Vordergrund ist – im Hintergrund lädt YouTube das Transkript nicht.",
  noCaptions: "Für dieses Video sind keine Untertitel verfügbar.",
  noCaptionsStore:
    "Für dieses Video sind keine Untertitel verfügbar. Ohne Untertitel kann dieser Build kein Transkript erzeugen.",
  noCaptionsFull:
    "Über die Seite kam kein Transkript. Der lokale Helfer hat zwei Wege:",
  startFallback: "Tonspur transkribieren",
  startSubtitles: "Untertitel über den lokalen Helfer holen",
  subtitlesHint:
    "Kostenlos und mit den Zeitstempeln von YouTube. Der Helfer holt die vorhandene Untertitelspur mit yt-dlp – das gelingt auch dann, wenn die Seite selbst keine liefert.",
  audioHint:
    "Nur nötig, wenn es wirklich keine Untertitel gibt. Lädt die Tonspur herunter und transkribiert sie – dauert länger und kostet je nach Route Geld.",
  fallbackRunning: "Wird verarbeitet …",
  noKey:
    "Es ist kein OpenRouter-API-Key hinterlegt. Bitte in den Einstellungen eintragen.",
  openOptions: "Einstellungen öffnen",
  noTimestamps:
    "Diese Transkriptquelle liefert keine Zeitstempel. Sprungmarken stehen deshalb nicht zur Verfügung.",
  transcriptSource: "Quelle",
  tokens: "Token",
  cost: "Kosten",
  historyEmpty: "Noch keine gespeicherten Unterhaltungen.",
  delete: "Löschen",
  translateWith: "Übersetzen mit",
  translateLocal: "Chrome (lokal, kostenlos)",
  translateCloud: "OpenRouter",
  localTranslateUnavailable:
    "Chrome-Übersetzung für dieses Sprachpaar nicht verfügbar.",
  localTranslateDownloading: "Sprachmodell wird geladen",
  retry: "Erneut versuchen",
  panelNoVideo:
    "Kein YouTube-Video im aktiven Tab. Öffne ein Video – die Seitenleiste folgt automatisch.",
  translateAnswer: "Antwort übersetzen",
  translateTranscriptLabel: "Transkript übersetzen",
  forceAudio: "Neu transkribieren (Audio)",
  forceAudioHint:
    "Nimmt nicht die Untertitel von YouTube, sondern lädt die Tonspur und transkribiert sie über die eingestellte STT-Route. Dauert länger und kostet je nach Route Geld.",
} as const;

type Keys = keyof typeof de;

const en: Record<Keys, string> = {
  sidebarTitle: "Transcript chat",
  collapse: "Collapse",
  expand: "Expand",
  ask: "Ask about the video …",
  send: "Send",
  stop: "Stop",
  copy: "Copy",
  copied: "Copied",
  exportMd: "As Markdown",
  clear: "Clear history",
  newChat: "Clear",
  resizeHint: "Drag to resize",
  presets: "Quick actions",
  webSearch: "Research",
  webSearchHint: "Research this question on the web – with the video title as context (adds roughly $0.007)",
  sources: "Sources",
  searchTranscript: "Search the transcript …",
  hits: "hits",
  noHits: "No line contains this term.",
  clearSearch: "Clear search",
  captionTrackYouTube: "Caption track from YouTube",
  translateAiHint: "Translate transcript",
  newChatHint: "Discard this video's conversation and start over",
  presetShort: "Bottom line",
  presetMedium: "Arguments",
  presetLong: "In depth",
  presetShortHint: "What is claimed and what it amounts to – one or two paragraphs, no timestamps.",
  presetMediumHint: "Main claim plus the three to five load-bearing points with reasoning and references.",
  presetLongHint: "Every question as its own section, with reasoning, figures, names and timestamps.",
  presetFacts: "Facts",
  presetFactsHint: "Figures, names, dates and quotes as a list, one timestamp per item as evidence – no judgement.",
  presetChapters: "Chapters",
  presetTranslate: "Translate",
  tabChat: "Chat",
  tabTranscript: "Transcript",
  tabHistory: "History",
  extraPrompt: "Extra prompt (optional)",
  loadingTranscript: "Loading transcript …",
  waitingVisible:
    "Waiting for this tab to come to the front – YouTube does not load the transcript in a background tab.",
  noCaptions: "No captions are available for this video.",
  noCaptionsStore:
    "No captions are available for this video. Without captions this build cannot produce a transcript.",
  noCaptionsFull: "The page returned no transcript. The local helper has two ways:",
  startFallback: "Transcribe audio track",
  startSubtitles: "Fetch captions via the local helper",
  subtitlesHint:
    "Free, with YouTube's own timestamps. The helper fetches the existing caption track with yt-dlp – this works even when the page itself returns nothing.",
  audioHint:
    "Only needed when there really are no captions. Downloads the audio track and transcribes it – slower, and depending on the route it costs money.",
  fallbackRunning: "Processing …",
  noKey: "No OpenRouter API key configured. Please add one in the settings.",
  openOptions: "Open settings",
  noTimestamps:
    "This transcript source provides no timestamps, so jump marks are unavailable.",
  transcriptSource: "Source",
  tokens: "Tokens",
  cost: "Cost",
  historyEmpty: "No saved conversations yet.",
  delete: "Delete",
  translateWith: "Translate with",
  translateLocal: "Chrome (local, free)",
  translateCloud: "OpenRouter",
  localTranslateUnavailable:
    "Chrome translation is not available for this language pair.",
  localTranslateDownloading: "Downloading language model",
  retry: "Retry",
  panelNoVideo:
    "No YouTube video in the active tab. Open one – the side panel follows automatically.",
  translateAnswer: "Translate answer",
  translateTranscriptLabel: "Translate transcript",
  forceAudio: "Re-transcribe (audio)",
  forceAudioHint:
    "Ignores YouTube's captions, downloads the audio track and transcribes it via the configured STT route. Slower, and depending on the route it costs money.",
};

const dict = { de, en };

export function resolveUiLang(setting: UiLang | "auto"): UiLang {
  if (setting !== "auto") return setting;
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

export function makeT(lang: UiLang) {
  return (key: Keys): string => dict[lang][key];
}

export type T = ReturnType<typeof makeT>;
