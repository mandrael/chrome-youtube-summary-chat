/**
 * Extension-Seite des Transkript-Abrufs.
 *
 * Der gemessene Weg (signierte Untertitel-URL aus der visionOS-Player-Antwort) liegt in
 * `@shared/lib/transcript` und ist plattformneutral. Hier bleibt nur, was ohne YouTubes
 * DOM nicht geht: der Rückfall auf YouTubes eigenes Transkript-Panel. Deshalb reicht die
 * Datei den geteilten Kern weiter, statt ihn zu ersetzen – die Aufrufer in der Sidebar
 * importieren unverändert `@/lib/transcript`.
 */
import {
  fetchCaptionTracks,
  loadTrack,
  NoCaptionsError,
  pickTrack,
  type LoadResult,
} from "@shared/lib/transcript";

export * from "@shared/lib/transcript";

/**
 * Zuerst der direkte Abruf, dann YouTubes eigenes Transkript-Panel.
 *
 * Der direkte Weg steht bewusst vorne, obwohl er am 01.09.2026 leer zurückkam: er ist
 * unabhängig von YouTubes DOM und würde sofort wieder greifen. Der Panel-Weg ist der
 * Rückfall, der heute tatsächlich trägt.
 */
export async function loadTranscript(
  videoId: string,
  captionLang: string,
): Promise<LoadResult> {
  let direkt: Error | null = null;
  let keineSpuren = false;
  try {
    const tracks = await fetchCaptionTracks(videoId);
    const track = pickTrack(tracks, captionLang);
    if (track) return { ...(await loadTrack(track)), tracks };
    keineSpuren = tracks.length === 0;
    direkt = new NoCaptionsError();
  } catch (e) {
    direkt = e as Error;
  }

  // Meldet der Player gar keine Spur, kann auch YouTubes eigenes Panel keine anzeigen:
  // der zweite Weg würde nur seine 8 + 12 Sekunden verwarten, bevor die UI dasselbe
  // sagt. Gemessen am 02.09.2026 – über 20 Sekunden „wird geladen“, bevor „keine
  // Untertitel“ erschien.
  if (keineSpuren) throw new NoCaptionsError();

  const { readTranscriptPanel } = await import("./transcript-panel");
  try {
    return await readTranscriptPanel(captionLang);
  } catch (panelFehler) {
    // Beide Wege leer. Kein Platzhalter, kein Ersatztext – aber auch keine Meldung,
    // die verschweigt, woran es lag.
    if (direkt instanceof NoCaptionsError) throw new NoCaptionsError();
    throw new Error(
      `Transkript nicht verfügbar.\n` +
        `Direkter Abruf: ${direkt?.message ?? "kein Ergebnis"}\n` +
        `YouTube-Panel: ${(panelFehler as Error)?.message ?? panelFehler}`,
    );
  }
}
