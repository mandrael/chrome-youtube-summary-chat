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
  viewMode: "Ansicht",
  viewCues: "Als Untertitel, Zeile für Zeile",
  viewRead: "Lesetext – grosse Absätze, ohne Zeitmarken",
  copyCues: "Untertitelzeilen mit Zeitmarken kopieren",
  copyParas: "Absätze mit Zeitmarken kopieren",
  copyRead: "Lesetext ohne Zeitmarken kopieren",
  viewText: "Als Fliesstext in Absätzen",
  followOn: "Folgt der Wiedergabe – klicken zum Anhalten",
  followOff: "Zur aktuellen Stelle springen und mitlaufen",
  translateResume: "Ab hier nicht übersetzt – fortsetzen",
  showTranslation: "Übersetzung anzeigen",
  showOriginal: "Original anzeigen",
  cancel: "Abbrechen",
  webSearch: "Recherche",
  webSearchHint: "Im Netz nachschlagen zur letzten Frage",
  webToggleOff: "Nächste Frage auch im Netz suchen (rund 0,007 $ je Anfrage)",
  webToggleOn: "Internetsuche an – nächste Frage geht auch ins Netz",
  sources: "Fundstellen",
  searchTranscript: "Im Transkript suchen …",
  hits: "Treffer",
  noHits: "Keine Zeile enthält diesen Begriff.",
  clearSearch: "Suche leeren",
  captionTrackYouTube: "Untertitelspur von YouTube",
  translateAiHint: "Transkript mit KI übersetzen",
  translationTargetTitle: "Zielsprache der Übersetzung",
  resumeTranslation: "Übersetzung fortsetzen",
  translateSameLang: "Transkript ist bereits in der Zielsprache",
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
  noTracksAtAll:
    "Dieses Video hat keine Untertitel – auch keine automatisch erzeugten. "
    + "Es bleibt nur die Tonspur.",
  audioHintOnly:
    "Lädt die Tonspur und transkribiert sie über die eingestellte Route. Dauert länger und kostet je nach Route Geld; lokal mit Parakeet ist es kostenlos.",
  noCaptionsStore:
    "Für dieses Video sind keine Untertitel verfügbar. Ohne Untertitel kann dieser Build kein Transkript erzeugen.",
  noCaptionsFull:
    "YouTube meldet eine Untertitelspur, liefert ihren Inhalt aber nicht. Der lokale Helfer hat zwei Wege:",
  startFallback: "Tonspur transkribieren",
  startSubtitles: "Untertitelspur über den lokalen Helfer holen",
  subtitlesHint:
    "Kostenlos und mit den Zeitstempeln von YouTube. yt-dlp liest dieselbe Spurliste wie die Seite, kommt aber an den Inhalt, wenn der Abruf im Browser leer bleibt.",
  audioHint:
    "Nur nötig, wenn auch das nichts bringt. Lädt die Tonspur und transkribiert sie – dauert länger; lokal mit Parakeet kostenlos, über OpenRouter kostet es Geld.",
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
  viewMode: "View",
  viewCues: "As captions, line by line",
  viewRead: "Reading text – large paragraphs, no timestamps",
  copyCues: "Copy caption lines with timestamps",
  copyParas: "Copy paragraphs with timestamps",
  copyRead: "Copy reading text without timestamps",
  viewText: "As running text in paragraphs",
  followOn: "Following playback – click to stop",
  followOff: "Jump to the current spot and follow",
  translateResume: "Not translated from here – resume",
  showTranslation: "Show translation",
  showOriginal: "Show original",
  cancel: "Cancel",
  webSearch: "Research",
  webSearchHint: "Look up the last question on the web",
  webToggleOff: "Also search the web for the next question (about $0.007 per request)",
  webToggleOn: "Web search on – the next question also goes to the web",
  sources: "Sources",
  searchTranscript: "Search the transcript …",
  hits: "hits",
  noHits: "No line contains this term.",
  clearSearch: "Clear search",
  captionTrackYouTube: "Caption track from YouTube",
  translateAiHint: "Translate transcript with AI",
  translationTargetTitle: "Target language of the translation",
  resumeTranslation: "Resume translation",
  translateSameLang: "Transcript is already in the target language",
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
  noTracksAtAll:
    "This video has no captions at all, not even auto-generated ones. Only the audio track is left.",
  audioHintOnly:
    "Downloads the audio track and transcribes it with the configured route. Takes longer and may cost money; locally with Parakeet it is free.",
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
