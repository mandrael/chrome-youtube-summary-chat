import type { CaptionTrack, Cue, Transcript } from "./types";

/**
 * Rückfall auf YouTubes eigenes Transkript-Panel.
 *
 * Warum es diesen Weg braucht: der direkte Abruf der `baseUrl` aus
 * `ytInitialPlayerResponse` liefert seit geraumer Zeit HTTP 200 mit leerem Body – am
 * 01.09.2026 gemessen für die Varianten roh, `fmt=json3`, `fmt=srv3` und
 * `fmt=json3&c=WEB`, mit und ohne gesetzten Consent. Die Spurliste kommt noch, der
 * Inhalt nicht mehr.
 *
 * Dieser Weg umgeht nichts: er klickt auf „Transkript anzeigen“ und liest, was YouTube
 * dem Nutzer daraufhin selbst anzeigt. Dafür hängt er an YouTubes DOM-Struktur – wenn
 * sich die ändert, ist das die Stelle, die bricht.
 */

const SEGMENT = "ytd-transcript-segment-renderer";
const LIST = "ytd-transcript-segment-list-renderer";
const FOOTER = "ytd-transcript-footer-renderer";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wartet, bis der Tab sichtbar ist.
 *
 * Real gemessen (01.09.2026): in einem Hintergrundtab lädt YouTube den Inhalt des
 * Transkript-Panels überhaupt nicht – zehn Anläufe über 141 Sekunden ergaben null
 * Segmente. Sobald der Tab sichtbar wird, sind sie nach einer halben Sekunde da.
 *
 * Betrifft den Alltag: ein per Mittelklick im Hintergrund geöffnetes Video würde sonst
 * mit „kein Transkript“ scheitern, obwohl es eines hat.
 */
function whenVisible(): Promise<void> {
  if (document.visibilityState === "visible") return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    document.addEventListener("visibilitychange", onChange);
  });
}

async function waitFor<T>(fn: () => T | null, timeoutMs: number, stepMs = 300): Promise<T | null> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > until) return null;
    await sleep(stepMs);
  }
}

function findButton(pattern: RegExp): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(
    'button, [role="button"], tp-yt-paper-button',
  );
  for (const n of nodes) {
    const label = `${n.getAttribute("aria-label") ?? ""} ${n.textContent ?? ""}`;
    if (pattern.test(label)) return n;
  }
  return null;
}

/**
 * Öffnet das Transkript-Panel und wartet auf seine Segmente.
 *
 * Der Klick allein reicht nicht: startet das Content-Script kurz nach `document_idle`,
 * expandiert das Panel zwar (`visibility=…EXPANDED`), lädt aber keinen Inhalt und
 * bleibt dauerhaft leer. Ein zweiter Klick auf „Transkript anzeigen“ hilft dann nicht,
 * weil das Panel aus YouTubes Sicht bereits offen ist.
 *
 * Was hilft, ist real gemessen (01.09.2026): Panel schliessen, neu öffnen – danach
 * sind die Segmente binnen einer halben Sekunde da. Deshalb bis zu drei Anläufe.
 *
 * Gibt bei Misserfolg den Grund zurück – die Sidebar zeigt ihn an, statt nur „ging
 * nicht“ zu melden.
 */
async function openPanel(): Promise<{ ok: true } | { ok: false; grund: string }> {
  if (document.querySelector(SEGMENT)) return { ok: true };

  // Ohne sichtbaren Tab bleibt das Panel dauerhaft leer – hier warten statt scheitern.
  await whenVisible();

  const expand = await waitFor(
    () =>
      document.querySelector<HTMLElement>(
        "#description tp-yt-paper-button#expand, tp-yt-paper-button#expand, #expand",
      ),
    6000,
  );
  expand?.click();

  const btn = await waitFor(() => findButton(/transkript anzeigen|show transcript/i), 8000);
  if (!btn) {
    return {
      ok: false,
      grund: "Dieses Video bietet kein Transkript an (kein Knopf „Transkript anzeigen“).",
    };
  }

  for (let versuch = 1; versuch <= 3; versuch++) {
    // Immer erst schliessen, auch beim ersten Anlauf. YouTube hat das Panel zu diesem
    // Zeitpunkt oft schon in einem halben Zustand: expandiert, aber ohne Inhalt. Ein
    // Klick auf „Transkript anzeigen“ bewirkt dann nichts mehr, weil es aus YouTubes
    // Sicht bereits offen ist. Nur ein geschlossenes Panel lädt beim Öffnen neu.
    closePanel();
    await sleep(1200);
    expand?.click();
    await sleep(500);

    (findButton(/transkript anzeigen|show transcript/i) ?? btn).click();
    if (await waitFor(() => document.querySelector(SEGMENT), versuch === 1 ? 8000 : 12_000)) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    grund: "Das Transkript-Panel blieb auch nach drei Anläufen leer.",
  };
}

export function closePanel(): void {
  findButton(/transkript schließen|transkript schliessen|close transcript/i)?.click();
}

/**
 * Nur die sichtbare Liste lesen. YouTube hält zwei identische Listen im DOM – eine
 * sichtbar, eine nicht. Über das ganze Dokument zu selektieren verdoppelt sonst still
 * das komplette Transkript.
 */
function visibleList(): Element | null {
  const lists = [...document.querySelectorAll(LIST)];
  return (
    lists.find((l) => (l as HTMLElement).offsetParent !== null) ?? lists[0] ?? null
  );
}

/** „18:29“ oder „1:02:03“ nach Sekunden. */
export function panelTimeToSeconds(raw: string): number | null {
  const parts = raw.trim().split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return null;
}

function readCues(): Cue[] {
  const list = visibleList();
  if (!list) return [];

  const cues: Cue[] = [];
  const seen = new Set<string>();

  for (const seg of list.querySelectorAll(SEGMENT)) {
    const stamp = seg.querySelector(".segment-timestamp")?.textContent?.trim();
    const text = seg.querySelector(".segment-text")?.textContent?.trim();
    if (!stamp || !text) continue;

    const start = panelTimeToSeconds(stamp);
    if (start === null) continue;

    // Zweite Absicherung gegen Doppelungen, falls YouTube die Listen anders staffelt.
    const key = `${start}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);

    cues.push({ start, dur: 0, text });
  }

  // Dauer aus dem Abstand zum nächsten Segment – das Panel gibt keine an.
  for (let i = 0; i < cues.length - 1; i++) {
    cues[i]!.dur = Math.max(0, cues[i + 1]!.start - cues[i]!.start);
  }
  return cues;
}

/** Die Sprachen, die das Panel im Fussmenü anbietet. */
function readLanguages(): { current: string; available: string[] } {
  const footer = document.querySelector(FOOTER);
  const current =
    footer?.querySelector("yt-dropdown-menu, tp-yt-paper-button, button")
      ?.textContent?.trim()
      .split("\n")[0]
      ?.trim() ?? "";

  const available = [...(footer?.querySelectorAll("tp-yt-paper-item") ?? [])]
    .map((e) => e.textContent?.trim() ?? "")
    .filter(Boolean);

  return { current, available };
}

/**
 * Stellt das Fussmenü auf die gewünschte Sprache um. Findet es die Sprache nicht,
 * bleibt es bei der Vorauswahl – das ist besser als ein Abbruch, und die Sidebar zeigt
 * ohnehin an, welche Spur geladen wurde.
 */
async function selectLanguage(label: string): Promise<boolean> {
  const footer = document.querySelector(FOOTER);
  if (!footer) return false;

  const items = [...footer.querySelectorAll<HTMLElement>("tp-yt-paper-item")];
  const hit = items.find((e) => e.textContent?.trim() === label);
  if (!hit) return false;

  const before = readCues().length;
  hit.click();
  // Auf den Austausch der Segmente warten: der erste Text ändert sich.
  await waitFor(() => (readCues().length !== before ? true : null), 8000);
  return true;
}

const LANG_LABELS: Record<string, string[]> = {
  de: ["Deutsch"],
  en: ["Englisch", "English"],
  fr: ["Französisch", "French"],
  es: ["Spanisch", "Spanish"],
  it: ["Italienisch", "Italian"],
  nl: ["Niederländisch", "Dutch"],
  pt: ["Portugiesisch", "Portuguese"],
};

/** Pseudo-URL: der bestehende Spur-Umschalter benutzt `url` als Schlüssel. */
const panelUrl = (label: string) => `panel:${label}`;

export interface PanelResult {
  transcript: Transcript;
  tracks: CaptionTrack[];
  active: CaptionTrack;
}

/** Fehlschlag mit Begründung – die Sidebar zeigt sie an. */
export class PanelError extends Error {}

export async function readTranscriptPanel(captionLang: string): Promise<PanelResult> {
  const opened = await openPanel();
  if (!opened.ok) {
    // Auch beim Fehlschlag aufräumen: sonst bleibt YouTubes Panel offen in der Spalte
    // stehen und behauptet „Keine Ergebnisse gefunden“, obwohl das unsere Sache war.
    closePanel();
    throw new PanelError(opened.grund);
  }

  const langs = readLanguages();

  // Gewünschte Sprache, sofern das Menü sie führt.
  if (captionLang !== "auto") {
    const wanted = LANG_LABELS[captionLang] ?? [captionLang];
    const label = langs.available.find((a) =>
      wanted.some((w) => a.toLowerCase().startsWith(w.toLowerCase())),
    );
    if (label && label !== langs.current) await selectLanguage(label);
  }

  const cues = readCues();
  if (!cues.length) {
    closePanel();
    throw new PanelError("Das Transkript-Panel war offen, enthielt aber keine Segmente.");
  }

  const current = readLanguages().current || "Transkript-Panel";
  const tracks: CaptionTrack[] = (
    langs.available.length ? langs.available : [current]
  ).map((name) => ({ lang: "", name, url: panelUrl(name), auto: /automatisch|auto-generated/i.test(name) }));

  const active =
    tracks.find((t) => t.name === current) ?? tracks[0] ?? {
      lang: "",
      name: current,
      url: panelUrl(current),
      auto: false,
    };

  // Das Panel gehört dem Nutzer, nicht der Extension – nach dem Lesen wieder zu.
  closePanel();

  return {
    transcript: {
      cues,
      source: `${current} (YouTube-Transkript)`,
      hasTimestamps: true,
    },
    tracks,
    active,
  };
}

/** Wechselt im Panel auf eine andere Spur. Nur für Spuren mit `panel:`-Pseudo-URL. */
export async function switchPanelTrack(
  track: CaptionTrack,
): Promise<{ transcript: Transcript; active: CaptionTrack }> {
  const opened = await openPanel();
  if (!opened.ok) {
    // Auch beim Fehlschlag aufräumen: sonst bleibt YouTubes Panel offen in der Spalte
    // stehen und behauptet „Keine Ergebnisse gefunden“, obwohl das unsere Sache war.
    closePanel();
    throw new PanelError(opened.grund);
  }
  await selectLanguage(track.name);

  const cues = readCues();
  closePanel();
  if (!cues.length) throw new PanelError("Für diese Spur kamen keine Segmente.");

  return {
    active: track,
    transcript: {
      cues,
      source: `${track.name} (YouTube-Transkript)`,
      hasTimestamps: true,
    },
  };
}

export const isPanelTrack = (t: CaptionTrack) => t.url.startsWith("panel:");
