import type { UiLang } from "./types";

// ponytail: zwei Sprachobjekte und ein t(). Ein i18n-Paket würde hier nur Gewicht
// hinzufügen – es gibt genau zwei Sprachen und keine Pluralregeln.

const de = {
  sidebarTitle: "Transkript-Chat",
  collapse: "Einklappen",
  expand: "Ausklappen",
  ask: "Frage zum Video …",
  send: "Senden",
  contextLost: "Die Erweiterung wurde aktualisiert oder neu geladen. Bitte die Seite neu laden (F5).",
  modelPick: "Modell wechseln",
  allModels: "Alle Modelle",
  modelSearch: "Suchen – Name oder Slug",
  modelsRecommended: "Empfohlen",
  modelNoMatch: "Kein Modell passt.",
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
  presetShort: "In Kürze",
  presetMedium: "Zusammenfassung",
  presetLong: "Ausführlich",
  presetShortHint: "Sechs Sätze: was behauptet wird und wozu es kommt. Ohne Zeitstempel.",
  presetMediumHint:
    "Zwei bis vier Absätze, je Thema einer, das Thema fett vorneweg. Ohne Zeitstempel.",
  presetLongHint: "Ersetzt das Video: jede Sachfrage mit Zahlen, Einwänden und Zeitstempeln.",
  presetFacts: "Fakten",
  presetFactsHint: "Bis zu 20 nachprüfbare Zahlen, Namen und Daten, je mit Zeitstempel.",
  presetChapters: "Kapitel",
  presetChaptersHint: "Zum Springen: die Abschnitte des Videos mit Zeitstempel und einem Satz.",
  presetClaims: "Behauptungen",
  presetClaimsHint:
    "Bis zu 15 Behauptungen, je ein Absatz mit dem, was sie belegt – oder „Unbelegt“.",
  presetHowto: "Anleitung",
  presetHowtoHint:
    "Zum Nachmachen: Schritte in Reihenfolge, mit Befehlen, Werten und Zeitstempel.",
  presetProContra: "Pro/Contra",
  presetComparisonHint:
    "Was das Video gegenüberstellt, als Tabelle – Merkmal für Merkmal, dazu der eine " +
    "Unterschied, an dem die Entscheidung hängt.",
  presetProContraHint:
    "Zum Entscheiden: Argumente dafür und dagegen, für wen, Alternativen.",
  presetComparison: "Vergleich",
  presetGlossary: "Begriffe",
  presetGlossaryHint:
    "Fachbegriffe und Methoden mit der Erklärung, die der Sprecher selbst gibt.",
  presetSentiment: "Kommentarstimmung",
  presetSentimentHint:
    "Lädt die rund 100 obersten Kommentare (nur in den Arbeitsspeicher) und lässt das Modell ihre Stimmung auswerten: Anteile, Lob- und Kritikpunkte, drei Zitate.",
  commentsNone: "Keine Kommentare gefunden.",
  presetQuiz: "Lernfragen",
  presetQuizHint:
    "Zur Lernkontrolle: Fragen zum Stoff, je mit der Antwort aus dem Video.",
  extraPrecedence:
    "Zusatz des Nutzers – hat Vorrang vor Form und Schwerpunkt, nicht vor den Regeln " +
    "zur Quellentreue:",
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
  liveStart: "Transkript per Spracherkennung erstellen",
  liveHint:
    "Das Video läuft dabei stumm mit vierfacher Geschwindigkeit; der Ton wird dabei über "
    + "OpenRouter mit deinem eigenen Schlüssel erkannt. Es dauert etwa ein Viertel der "
    + "Videolänge, der Tab darf dabei im Hintergrund liegen. Es wird nichts gespeichert.",
  liveRunning: "Erkennt",
  liveWaitingAd: "Wartet, bis die Werbung vorbei ist – ihr Ton gehört nicht ins Transkript.",
  liveCancel: "Abbrechen",
  noKey:
    "Es ist kein OpenRouter-API-Key hinterlegt. Bitte in den Einstellungen eintragen.",
  noKeyMistral:
    "Mistral AI ist als Anbieter gewählt, aber kein Mistral-API-Key hinterlegt. Bitte in den Einstellungen eintragen.",
  noModelMistral:
    "Für Mistral AI ist noch kein Modell gewählt. In den Einstellungen „Modelle laden“ und eines auswählen.",
  webOnlyOpenRouter: "Internetsuche nur mit OpenRouter – bei Mistral AI nicht verfügbar.",
  openOptions: "Einstellungen öffnen",
  noTimestamps:
    "Diese Transkriptquelle liefert keine Zeitstempel. Sprungmarken stehen deshalb nicht zur Verfügung.",
  transcriptSource: "Quelle",
  tokens: "Token",
  cost: "Kosten",
  priceList: "Preisliste",
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
  downloadVideo: "Video herunterladen",
  downloadMenu: "Herunterladen …",
  downloadAudio: "Audio herunterladen",
  downloadAudioOnly: "Nur Ton",
  downloadTranscriptTxt: "Transkript (.txt)",
  downloadComments: "Kommentare (.html)",
  commentsLoading: "Kommentare werden geladen",
  commentsStopHint: "Anhalten und das bisher Geladene speichern",
  downloadTitle: "Herunterladen",
  downloadLoadingFormats: "Verfügbare Auflösungen werden geholt …",
  downloadNoFormats: "Für dieses Video meldet yt-dlp keine passende Auflösung.",
  downloadSizeUnknown: "Grösse unbekannt",
  downloadLegal:
    "Nur für eigene, gemeinfreie oder lizenzfreie Inhalte – bei allem anderen ist der Download in Deutschland und Österreich nicht risikofrei.",
  downloadStart: "Herunterladen",
  downloadDone: "Gespeichert",
  downloadFolder: "Ordner",
  downloadFile: "Datei",
  downloadFolderAdjust: "Downloadordner anpassen",
  downloadChoosing: "Ordnerdialog ist offen …",
  downloadReveal: "Im Ordner zeigen",
  updateAvailable: "Neue Version",
  updateInstall: "Aktualisieren",
  updateBusy: "Wird aktualisiert …",
  updateDone: "Aktualisiert. Seite neu laden (F5).",
  updateLater: "Später",
  updateNotes: "Was ist neu",
  close: "Schliessen",
} as const;

type Keys = keyof typeof de;

const en: Record<Keys, string> = {
  sidebarTitle: "Transcript chat",
  collapse: "Collapse",
  expand: "Expand",
  ask: "Ask about the video …",
  send: "Send",
  contextLost: "The extension was updated or reloaded. Please reload the page (F5).",
  modelPick: "Switch model",
  allModels: "All models",
  modelSearch: "Search – name or slug",
  modelsRecommended: "Recommended",
  modelNoMatch: "No model matches.",
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
  presetShort: "In brief",
  presetMedium: "Summary",
  presetLong: "In depth",
  presetShortHint: "What is claimed and what it amounts to – one or two paragraphs, no timestamps.",
  presetMediumHint: "Two to four paragraphs, one per topic, the topic in bold up front. No timestamps.",
  presetLongHint: "Every question as its own section, with reasoning, figures, names and timestamps.",
  presetFacts: "Facts",
  presetFactsHint: "Figures, names, dates and quotes as a list, one timestamp per item as evidence – no judgement.",
  presetChapters: "Chapters",
  presetChaptersHint: "For jumping: the sections of the video with timestamp and one sentence.",
  presetClaims: "Claims",
  presetClaimsHint: "Up to 15 claims, one paragraph each with what backs it – or \"unsupported\".",
  presetHowto: "How-to",
  presetHowtoHint: "To follow along: the steps in order, with commands, values and timestamps.",
  presetProContra: "Pros/cons",
  presetComparisonHint: "What the video sets against each other, as a table, plus the one difference a decision turns on.",
  presetProContraHint: "To decide: arguments for and against, who it suits, alternatives.",
  presetComparison: "Comparison",
  presetGlossary: "Terms",
  presetGlossaryHint: "Technical terms and methods with the explanation the speaker gives.",
  presetSentiment: "Comment mood",
  presetSentimentHint:
    "Loads the ~100 top comments (in memory only) and has the model assess their sentiment: shares, praise and criticism, three quotes.",
  commentsNone: "No comments found.",
  presetQuiz: "Self-check",
  presetQuizHint: "To test yourself: questions on the material, each with the answer from the video.",
  extraPrecedence:
    "User addition – takes precedence over form and focus, not over the rules on " +
    "staying true to the source:",
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
  liveStart: "Create transcript by speech recognition",
  liveHint:
    "The video plays muted at four times speed while its audio is recognised via "
    + "OpenRouter with your own key. It takes about a quarter of the video's length and "
    + "the tab may stay in the background. Nothing is stored.",
  liveRunning: "Recognising",
  liveWaitingAd: "Waiting for the ad to finish – its audio does not belong in the transcript.",
  liveCancel: "Cancel",
  noKey: "No OpenRouter API key configured. Please add one in the settings.",
  noKeyMistral:
    "Mistral AI is the selected provider, but no Mistral API key is configured. Please add one in the settings.",
  noModelMistral:
    "No model selected for Mistral AI yet. Use “Load models” in the settings and pick one.",
  webOnlyOpenRouter: "Web search only with OpenRouter – not available with Mistral AI.",
  openOptions: "Open settings",
  noTimestamps:
    "This transcript source provides no timestamps, so jump marks are unavailable.",
  transcriptSource: "Source",
  tokens: "Tokens",
  cost: "Cost",
  priceList: "price list",
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
  downloadVideo: "Download video",
  downloadMenu: "Download …",
  downloadAudio: "Download audio",
  downloadAudioOnly: "Audio only",
  downloadTranscriptTxt: "Transcript (.txt)",
  downloadComments: "Comments (.html)",
  commentsLoading: "Loading comments",
  commentsStopHint: "Stop and save what has been loaded so far",
  downloadTitle: "Download",
  downloadLoadingFormats: "Fetching available resolutions …",
  downloadNoFormats: "yt-dlp reports no suitable resolution for this video.",
  downloadSizeUnknown: "size unknown",
  downloadLegal:
    "Only for your own, public-domain or royalty-free content – for anything else the download is not free of legal risk.",
  downloadStart: "Download",
  downloadDone: "Saved",
  downloadFolder: "Folder",
  downloadFile: "File",
  downloadFolderAdjust: "Change download folder",
  downloadChoosing: "Folder dialog is open …",
  downloadReveal: "Show in folder",
  updateAvailable: "New version",
  updateInstall: "Update",
  updateBusy: "Updating …",
  updateDone: "Updated. Reload the page (F5).",
  updateLater: "Later",
  updateNotes: "What's new",
  close: "Close",
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
