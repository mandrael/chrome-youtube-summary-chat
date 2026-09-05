/** Ein Untertitel-Segment mit Zeitstempel. `start`/`dur` in Sekunden. */
export interface Cue {
  start: number;
  dur: number;
  text: string;
}

/** Ergebnis einer Transkript-Beschaffung – egal ob aus Untertiteln oder aus dem Audio-Fallback. */
export interface Transcript {
  cues: Cue[];
  /** Sprachcode der Quelle, soweit bekannt. */
  lang?: string;
  /** Anzeigename der Spur bzw. der STT-Route. */
  source: string;
  /**
   * false, wenn die Quelle keine Zeitstempel geliefert hat. Dann werden in der UI
   * keine Sprungmarken angeboten – es wird nicht so getan, als gäbe es sie.
   */
  hasTimestamps: boolean;
}

export interface CaptionTrack {
  lang: string;
  name: string;
  url: string;
  /** Automatisch erzeugte Spur (ASR) statt vom Kanal hochgeladen. */
  auto: boolean;
  /**
   * YouTubes eigene Vorauswahl (`defaultCaptionTrackIndex`). Bei Videos mit vielen
   * Community-Spuren ist das die Originalsprache – ohne diese Angabe landet man
   * schnell bei der alphabetisch ersten, im Test Arabisch statt Englisch.
   */
  standard?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /**
   * Was in der Blase steht, wenn es nicht `content` sein soll. Die Preset-Knöpfe
   * schicken einen langen Anweisungstext ans Modell; angezeigt wird davon nur der
   * Name des Knopfes.
   */
  label?: string;
  /** Nur bei Assistenten-Nachrichten und nur, wenn die Kostenanzeige an ist. */
  usage?: Usage;
  /** Fundstellen der Internetrecherche, falls sie für diese Antwort lief. */
  sources?: Array<{ url: string; title?: string }>;
  error?: boolean;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  /** USD, kommt direkt von OpenRouter. Mistral liefert keinen Betrag – dann fehlt das Feld. */
  cost?: number;
}

export interface Conversation {
  videoId: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
  /** Unix-Sekunden der Veröffentlichung; sortiert die Liste. */
  created?: number;
  /** USD pro Token, roh wie von der API geliefert. */
  pricePrompt?: number;
  priceCompletion?: number;
  supportsReasoning: boolean;
}

export interface SttModelInfo {
  id: string;
  name: string;
  /** Rohwert aus `pricing.prompt`, Einheit ist in der API nicht ausgewiesen. */
  rawPrice: number;
  /** Aus dem Rohwert geschätzte Einheit – siehe `guessPriceUnit`. */
  unit: "second" | "minute" | "hour";
  /** Rohwert auf USD pro Stunde umgerechnet. */
  usdPerHour: number;
  providers: string[];
  /** Provider führt `response_format`, also Chance auf verbose_json mit Segmenten. */
  supportsResponseFormat: boolean;
}

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export type SttRoute =
  | "openrouter-whisper-turbo"
  | "openrouter-parakeet"
  | "parakeet-primeline"
  | "parakeet-mlx";

/**
 * Wege des lokalen Helfers. "subtitles" holt die vorhandenen Untertitel per yt-dlp –
 * kostenlos und mit den Zeitstempeln von YouTube. "audio" laedt die Tonspur und
 * transkribiert sie ueber die eingestellte SttRoute.
 */
export type HelperJob = "subtitles" | "audio";

/** Genau zwei Gegenstellen: OpenRouter (Standard) und Mistral AI direkt (EU, Datenschutzoption). */
export type Provider = "openrouter" | "mistral";
export type MistralRegion = "eu" | "global";

export type UiLang = "de" | "en";
export type AnswerLang = "auto" | "de" | "en";

export interface Settings {
  provider: Provider;
  /** OpenRouter-Key. */
  apiKey: string;
  /** OpenRouter-Modell-Slug. */
  model: string;
  /** Mistral-Key, geht nur an Mistrals eigene Endpunkte. */
  mistralApiKey: string;
  /**
   * Regionaler Inferenz-Endpunkt. "eu" = api.eu.mistral.ai, Verarbeitung garantiert in der
   * EU (rund 10 % Aufpreis laut Mistral-Doku „Regional inference"); "global" = api.mistral.ai.
   */
  mistralRegion: MistralRegion;
  /** Mistral-Modell-ID; leer, bis „Modelle laden" gelaufen ist. */
  mistralModel: string;
  reasoning: ReasoningEffort;
  systemPrompt: string;
  answerLang: AnswerLang;
  translationTarget: string;
  /** "auto" = Originalspur, sonst ein Sprachcode. */
  captionLang: string;
  uiLang: UiLang | "auto";
  showCost: boolean;
  sttRoute: SttRoute;
  /** Vorgewählte Auflösung im Download-Dialog. */
  downloadHeight: 360 | 480 | 720 | 1080;
  /** Zielordner; leer bedeutet den Downloads-Ordner des Systems. */
  downloadTarget: string;
  /** Vor jedem Download den Ordnerdialog zeigen statt den Zielordner zu nehmen. */
  downloadAsk: boolean;
  /** Chrome-eigene Translator API statt OpenRouter fürs Übersetzen. */
  preferLocalTranslate: boolean;
  uiScale: number;
  /** Breite der rechten YouTube-Spalte in Pixeln; der Player weicht entsprechend. */
  columnWidth: number;
  /** Wie das Transkript gelesen wird: Zeile je Untertitel oder Fliesstext in Absätzen. */
  transcriptMode: "cues" | "text" | "read";
  /** Wörterbuch als Text, eine Zeile je Eintrag. Siehe parseWoerterbuch. */
  dictionary: string;
}

/**
 * Eine Übersetzung des Transkripts, zeilenweise und mit Stand.
 *
 * Sie liegt bewusst nicht als Chat-Antwort vor: sie gehört in den Transkript-Tab, sie
 * überlebt einen Abbruch (`partial` plus `done`), und sie lässt sich fortsetzen.
 */
export interface TranscriptTranslation {
  /** Sprachcode der Zielsprache, "de". */
  target: string;
  /** Anzeigename, "Deutsch". */
  targetName: string;
  route: "chrome" | "openrouter" | "mistral";
  /** In Cue-Reihenfolge; null = noch nicht übersetzt. */
  texts: (string | null)[];
  /** Zusammenhängend übersetzte Zeilen ab Anfang. */
  done: number;
  status: "running" | "done" | "partial" | "error";
  error?: string;
}

/** Nachrichten zwischen Content-Script/Options und Service Worker. */
export type BgRequest =
  | { type: "chat"; port: true }
  | { type: "listModels" }
  | { type: "listSttModels" }
  | { type: "testKey" }
  | { type: "hostStatus" };

export interface KeyStatus {
  ok: boolean;
  label?: string;
  usage?: number;
  limit?: number | null;
  limitRemaining?: number | null;
  isFreeTier?: boolean;
  error?: string;
}

/** Ergebnis eines Downloads: voller Pfad plus Ordner (mit ~) und Dateiname getrennt. */
export interface DownloadErgebnis {
  path: string;
  dir: string;
  name: string;
}

/** Eine im Video vorhandene Auflösung, wie der Helfer sie meldet. */
export interface VideoFormat {
  height: number;
  /** Geschätzte Gesamtgrösse aus Video- und Tonspur; null, wenn YouTube keine nennt. */
  bytes: number | null;
}
