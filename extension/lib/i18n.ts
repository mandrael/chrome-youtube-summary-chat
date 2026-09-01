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
  presetShort: "Kurz",
  presetMedium: "Mittel",
  presetLong: "Lang",
  presetChapters: "Kapitel",
  presetTranslate: "Übersetzen",
  tabChat: "Chat",
  tabTranscript: "Transkript",
  tabHistory: "Verlauf",
  extraPrompt: "Zusatz zum Prompt (optional)",
  loadingTranscript: "Transkript wird geladen …",
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
  presetShort: "Short",
  presetMedium: "Medium",
  presetLong: "Long",
  presetChapters: "Chapters",
  presetTranslate: "Translate",
  tabChat: "Chat",
  tabTranscript: "Transcript",
  tabHistory: "History",
  extraPrompt: "Extra prompt (optional)",
  loadingTranscript: "Loading transcript …",
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
