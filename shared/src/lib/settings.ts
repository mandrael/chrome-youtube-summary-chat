import { DEFAULT_SYSTEM_PROMPT } from "./prompts";
import type { Conversation, Settings } from "./types";

/**
 * Vorgaben und Schlüsselnamen des Speichers – plattformneutral.
 *
 * Wie gespeichert wird, ist plattformabhängig und steht nicht hier: die Erweiterung
 * nimmt `wxt/utils/storage` (chrome.storage.local), die Android-App Dateien im
 * App-Verzeichnis. Was beide teilen, sind die Vorgabewerte, die Schlüsselnamen und die
 * Regeln darüber, was überhaupt gespeichert wird – sonst liest die App eine
 * Unterhaltung anders, als die Erweiterung sie geschrieben hat.
 */

// Beste Mischung aus Preis und Antwortqualität für lange Transkripte; siehe
// EMPFEHLUNG in openrouter.ts.
export const DEFAULT_MODEL = "openai/gpt-5.6-luna";

export const DEFAULT_SETTINGS: Settings = {
  provider: "openrouter",
  apiKey: "",
  model: DEFAULT_MODEL,
  mistralApiKey: "",
  // EU ist der Sinn der Option: Datenschutz. Wer den globalen Endpunkt will, schaltet um.
  mistralRegion: "eu",
  // Bewusst leer: Mistrals Doku führt keine Tabelle stabiler Aliase, die Liste kommt
  // per „Modelle laden" von /v1/models.
  mistralModel: "",
  reasoning: "minimal",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  answerLang: "auto",
  translationTarget: "Deutsch",
  captionLang: "auto",
  uiLang: "auto",
  showCost: false,
  showDislikes: true,
  // Aus: sonst gingen die IDs aller vorgeschlagenen Videos an Return YouTube Dislike.
  showThumbRatings: false,
  sttRoute: "parakeet-primeline",
  // 720p ist der Punkt, an dem YouTube auf getrennte Spuren umstellt und die Datei noch
  // handlich bleibt; darüber wächst sie schneller als der sichtbare Gewinn.
  downloadHeight: 720,
  downloadTarget: "",
  downloadAsk: false,
  preferLocalTranslate: false,
  uiScale: 110,
  // Knapp über YouTubes eigenem Wert (400 bis 490 px je nach Fenster): spürbar mehr
  // Platz als ohne Erweiterung, ohne dass das Video sichtbar schrumpft.
  columnWidth: 500,
  transcriptMode: "cues",
  dictionary: "",
};

/** Schlüssel ohne Bereichspräfix – die Plattform setzt ihr eigenes davor. */
export const CONV_PREFIX = "conv:";
export const TR_PREFIX = "tr:";

export const convKeyName = (videoId: string) => `${CONV_PREFIX}${videoId}`;
export const trKeyName = (videoId: string, lang: string, target: string) =>
  `${TR_PREFIX}${videoId}:${lang}:${target}`;

/**
 * Den unveränderten System-Prompt nicht mitschreiben: sonst friert die erste beliebige
 * Einstellungsänderung den damaligen Wortlaut ein, und jede spätere Verbesserung am
 * Default erreicht dieses Profil nie mehr. Gemessen an einem Testprofil, das noch eine
 * ältere Fassung trug.
 */
export function zumSpeichern(next: Settings): Settings {
  if (next.systemPrompt !== DEFAULT_SYSTEM_PROMPT) return next;
  const { systemPrompt: _weg, ...ohnePrompt } = next;
  return ohnePrompt as Settings;
}

/** Unterhaltungen, neueste zuerst; kaputte Einträge fallen raus. */
export function sortiereUnterhaltungen(werte: unknown[]): Conversation[] {
  return (werte as Conversation[])
    .filter((c) => c && Array.isArray(c.messages))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Was `clearCache` löscht: Unterhaltungen, Übersetzungen, UI-Zustand. Keys ohne Präfix. */
export function zwischenspeicherKeys(alle: string[]): string[] {
  return alle.filter(
    (k) =>
      k.startsWith(CONV_PREFIX) || k.startsWith(TR_PREFIX) || k === "collapsed" || k === "wide",
  );
}
