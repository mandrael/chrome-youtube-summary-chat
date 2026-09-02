import { storage } from "wxt/utils/storage";
import { DEFAULT_SYSTEM_PROMPT } from "./prompts";
import type { Conversation, Settings, TranscriptTranslation } from "./types";

export const DEFAULT_MODEL = "google/gemini-3.5-flash-lite";

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: DEFAULT_MODEL,
  customModel: "",
  reasoning: "minimal",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  answerLang: "auto",
  translationTarget: "Deutsch",
  captionLang: "auto",
  uiLang: "auto",
  showCost: false,
  sttRoute: "parakeet-mlx",
  preferLocalTranslate: false,
  uiScale: 110,
  // Knapp über YouTubes eigenem Wert (400 bis 490 px je nach Fenster): spürbar mehr
  // Platz als ohne Erweiterung, ohne dass das Video sichtbar schrumpft.
  columnWidth: 500,
  transcriptMode: "cues",
};

/**
 * Alle Einstellungen in einem Eintrag. Ein Objekt statt zwanzig Schlüsseln, weil die
 * Options-Page sie ohnehin immer zusammen liest und schreibt.
 */
export const settingsItem = storage.defineItem<Settings>("local:settings", {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});

export async function getSettings(): Promise<Settings> {
  // Fehlende Felder mit Defaults auffüllen, damit ein alter gespeicherter Stand nach
  // einem Update keine undefined-Werte in die UI trägt.
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await settingsItem.setValue(next);
  return next;
}

/**
 * Ob die Sidebar eingeklappt ist – bewusst getrennt von den Einstellungen.
 * Eingeklappt ist der Normalzustand: die Seite sieht aus wie YouTube, bis jemand die
 * Sidebar holt.
 */
export const collapsedItem = storage.defineItem<boolean>("local:collapsed", {
  fallback: true,
});

/**
 * Ob die Spalte für die Sidebar verbreitert wird.
 *
 * Getrennt vom Auf- und Zuklappen, weil beide Wege verschiedene Absichten haben: das
 * Symbol in der Werkzeugleiste holt die Sidebar in YouTubes eigener Spaltenbreite, das
 * Aufklappen in der Seite und der Ziehgriff verbreitern sie.
 */
export const wideItem = storage.defineItem<boolean>("local:wide", {
  fallback: false,
});

const convKey = (videoId: string) => `local:conv:${videoId}` as const;

/**
 * Übersetzungen des Transkripts, je Video, Spursprache und Zielsprache. Rund 22 kB je
 * Eintrag – das ist der Preis dafür, dass ein zweiter Blick nicht wieder drei Minuten
 * und, auf der Cloud-Route, wieder Geld kostet.
 */
const trKey = (videoId: string, lang: string, target: string) =>
  `local:tr:${videoId}:${lang}:${target}` as const;

export async function loadTranslation(
  videoId: string,
  lang: string,
  target: string,
): Promise<TranscriptTranslation | null> {
  return storage.getItem<TranscriptTranslation>(trKey(videoId, lang, target));
}

export async function saveTranslation(
  videoId: string,
  lang: string,
  tr: TranscriptTranslation,
): Promise<void> {
  await storage.setItem(trKey(videoId, lang, tr.target), tr);
}

export async function loadConversation(videoId: string): Promise<Conversation | null> {
  return storage.getItem<Conversation>(convKey(videoId));
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await storage.setItem(convKey(conv.videoId), conv);
}

export async function deleteConversation(videoId: string): Promise<void> {
  await storage.removeItem(convKey(videoId));
}

/** Alle gespeicherten Unterhaltungen, neueste zuerst. */
export async function listConversations(): Promise<Conversation[]> {
  const all = await storage.snapshot("local");
  return Object.entries(all)
    .filter(([k]) => k.startsWith("conv:"))
    .map(([, v]) => v as Conversation)
    .filter((c) => c && Array.isArray(c.messages))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}


/**
 * Löscht alles, was die Extension zwischenspeichert – gespeicherte Unterhaltungen und
 * den eingeklappt-Zustand. Einstellungen und API-Key bleiben.
 */
export async function clearCache(): Promise<number> {
  const all = await storage.snapshot("local");
  const keys = Object.keys(all).filter(
    (k) =>
      k.startsWith("conv:") || k.startsWith("tr:") || k === "collapsed" || k === "wide",
  );
  await Promise.all(keys.map((k) => storage.removeItem(`local:${k}` as `local:${string}`)));
  return keys.length;
}
