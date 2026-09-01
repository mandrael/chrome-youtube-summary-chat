import { storage } from "wxt/utils/storage";
import { DEFAULT_SYSTEM_PROMPT } from "./prompts";
import type { Conversation, Settings } from "./types";

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
  uiPlacement: "both",
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

/** Ob die Sidebar eingeklappt ist – bewusst getrennt von den Einstellungen. */
export const collapsedItem = storage.defineItem<boolean>("local:collapsed", {
  fallback: false,
});

const convKey = (videoId: string) => `local:conv:${videoId}` as const;

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
