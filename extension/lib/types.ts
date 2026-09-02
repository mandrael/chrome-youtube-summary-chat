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
  error?: boolean;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  /** USD, kommt direkt von OpenRouter. */
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
  | "parakeet-mlx";

/**
 * Wege des lokalen Helfers. "subtitles" holt die vorhandenen Untertitel per yt-dlp –
 * kostenlos und mit den Zeitstempeln von YouTube. "audio" laedt die Tonspur und
 * transkribiert sie ueber die eingestellte SttRoute.
 */
export type HelperJob = "subtitles" | "audio";

export type UiLang = "de" | "en";
export type AnswerLang = "auto" | "de" | "en";

export interface Settings {
  apiKey: string;
  model: string;
  customModel: string;
  reasoning: ReasoningEffort;
  systemPrompt: string;
  answerLang: AnswerLang;
  translationTarget: string;
  /** "auto" = Originalspur, sonst ein Sprachcode. */
  captionLang: string;
  uiLang: UiLang | "auto";
  showCost: boolean;
  sttRoute: SttRoute;
  /** Chrome-eigene Translator API statt OpenRouter fürs Übersetzen. */
  preferLocalTranslate: boolean;
  uiScale: number;
  /** Breite der rechten YouTube-Spalte in Pixeln; der Player weicht entsprechend. */
  columnWidth: number;
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
