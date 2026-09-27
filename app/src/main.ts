import { Preferences } from "@capacitor/preferences";
import { Directory, Filesystem, Encoding } from "@capacitor/filesystem";
import { AppLauncher } from "@capacitor/app-launcher";
import { CapacitorShareTarget, type ShareReceivedEvent } from "@capgo/capacitor-share-target";

import { fetchCaptionTracks, fetchCues, pickTrack, videoIdAusText } from "@shared/lib/transcript";
import { streamChat as streamOpenRouter } from "@shared/lib/openrouter";
import * as mistral from "@shared/lib/mistral";
import { DEFAULT_MODEL } from "@shared/lib/settings";

import { capacitorHttp } from "./http-capacitor";

/**
 * Spike: misst die Annahmen, auf denen die Android-App steht.
 *
 * Keine Oberflaeche, kein Router, keine Zustandsverwaltung – bewusst. Was hier zaehlt,
 * ist genau eines: laufen die vier Dinge auf einem echten Geraet, die in dieser
 * Umgebung nicht pruefbar waren (docs/messungen.md, Abschnitt Android):
 *
 *   A  der signierte visionOS-Player-Call aus einem Nicht-Browser-Client
 *   B  Streaming per fetch aus dem WebView, samt CORS bei beiden Gegenstellen
 *   C  der eingebettete Player mit Origin https://localhost (Fehler 153?)
 *   D  ein geteilter Link, kalt wie warm
 *   E  der Sprung in die YouTube-App mit Zeitmarke
 *   F  Dateispeicher statt Preferences fuer Unterhaltungen
 *
 * Schluessel bleiben auf dem Geraet (Preferences). Kein Backend, kein Proxy, keine
 * Telemetrie – Regel 5 gilt hier genauso.
 */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const logEl = $<HTMLPreElement>("log");

function log(zeile: string): void {
  const t = new Date().toLocaleTimeString("de-AT");
  logEl.textContent = `${logEl.textContent}\n[${t}] ${zeile}`;
  // Spiegelt nach logcat (Tag Capacitor/Console) – so laesst sich der Lauf per adb
  // mitlesen, ohne aufs Display zu starren.
  console.log(zeile);
  logEl.scrollTop = logEl.scrollHeight;
}

function fehler(wo: string, e: unknown): void {
  const m = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  log(`${wo} FEHLER – ${m}`);
}

// ---------------------------------------------------------------- Eingaben merken

const KEYS = { vid: "spike.vid", or: "spike.orKey", mi: "spike.miKey" };

async function ladeEingaben(): Promise<void> {
  const vid = (await Preferences.get({ key: KEYS.vid })).value ?? "aqz-KE-bpKQ";
  $<HTMLInputElement>("vid").value = vid;
  $<HTMLInputElement>("orKey").value = (await Preferences.get({ key: KEYS.or })).value ?? "";
  $<HTMLInputElement>("miKey").value = (await Preferences.get({ key: KEYS.mi })).value ?? "";
}

async function merkeEingaben(): Promise<void> {
  await Preferences.set({ key: KEYS.vid, value: $<HTMLInputElement>("vid").value.trim() });
  await Preferences.set({ key: KEYS.or, value: $<HTMLInputElement>("orKey").value.trim() });
  await Preferences.set({ key: KEYS.mi, value: $<HTMLInputElement>("miKey").value.trim() });
  log("Eingaben gemerkt (Preferences).");
}

const videoId = () => $<HTMLInputElement>("vid").value.trim();

// ---------------------------------------------------------------- A  Transkript

async function messungA(): Promise<void> {
  const id = videoId();
  log(`A Transkript – Video ${id}, Weg: CapacitorHttp (nativ, kein CORS)`);
  try {
    const t0 = performance.now();
    const tracks = await fetchCaptionTracks(id, capacitorHttp);
    log(`A  Spuren: ${tracks.length} (${Math.round(performance.now() - t0)} ms)`);
    if (!tracks.length) {
      log("A  keine Spur – das ist das Ergebnis, kein Ersatztext.");
      return;
    }
    const erste = tracks[0]!;
    log(`A  erste URL signiert: ${/signature=|sig=/.test(erste.url) ? "ja" : "NEIN"}, ` +
        `expire: ${/expire=/.test(erste.url) ? "ja" : "NEIN"}`);
    const spur = pickTrack(tracks, "auto");
    if (!spur) {
      log("A  pickTrack waehlt nichts aus.");
      return;
    }
    log(`A  gewaehlt: ${spur.name} (${spur.lang}${spur.auto ? ", automatisch" : ""})`);
    const cues = await fetchCues(spur, capacitorHttp);
    log(`A  Cues: ${cues.length}; erste: ${JSON.stringify(cues[0]?.text ?? "")}`);
  } catch (e) {
    fehler("A", e);
  }
}

// ---------------------------------------------------------------- B  Stream + CORS

async function messungB1(): Promise<void> {
  const apiKey = $<HTMLInputElement>("orKey").value.trim();
  if (!apiKey) return log("B1 – kein OpenRouter-Key eingetragen.");
  log("B1 OpenRouter – natives fetch aus dem WebView (Origin https://localhost)");
  try {
    const roh = await fetch("https://openrouter.ai/api/v1/models");
    log(`B1  /models: HTTP ${roh.status} – CORS erlaubt den Abruf also`);
  } catch (e) {
    fehler("B1 /models (typischer CORS-Befund)", e);
  }
  await streame("B1", (signal, onDelta) =>
    streamOpenRouter({
      apiKey,
      model: DEFAULT_MODEL,
      reasoning: "minimal",
      supportsReasoning: false,
      system: "Antworte knapp auf Deutsch.",
      messages: [{ role: "user", content: "Zaehle bis fuenf." }],
      signal,
      onDelta,
      onUsage: (u) => log(`B1  Usage: ${JSON.stringify(u)}`),
    }),
  );
}

async function messungB2(): Promise<void> {
  const apiKey = $<HTMLInputElement>("miKey").value.trim();
  if (!apiKey) return log("B2 – kein Mistral-Key eingetragen.");
  log("B2 Mistral (EU-Endpunkt) – natives fetch aus dem WebView");
  let model = "";
  try {
    const modelle = await mistral.listModels(apiKey, "eu");
    model = modelle[0]?.id ?? "";
    log(`B2  Modelle: ${modelle.length}, genommen: ${model || "keins"}`);
  } catch (e) {
    fehler("B2 /models (typischer CORS-Befund)", e);
    return;
  }
  if (!model) return;
  await streame("B2", (signal, onDelta) =>
    mistral.streamChat({
      apiKey,
      region: "eu",
      model,
      system: "Antworte knapp auf Deutsch.",
      messages: [{ role: "user", content: "Zaehle bis fuenf." }],
      signal,
      onDelta,
      onUsage: (u) => log(`B2  Usage: ${JSON.stringify(u)}`),
    }),
  );
}

/**
 * Zaehlt die Teilstuecke und die Zeit bis zum ersten. Weniger als drei Deltas heisst:
 * die Antwort kam am Stueck, der Strom ist unterwegs gepuffert worden.
 */
async function streame(
  wo: string,
  lauf: (signal: AbortSignal, onDelta: (t: string) => void) => Promise<void>,
): Promise<void> {
  const ctrl = new AbortController();
  const t0 = performance.now();
  let deltas = 0;
  let erstes = 0;
  let text = "";
  try {
    await lauf(ctrl.signal, (d) => {
      if (!deltas) erstes = performance.now() - t0;
      deltas += 1;
      text += d;
    });
    log(`${wo}  Deltas: ${deltas}, erstes nach ${Math.round(erstes)} ms, ` +
        `gesamt ${Math.round(performance.now() - t0)} ms`);
    log(`${wo}  ${deltas >= 3 ? "streamt" : "GEPUFFERT (kein echtes Streaming)"}`);
    log(`${wo}  Antwort: ${JSON.stringify(text.slice(0, 120))}`);
  } catch (e) {
    fehler(wo, e);
  }
}

// ---------------------------------------------------------------- C  Player

interface YtPlayer {
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getAvailablePlaybackRates: () => number[];
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, o: unknown) => YtPlayer;
      loaded?: number;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let player: YtPlayer | null = null;

async function messungC(): Promise<void> {
  const id = videoId();
  log(`C Player – iframe, enablejsapi=1, origin=${location.origin}`);
  try {
    await ladeYtApi();
    log("C  iframe_api geladen");
    player = new window.YT!.Player("player", {
      videoId: id,
      playerVars: { enablejsapi: 1, playsinline: 1, origin: location.origin },
      events: {
        onReady: () => {
          log("C  onReady – der Player nimmt diesen Origin als Embedder an");
          const r = player?.getAvailablePlaybackRates?.() ?? [];
          log(`C  Abspieltempi: ${JSON.stringify(r)} (max ${Math.max(...r, 0)})`);
        },
        onError: (e: { data: number }) =>
          log(`C  onError ${e.data}` +
              (e.data === 153 ? " – fehlender Referer" : "") +
              (e.data === 101 || e.data === 150 ? " – Einbetten vom Kanal gesperrt" : "")),
        onStateChange: (e: { data: number }) => log(`C  Zustand ${e.data}`),
      },
    });
  } catch (e) {
    fehler("C", e);
  }
}

// Ein Ladeversuch für alle Aufrufer: ein zweiter Klick überschrieb sonst
// onYouTubeIframeAPIReady, und das Promise des ersten kehrte nie zurück (Kimi, 21.09.2026).
let ytLaden: Promise<void> | undefined;
function ladeYtApi(): Promise<void> {
  if (window.YT?.loaded) return Promise.resolve();
  return (ytLaden ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => reject(new Error("iframe_api liess sich nicht laden"));
    window.onYouTubeIframeAPIReady = () => resolve();
    document.head.appendChild(s);
  }).catch((e: unknown) => {
    // Ein Fehlschlag darf nicht hängen bleiben: der nächste Klick versucht es neu.
    ytLaden = undefined;
    throw e;
  }));
}

function messungCSeek(): void {
  if (!player) return log("C – erst den Player starten.");
  const jetzt = player.getCurrentTime();
  player.seekTo(jetzt + 30, true);
  log(`C  seekTo(${Math.round(jetzt + 30)}) – Position vorher ${Math.round(jetzt)} s`);
  // Waehrend eines Werbeeinschubs meldet die IFrame-API keinen eigenen Zustand. Ob
  // getCurrentTime dann die Werbezeit liefert, ist genau hier abzulesen.
  setTimeout(() => log(`C  Position nach 1 s: ${Math.round(player!.getCurrentTime())} s`), 1000);
}

// ---------------------------------------------------------------- E  Deep-Link

async function messungE(): Promise<void> {
  const url = `https://www.youtube.com/watch?v=${videoId()}&t=90s`;
  log(`E oeffne ${url}`);
  try {
    const r = await AppLauncher.openUrl({ url });
    log(`E  geoeffnet: ${r.completed} – laeuft das Video bei 1:30?`);
  } catch (e) {
    fehler("E", e);
  }
}

// ---------------------------------------------------------------- F  Speicher

async function messungF(): Promise<void> {
  log("F Speicher – Datei je Unterhaltung statt Preferences");
  try {
    const inhalt = JSON.stringify({ videoId: videoId(), fuell: "x".repeat(100_000) });
    const t0 = performance.now();
    await Filesystem.mkdir({ path: "conv", directory: Directory.Data, recursive: true }).catch(
      () => undefined,
    );
    await Filesystem.writeFile({
      path: `conv/${videoId()}.json`,
      data: inhalt,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    log(`F  ${Math.round(inhalt.length / 1024)} kB geschrieben in ${Math.round(performance.now() - t0)} ms`);
    const dir = await Filesystem.readdir({ path: "conv", directory: Directory.Data });
    for (const f of dir.files) log(`F  ${f.name}: ${f.size} B, mtime ${f.mtime}`);
  } catch (e) {
    fehler("F", e);
  }
}

// ---------------------------------------------------------------- D  Teilen-Ziel

// Der Typ kommt vom Plugin, nicht geraten: es sendet { title, texts, files }. Ein
// `unknown`-Cast auf erfundene Felder (text/subject/url) hatte hier jede geteilte
// Video-ID verschluckt, ohne dass der Compiler es sehen konnte (DeepSeek, 21.09.2026).
void CapacitorShareTarget.addListener("shareReceived", (e: ShareReceivedEvent) => {
  const roh = [e.title, ...(e.texts ?? [])].filter(Boolean).join(" ");
  log(`D geteilt: ${JSON.stringify(roh).slice(0, 200)}`);
  const id = videoIdAusText(roh);
  log(`D  erkannte Video-ID: ${id ?? "KEINE"}`);
  if (id) $<HTMLInputElement>("vid").value = id;
}).catch((e: unknown) => fehler("D Listener", e));

// ---------------------------------------------------------------- Verdrahtung

$("save").addEventListener("click", () => void merkeEingaben());
$("a").addEventListener("click", () => void messungA());
$("b1").addEventListener("click", () => void messungB1());
$("b2").addEventListener("click", () => void messungB2());
$("c").addEventListener("click", () => void messungC());
$("cSeek").addEventListener("click", () => messungCSeek());
$("e").addEventListener("click", () => void messungE());
$("f").addEventListener("click", () => void messungF());
$("clear").addEventListener("click", () => (logEl.textContent = "bereit."));

void ladeEingaben();
log(`Origin: ${location.origin} – das ist der Embedder, den YouTube sieht.`);
