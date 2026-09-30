import type { Cue, DownloadErgebnis, SttRoute, Transcript, VideoFormat } from "@shared/lib/types";

/**
 * Native-Messaging-Brücke zum lokalen Audio-Fallback.
 *
 * Diese Datei wird ausschliesslich aus einem `if (__FALLBACK__)`-Zweig importiert und
 * ist im Store-Build damit nicht erreichbar. Der Beweis dafür ist der grep-Test in
 * `scripts/verify-store-bundle.sh`, nicht dieser Kommentar.
 *
 * Warum der Host alles macht und nicht nur herunterlädt: Native Messaging begrenzt eine
 * Nachricht auf 1 MB. Base64-Audio sprengt das bei jedem Video, das länger als ein paar
 * Sekunden ist. Über den Kanal geht deshalb nur fertiger Text.
 */
export const HOST_NAME = "at.gasperl.youtube_summary_chat";

export interface FallbackProgress {
  stage: "start" | "download" | "convert" | "transcribe" | "done" | "error";
  message: string;
  percent?: number;
}

interface HostResponse {
  type: "progress" | "result" | "error";
  stage?: FallbackProgress["stage"];
  message?: string;
  percent?: number;
  /** Segmente mit Zeitstempeln, wenn die Route welche liefert. */
  segments?: Array<{ start?: number; end?: number; text?: string }>;
  /** Reiner Text, wenn nicht. */
  text?: string;
  route?: string;
}

/**
 * Fragt den Helfer, welche Auflösungen dieses Video hat.
 *
 * Nur im GitHub-Build erreichbar: Der Store-Build enthält diesen Code nicht, weil
 * Googles Programmrichtlinie das Herunterladen geschützter Inhalte untersagt
 * („Do not encourage, facilitate, or enable the unauthorized access, download, or
 * streaming of copyrighted content or media.").
 */
export async function videoFormate(videoId: string): Promise<VideoFormat[]> {
  // `type: "transcribe"` ist der Verteiler des Hosts; `kind` wählt darin den Zweig.
  let res: { type?: string; formats?: VideoFormat[]; message?: string } | undefined;
  try {
    res = await chrome.runtime.sendNativeMessage(HOST_NAME, { type: "transcribe", videoId, kind: "formats" });
  } catch (e) {
    // Fehlt der Host, verwirft die Promise-Form von sendNativeMessage mit Chromes
    // englischer Rohmeldung („Specified native messaging host not found.", gemessen
    // 05.09.2026) – dieselbe Aufbereitung wie beim Audio-Weg, sonst steht sie so im Dialog.
    throw new Error(hostFehler((e as Error)?.message));
  }
  if (!res) throw new Error(hostFehler(chrome.runtime.lastError?.message));
  if (res.type === "error") throw new Error(res.message || "Formate nicht lesbar");
  return res.formats ?? [];
}

export interface UpdateInfo {
  version: string;
  neuer: boolean;
  notes: string;
  seite: string;
  /** false im Entwicklerstand: dort liegt kein Release-Paket neben dem Helfer. */
  installierbar: boolean;
}

const UPDATE_STAND = "updateStand";
const UPDATE_ABSTAND_MS = 24 * 3600_000;
// Ohne Helfer oder ohne Netz nicht bei jedem Öffnen der Sidebar erneut fragen.
const UPDATE_FEHLER = "updateFehler";
const UPDATE_PAUSE_MS = 3600_000;

/**
 * Fragt über den Helfer das neueste GitHub-Release ab – höchstens einmal am Tag, mit
 * `jetzt` sofort. Die Erweiterung selbst spricht GitHub nie an (CLAUDE.md §5).
 */
export async function updatePruefen(jetzt = false): Promise<UpdateInfo> {
  const version = chrome.runtime.getManifest().version;
  const gemerkt = (await chrome.storage.local.get(UPDATE_STAND))[UPDATE_STAND] as
    | { zeit: number; von: string; info: UpdateInfo }
    | undefined;
  if (!jetzt && gemerkt && gemerkt.von === version && Date.now() - gemerkt.zeit < UPDATE_ABSTAND_MS) {
    return gemerkt.info;
  }
  const fehlschlag = (await chrome.storage.local.get(UPDATE_FEHLER))[UPDATE_FEHLER] as number | undefined;
  if (!jetzt && fehlschlag && Date.now() - fehlschlag < UPDATE_PAUSE_MS) {
    throw new Error("Update-Prüfung pausiert nach Fehlschlag");
  }
  let res: (UpdateInfo & { type?: string; message?: string }) | undefined;
  try {
    res = await chrome.runtime.sendNativeMessage(HOST_NAME, { type: "updateCheck", version });
  } catch (e) {
    await chrome.storage.local.set({ [UPDATE_FEHLER]: Date.now() });
    throw new Error(hostFehler((e as Error)?.message));
  }
  if (!res || res.type === "error") {
    await chrome.storage.local.set({ [UPDATE_FEHLER]: Date.now() });
    throw new Error(res?.message || "Update-Prüfung fehlgeschlagen");
  }
  const info: UpdateInfo = {
    version: res.version,
    neuer: res.neuer,
    notes: res.notes,
    seite: res.seite,
    installierbar: res.installierbar,
  };
  await chrome.storage.local.set({ [UPDATE_STAND]: { zeit: Date.now(), von: version, info } });
  return info;
}

/** Lädt das neueste Release über den Helfer und tauscht die Dateien. Liefert die Version. */
export async function updateInstallieren(): Promise<string> {
  let res: { type?: string; ok?: boolean; version?: string; message?: string } | undefined;
  try {
    res = await chrome.runtime.sendNativeMessage(HOST_NAME, {
      type: "updateInstall",
      version: chrome.runtime.getManifest().version,
    });
  } catch (e) {
    throw new Error(hostFehler((e as Error)?.message));
  }
  if (!res?.ok) throw new Error(res?.message || "Update fehlgeschlagen");
  await chrome.storage.local.remove(UPDATE_STAND);
  return res.version ?? "";
}

/** Systemeigener Ordnerdialog über den Helfer. null bei Abbruch. */
export async function ordnerWaehlen(): Promise<string | null> {
  let res: { type?: string; path?: string | null; message?: string } | undefined;
  try {
    res = await chrome.runtime.sendNativeMessage(HOST_NAME, { type: "chooseFolder" });
  } catch (e) {
    throw new Error(hostFehler((e as Error)?.message));
  }
  if (res?.type === "error") throw new Error(res.message || "Ordnerdialog fehlgeschlagen");
  return res?.path ?? null;
}

/** Zeigt die geladene Datei im Dateimanager (Finder, Explorer, xdg). */
export async function videoZeigen(videoId: string, path: string, target: string): Promise<void> {
  let res: { type?: string; message?: string } | undefined;
  try {
    res = await chrome.runtime.sendNativeMessage(HOST_NAME, { type: "transcribe", videoId, kind: "reveal", path, target });
  } catch (e) {
    throw new Error(hostFehler((e as Error)?.message));
  }
  if (res?.type === "error") throw new Error(res.message || "Ordner nicht geöffnet");
}

function hostFehler(err: string | undefined): string {
  if (!err) return "Native-Host hat die Verbindung ohne Ergebnis beendet.";
  return `Native-Host nicht erreichbar: ${err}${
    // Chrome sucht das Host-Manifest im Ordner des jeweiligen Profils.
    // Eine Instanz mit eigenem --user-data-dir sieht die Installation im
    // Standardprofil deshalb nicht (gemessen am 02.09.2026).
    /not found/i.test(err)
      ? "\nDer Helfer ist für dieses Chrome-Profil nicht installiert – " +
        "native-host/install-macos.sh ausführen (Windows: install-windows.ps1)."
      : ""
  }`;
}

/**
 * Lädt das Video. Liefert den Pfad der fertigen Datei; `cancel` trennt den Host-Port,
 * womit Chrome den Helfer samt yt-dlp beendet – sonst liefe der Download nach dem
 * Abbrechen in der Sidebar unsichtbar weiter.
 */
export function videoLaden(
  videoId: string,
  height: number,
  target: string,
  onProgress: (p: FallbackProgress) => void,
): { promise: Promise<DownloadErgebnis>; cancel: () => void } {
  const port = chrome.runtime.connectNative(HOST_NAME);
  const promise = new Promise<DownloadErgebnis>((auf, ab) => {
    port.onMessage.addListener((msg: HostResponse & Partial<DownloadErgebnis>) => {
      if (msg.type === "progress") {
        onProgress({
          stage: msg.stage ?? "download",
          message: msg.message ?? "",
          percent: msg.percent,
        });
        return;
      }
      if (msg.type === "error") {
        port.disconnect();
        ab(new Error(msg.message || "Download fehlgeschlagen"));
        return;
      }
      if ((msg as { type?: string }).type === "downloaded") {
        port.disconnect();
        auf({ path: msg.path ?? "", dir: msg.dir ?? "", name: msg.name ?? "" });
      }
    });
    port.onDisconnect.addListener(() => {
      const f = chrome.runtime.lastError?.message;
      if (f) ab(new Error(f));
    });
    port.postMessage({ type: "transcribe", videoId, kind: "download", height, target });
  });
  return { promise, cancel: () => port.disconnect() };
}

export interface FallbackRequest {
  videoId: string;
  /** "subtitles" ist der billige Weg und wird zuerst angeboten. */
  route: SttRoute | "subtitles";
  /** Nur für die beiden OpenRouter-Routen; der Host hält keinen eigenen Key. */
  apiKey?: string;
  language?: string;
}

/** Pingt den Host. Liefert die Version oder den Fehlertext für die Statusanzeige. */
export async function pingHost(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = (await chrome.runtime.sendNativeMessage(HOST_NAME, {
      type: "ping",
    })) as { version?: string; tools?: Record<string, boolean> };

    const missing = Object.entries(res.tools ?? {})
      .filter(([, present]) => !present)
      .map(([name]) => name);

    if (missing.length) {
      return { ok: false, detail: `Host läuft, aber es fehlen: ${missing.join(", ")}` };
    }
    return { ok: true, detail: `Host ${res.version ?? "?"} erreichbar` };
  } catch (e) {
    return { ok: false, detail: String((e as Error)?.message ?? e) };
  }
}

/**
 * Startet die Transkription. Läuft über einen Port statt über sendNativeMessage, weil
 * der Vorgang Minuten dauert und Zwischenstände melden soll.
 */
export function runFallback(
  req: FallbackRequest,
  onProgress: (p: FallbackProgress) => void,
): { promise: Promise<Transcript>; cancel: () => void } {
  const port = chrome.runtime.connectNative(HOST_NAME);
  let settled = false;

  const promise = new Promise<Transcript>((resolve, reject) => {
    port.onMessage.addListener((raw: unknown) => {
      const msg = raw as HostResponse;

      if (msg.type === "progress") {
        onProgress({
          stage: msg.stage ?? "transcribe",
          message: msg.message ?? "",
          percent: msg.percent,
        });
        return;
      }

      if (msg.type === "error") {
        settled = true;
        reject(new Error(msg.message ?? "Unbekannter Fehler im Native-Host"));
        port.disconnect();
        return;
      }

      if (msg.type === "result") {
        settled = true;
        resolve(toTranscript(msg));
        port.disconnect();
      }
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      reject(new Error(hostFehler(chrome.runtime.lastError?.message)));
    });

    port.postMessage({ type: "transcribe", ...req });
  });

  return { promise, cancel: () => port.disconnect() };
}

/**
 * Ein Parser für alle Routen: Segmente mit Zeitstempeln und reiner Plaintext werden
 * gleichermassen verkraftet. Fehlen Zeitstempel, sagt `hasTimestamps: false` das
 * ehrlich weiter – die UI bietet dann keine Sprungmarken an.
 */
export function toTranscript(msg: HostResponse): Transcript {
  const route = msg.route ?? "Audio-Fallback";

  const segs = msg.segments ?? [];
  const timed = segs.filter(
    (s) => typeof s.start === "number" && typeof s.text === "string" && s.text.trim(),
  );

  if (timed.length) {
    const cues: Cue[] = timed.map((s) => ({
      start: s.start as number,
      dur: typeof s.end === "number" ? Math.max(0, s.end - (s.start as number)) : 0,
      text: (s.text as string).trim(),
    }));
    return { cues, source: route, hasTimestamps: true };
  }

  const text = (msg.text ?? segs.map((s) => s.text ?? "").join(" ")).trim();
  if (!text) throw new Error("Der Native-Host hat kein Transkript geliefert.");

  return {
    cues: [{ start: 0, dur: 0, text }],
    source: route,
    hasTimestamps: false,
  };
}
