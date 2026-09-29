import { CapacitorHttp } from "@capacitor/core";
import type { Http } from "@shared/lib/transcript";

/**
 * Der native HTTP-Weg – ausschliesslich fuer die YouTube-Abrufe.
 *
 * Zwei Dinge sind hier wichtig und beide sind der Grund, warum das eine eigene Datei
 * ist und kein globaler Schalter:
 *
 * 1. `CapacitorHttp` geht am WebView vorbei, also gibt es kein CORS und die Header
 *    (X-Goog-Visitor-Id, X-Youtube-Client-Name) kommen durch.
 * 2. `CapacitorHttp` liest die Antwort **am Stueck** – Streaming gibt es nicht. Deshalb
 *    darf `plugins.CapacitorHttp.enabled` niemals gesetzt werden: der globale
 *    fetch-Patch wuerde den Chat-Stream still zu einer Antwort nach 30 Sekunden machen.
 *    Der Chat laeuft ueber das native `fetch` des WebViews.
 */
export const capacitorHttp: Http = async (url, init) => {
  const res = await CapacitorHttp.request({
    url,
    method: init?.method ?? "GET",
    headers: init?.headers,
    data: init?.body,
    // Ohne das parst Capacitor JSON selbst und `text` waere "[object Object]".
    responseType: "text",
  });
  const text = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
  return { status: res.status, ok: res.status >= 200 && res.status < 300, text };
};
