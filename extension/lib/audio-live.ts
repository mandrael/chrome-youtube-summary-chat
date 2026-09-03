import type { Cue, Transcript } from "./types";

/**
 * Transkript aus dem laufenden Ton, ohne Download.
 *
 * Der Weg für Videos ohne Untertitel, der auch im Store-Build erlaubt ist: das Video
 * wird stumm und beschleunigt abgespielt, der Ton per `video.captureStream()` im
 * Arbeitsspeicher mitgelesen, in Stücken an OpenRouter geschickt und danach verworfen.
 * Es entsteht keine Datei; heruntergeladen wird nichts.
 *
 * Warum `captureStream()` und nicht `chrome.tabCapture`: tabCapture verlangt eine
 * Extension-Invocation (Klick auf das Symbol in der Werkzeugleiste, Tastenkürzel,
 * Kontextmenü) – ein Knopf in der eingebetteten Seitenleiste zählt nicht. Ausserdem
 * bräuchte es eine zusätzliche Permission.
 *
 * Warum nicht `createMediaElementSource`: das kapert die Tonausgabe des Elements
 * dauerhaft, geht nur einmal je Element und wirft `InvalidStateError`, wenn YouTube
 * (Stable Volume) oder eine andere Erweiterung den Knoten schon hält. `captureStream()`
 * ist eine reine Kopie am Renderer.
 *
 * Der Zeitgewinn kommt aus `preservesPitch = false`: die Wiedergabe bei vierfachem
 * Tempo ist dann eine reine Zeitkompression samt Frequenzverschiebung, kein
 * Tonhöhen-Algorithmus. Rückgerechnet wird sie, indem die WAV-Datei mit einem Viertel
 * der Aufnahmerate deklariert wird – 48.000 aufgenommene Abtastwerte je Sekunde sind bei
 * Faktor 4 ein 12-kHz-Signal in Videozeit. Kein Resampling, keine Signalverarbeitung.
 *
 * Faktor 4 ist gemessen die Grenze: das Nutzband sinkt auf 6 kHz, was die Erkennung
 * kaum trifft. Bei Faktor 8 bleiben 3 kHz (Telefonqualität), und die Wortfehlerrate
 * sprang im Test von 3,2 auf 33,0 Prozent, weil das Modell in die falsche Sprache kippt.
 * Siehe docs/messungen.md.
 */

declare global {
  interface HTMLMediaElement {
    /** In Chrome seit Jahren vorhanden, in TypeScripts DOM-Typen noch nicht. */
    captureStream(): MediaStream;
  }
}

/*
 * Achtfach, nicht vierfach – gemessen am 03.09.2026 an demselben Ausschnitt (120 s
 * deutsche Sprache, `language: "de"` vorgegeben, whisper-large-v3-turbo):
 *
 *   4x → 11.025 Hz   sehr gut
 *   6x →  7.346 Hz   sehr gut
 *   8x →  5.506 Hz   sehr gut, sogar ein Satz mehr als bei 4x
 *  12x →  3.673 Hz   erste Fehler („Niedigkeit", „nichts bei dem Unternehmen")
 *  16x →  2.760 Hz   unbrauchbar („Ich heiße mich ja Ila")
 *
 * Der Player selbst schafft alle Stufen bis 16x (eingestellt 16, erreicht 15,89). Die
 * Grenze ist die Abtastrate, die durch die Zeitkompression entsteht: unter etwa 5 kHz
 * fehlen die Konsonanten. 8x halbiert die Wartezeit gegenüber 4x und lässt bis 12x noch
 * Luft, falls sich das Modell ändert.
 */
const TEMPO = 8;

/** Videosekunden je Stück. Bei 5,5 kHz mono sind das rund 1,3 MB je Anfrage. */
const STUECK_SEKUNDEN = 120;

/** Nach so vielen Sekunden reiner Stille wird abgebrochen – DRM-Ton kommt als Stille an. */
const STILLE_GRENZE = 15;

const URL_STT = "https://openrouter.ai/api/v1/audio/transcriptions";
const REFERER = "https://github.com/mandrael/chrome-youtube-summary-chat";
const TITLE = "YouTube Summary Chat";

export interface LiveFortschritt {
  /** Wie weit im Video die Erkennung steht, in Sekunden. */
  position: number;
  /** Gesamtlänge des Videos in Sekunden, 0 wenn unbekannt. */
  dauer: number;
  /** "werbung" heisst: es wird gewartet, noch nichts aufgenommen. */
  phase: "werbung" | "aufnahme";
}

interface Segment {
  start?: number;
  end?: number;
  text?: string;
}

/** WAV-Kopf plus int16-Nutzdaten. Mono, weil jede STT-Route ohnehin mono verarbeitet. */
export function baueWav(samples: Float32Array, rate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const schreibe = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  schreibe(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  schreibe(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // Länge des fmt-Blocks
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // ein Kanal
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // Bytes je Sekunde
  view.setUint16(32, 2, true); // Bytes je Rahmen
  view.setUint16(34, 16, true); // Bits je Abtastwert
  schreibe(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return bytes;
}

function zuBase64(bytes: Uint8Array): string {
  // In Blöcken, weil String.fromCharCode mit einigen Millionen Argumenten den Stack sprengt.
  let s = "";
  const block = 0x8000;
  for (let i = 0; i < bytes.length; i += block) {
    s += String.fromCharCode(...bytes.subarray(i, i + block));
  }
  return btoa(s);
}

async function erkenne(
  wav: Uint8Array,
  model: string,
  apiKey: string,
  sprache: string | undefined,
  zeitstempel: boolean,
  signal: AbortSignal,
): Promise<{ segments: Segment[]; text: string; sprache?: string }> {
  const body: Record<string, unknown> = {
    model,
    input_audio: { data: zuBase64(wav), format: "wav" },
  };
  if (sprache) body.language = sprache;
  if (zeitstempel) {
    body.response_format = "verbose_json";
    body.timestamp_granularities = ["segment"];
  }

  const res = await fetch(URL_STT, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": REFERER,
      "X-Title": TITLE,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Spracherkennung fehlgeschlagen: HTTP ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    segments?: Segment[];
    text?: string;
    language?: string;
  };
  // `language` steht nur in verbose_json und ist die einzige Rückmeldung darüber, was
  // das Modell zu hören glaubte. Sie wandert in `Transcript.lang` und damit in die
  // Übersetzung – ohne sie hielte die Oberfläche jedes erkannte Transkript für
  // sprachlos.
  return { segments: data.segments ?? [], text: data.text ?? "", sprache: data.language };
}

export function starteLiveTranskription(opts: {
  apiKey: string;
  model: string;
  /** Sprachcode für das Erkennungsmodell, etwa "de". Leer = das Modell entscheidet. */
  sprache?: string;
  /** true, wenn das Modell verbose_json beherrscht – sonst gibt es nur Fliesstext. */
  zeitstempel: boolean;
  onProgress: (p: LiveFortschritt) => void;
}): { promise: Promise<Transcript>; cancel: () => void } {
  const abbruch = new AbortController();

  const promise = (async (): Promise<Transcript> => {
    const video = document.querySelector<HTMLVideoElement>("video.html5-main-video, video");
    if (!video) throw new Error("Kein Video auf dieser Seite gefunden.");

    // Der Zustand des Players gehört dem Nutzer; er wird am Ende in jedem Fall
    // wiederhergestellt, auch bei Abbruch oder Fehler.
    const vorher = {
      zeit: video.currentTime,
      rate: video.playbackRate,
      stumm: video.muted,
      pausiert: video.paused,
      pitch: video.preservesPitch,
    };

    /*
     * Werbung läuft im selben `<video>`-Element wie der Beitrag. Solange sie läuft,
     * gehört dem Element ihre Länge und ihr Ton – gemessen am 02.09.2026: `duration`
     * meldete 79 s Werbung statt 46 min Video, und die Erkennung hielt sich für
     * fertig, bevor der Beitrag begonnen hatte. Deshalb wird vor dem Start abgewartet
     * und während der Aufnahme nichts von der Werbung übernommen.
     */
    const werbungLaeuft = () => !!document.querySelector(".ad-showing");

    video.muted = true;
    /*
     * `play()` bricht mit AbortError ab, wenn YouTube im selben Moment eine neue Quelle
     * lädt – gemessen am 02.09.2026: „The play() request was interrupted by a new load
     * request." Das ist kein Fehlschlag, sondern ein Rennen; entscheidend ist allein, ob
     * danach gespielt wird. Deshalb mehrere Versuche und ein Urteil am Ende.
     */
    for (let i = 0; i < 10 && video.paused; i++) {
      try {
        await video.play();
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (video.paused) throw new Error("Das Video liess sich nicht abspielen.");

    if (werbungLaeuft()) {
      // Zehn Minuten. Gemessen am 02.09.2026 in einem frischen Profil ohne Anmeldung:
      // erst ein Block von 111 Sekunden, beim zweiten Anlauf einer von 305 Sekunden.
      // Zwei und fünf Minuten waren beide zu knapp. Die Grenze ist nur ein Notausgang –
      // sichtbar ist die ganze Zeit der Wartetext samt Abbrechen-Knopf.
      const grenze = performance.now() + 600_000;
      while (werbungLaeuft()) {
        opts.onProgress({ position: 0, dauer: video.duration || 0, phase: "werbung" });
        if (abbruch.signal.aborted) throw new Error("Abgebrochen.");
        if (performance.now() > grenze) {
          throw new Error(
            "Vor dem Video läuft seit zehn Minuten Werbung – die Spracherkennung " +
              "kann erst danach beginnen.",
          );
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (!Number.isFinite(video.duration) || video.duration === 0) {
      throw new Error(
        "Dieses Video hat keine feste Länge (Live-Übertragung) – die Spracherkennung " +
          "braucht ein Ende.",
      );
    }

    const ctx = new AudioContext();
    const stream = video.captureStream();
    // Die Videospur sofort stoppen, sonst kopiert Chrome jedes Bild mit.
    for (const spur of stream.getVideoTracks()) spur.stop();

    /*
     * Der Strom kann leer beginnen: gemessen am 02.09.2026 warf
     * `createMediaStreamSource` ein „MediaStream has no audio track", weil YouTube die
     * Tonspur erst kurz nach dem Start des Elements anhängt. Zehn Sekunden Geduld statt
     * einer Fehlermeldung, die nur ein Rennen beschreibt.
     */
    for (let i = 0; i < 40 && !stream.getAudioTracks().length; i++) {
      if (abbruch.signal.aborted) throw new Error("Abgebrochen.");
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!stream.getAudioTracks().length) {
      throw new Error("Dieses Video liefert keine Tonspur, die sich mitlesen lässt.");
    }

    /*
     * `createMediaStreamSource` wählt seine Spur einmal beim Erzeugen aus. Tauscht
     * YouTube die Tonspur (Qualitätswechsel, Werbung, Sprachwahl), endet die alte, und
     * ab da käme Stille an, ohne dass irgendetwas fehlschlüge. Der Stille-Wächter unten
     * würde das nach 15 Sekunden bemerken – diese Meldung sagt sofort, woran es lag.
     */
    for (const spur of stream.getAudioTracks()) {
      spur.addEventListener("ended", () => {
        if (!fertig) fehler = new Error("Die Tonspur des Videos wurde mitten im Lauf gewechselt.");
      });
    }

    const quelle = ctx.createMediaStreamSource(stream);
    // ponytail: ScriptProcessorNode ist als veraltet markiert, läuft aber überall ohne
    // eigene Worklet-Datei (die im Content-Script an der Seiten-CSP scheitern kann).
    // Bei einem Kanal und 4096er-Puffer ist die Last im Hauptthread vernachlässigbar.
    // Umbau auf AudioWorklet erst, wenn Chrome den Knoten wirklich entfernt.
    const knoten = ctx.createScriptProcessor(4096, 1, 1);

    let puffer: Float32Array[] = [];
    let pufferLaenge = 0;
    let stueckStart = 0; // Videozeit, an der das aktuelle Stück beginnt
    let stilleSeit: number | null = null;
    let werbungZuletzt = false;
    let fehler: Error | null = null;
    let fertig = false;

    const segmente: Segment[] = [];
    const texte: string[] = [];
    let sprache: string | undefined;
    // Uploads laufen der Aufnahme hinterher, aber nacheinander: zwei parallele
    // Anfragen bringen nichts, weil die Aufnahme ohnehin die langsamere Seite ist.
    let kette: Promise<void> = Promise.resolve();

    // Erwartete Zahl der Abtastwerte je Stück. Nur ein Richtwert für den Schnitt – die
    // Rate, mit der das Stück deklariert wird, entsteht weiter unten aus der wirklich
    // vergangenen Videozeit.
    const samplesJeStueck = (STUECK_SEKUNDEN * ctx.sampleRate) / TEMPO;

    // Gedrosselt: der Audio-Rückruf feuert etwa zwölfmal je Sekunde, die Anzeige
    // braucht das nicht.
    let zuletztGemeldet = 0;
    function melde() {
      const s = Math.floor(video!.currentTime);
      if (s === zuletztGemeldet) return;
      zuletztGemeldet = s;
      opts.onProgress({
        position: video!.currentTime,
        dauer: video!.duration || 0,
        phase: "aufnahme",
      });
    }

    function schneide(bisEnde: boolean) {
      if (!pufferLaenge) return;
      if (!bisEnde && pufferLaenge < samplesJeStueck) return;

      const daten = new Float32Array(pufferLaenge);
      let pos = 0;
      for (const teil of puffer) {
        daten.set(teil, pos);
        pos += teil.length;
      }
      const offset = stueckStart;
      const spanne = video!.currentTime - offset;
      puffer = [];
      pufferLaenge = 0;
      stueckStart = video!.currentTime;

      /*
       * Die Abtastrate wird nicht gerechnet, sondern gemessen: so viele Abtastwerte für
       * so viel Videozeit. Die Rechnung „Aufnahmerate durch vier" stimmt nur, solange
       * wirklich lückenlos mit vierfachem Tempo gespielt wird – bei einem Nachladestocker
       * zählt der Audiograph Stille weiter, während `currentTime` steht, und bei einem
       * Rate-Reset auf 1x steckt in einem „120-Sekunden-Stück" nur eine Videohalbminute.
       * Beides würde jedes folgende Wort zeitlich verschieben. Die gemessene Rate
       * korrigiert das von selbst.
       */
      const gemessen = spanne > 1 ? daten.length / spanne : ctx.sampleRate / TEMPO;
      // Ein Wert ausserhalb dieses Bereichs wäre kein Messwert mehr, sondern ein Fehler
      // (Videosprung des Nutzers, negative Spanne). Dann gilt der Nennwert.
      const plausibel = gemessen > ctx.sampleRate / 16 && gemessen < ctx.sampleRate;
      const wav = baueWav(daten, Math.round(plausibel ? gemessen : ctx.sampleRate / TEMPO));
      kette = kette.then(async () => {
        if (abbruch.signal.aborted || fehler) return;
        try {
          /*
           * Ab dem zweiten Stück gilt die Sprache, die das erste ergeben hat. Ohne
           * Vorgabe rät das Modell je Stück neu, und bei beschleunigtem Ton rät es
           * falsch: am 03.09.2026 hielt es einen deutschen Ausschnitt für Englisch und
           * gab ihn halb übersetzt zurück („With my body work I'm going to the
           * stress-on-the-send“). Mit Vorgabe war derselbe Ton fehlerfrei.
           */
          const { segments, text, sprache: antwortSprache } = await erkenne(
            wav,
            opts.model,
            opts.apiKey,
            opts.sprache || sprache,
            opts.zeitstempel,
            abbruch.signal,
          );
          const mitZeit = segments.filter((s) => typeof s.start === "number");
          /*
           * Whisper läuft am Ende eines Stücks über die tatsächliche Länge hinaus –
           * gemessen am 02.09.2026: letztes Segmentende bei 114,9 s in einem Stück von
           * 85,2 s. Ohne Klemmung zeigte die Sprungmarke in das nächste Stück hinein.
           */
          const klemme = (t: number) => Math.max(0, Math.min(t, spanne)) + offset;
          for (const s of mitZeit) {
            segmente.push({
              start: klemme(s.start!),
              end: typeof s.end === "number" ? klemme(s.end) : undefined,
              text: s.text,
            });
          }
          if (text.trim()) texte.push(text.trim());
          if (!mitZeit.length && text.trim()) {
            // Ein Stück ohne Segmente würde sonst spurlos verschwinden, sobald irgendein
            // anderes Stück welche liefert – das Ergebnis sähe vollständig aus und wäre
            // es nicht. Sein Text bekommt deshalb den Beginn des Stücks als Marke.
            segmente.push({ start: offset, text: text.trim() });
          }
          if (!sprache && antwortSprache) sprache = antwortSprache;
        } catch (e) {
          if (!abbruch.signal.aborted) fehler = e as Error;
        }
      });
    }

    knoten.onaudioprocess = (e) => {
      if (fertig || abbruch.signal.aborted) return;
      // Werbung läuft im selben Element. Sie gehört nicht ins Transkript, und ihre
      // Länge verschiebt sonst jede folgende Zeitangabe.
      if (werbungLaeuft()) {
        // Das laufende Stück abschliessen, statt Ton von vor und nach der Werbung
        // zusammenzukleben – sonst stimmt jede folgende Zeitangabe nicht mehr.
        if (!werbungZuletzt) schneide(true);
        werbungZuletzt = true;
        return;
      }
      if (werbungZuletzt) {
        /*
         * Zurück im Beitrag. Beides muss hier passieren: `stueckStart` steht sonst auf
         * der Laufzeit der Werbung – die folgenden Sprungmarken zeigten dann um deren
         * Länge daneben –, und YouTube setzt beim Werbewechsel die Geschwindigkeit auf
         * 1x zurück, ohne dass danach zwingend ein `ratechange` folgt.
         */
        werbungZuletzt = false;
        stueckStart = video.currentTime;
        setzeTempo();
      }
      const eingang = e.inputBuffer.getChannelData(0);
      puffer.push(new Float32Array(eingang));
      pufferLaenge += eingang.length;

      let spitze = 0;
      for (let i = 0; i < eingang.length; i += 16) {
        const a = Math.abs(eingang[i]!);
        if (a > spitze) spitze = a;
      }
      const jetzt = performance.now();
      if (spitze < 1e-4) {
        stilleSeit ??= jetzt;
      } else {
        stilleSeit = null;
      }
      if (stilleSeit !== null && jetzt - stilleSeit > STILLE_GRENZE * 1000) {
        fehler = new Error(
          "Der Ton dieses Videos ist geschützt oder stumm – es kommt kein Signal an.",
        );
        fertig = true;
        return;
      }

      schneide(false);
      melde();
    };

    quelle.connect(knoten);
    // Der Knoten muss an ein Ziel hängen, sonst ruft Chrome ihn nicht auf. Dazwischen
    // liegt ein Regler auf null: `video.muted` betrifft nur die Ausgabe des Elements,
    // die Kopie aus `captureStream()` wäre sonst über die Lautsprecher zu hören – und
    // zwar in vierfachem Tempo.
    const stumm = ctx.createGain();
    stumm.gain.value = 0;
    knoten.connect(stumm);
    stumm.connect(ctx.destination);

    // Die Rate setzt YouTube bei Werbung und Qualitätswechseln zurück; deshalb
    // nachziehen, statt einmal zu setzen.
    function setzeTempo() {
      if (fertig || werbungLaeuft()) return;
      video!.preservesPitch = false;
      if (video!.playbackRate !== TEMPO) video!.playbackRate = TEMPO;
    }
    video.addEventListener("ratechange", setzeTempo);

    video.currentTime = 0;
    setzeTempo();

    try {
      await new Promise<void>((resolve, reject) => {
        let takt = 0;
        const beende = (e: Error | null) => {
          clearInterval(takt);
          video.removeEventListener("ended", prüfe);
          abbruch.signal.removeEventListener("abort", prüfe);
          fertig = true;
          if (e) reject(e);
          else resolve();
        };
        function prüfe() {
          if (fehler) beende(fehler);
          else if (abbruch.signal.aborted) beende(new Error("Abgebrochen."));
          else if (!werbungLaeuft() && (video!.ended || video!.currentTime >= video!.duration - 0.5))
            beende(null);
        }
        takt = window.setInterval(prüfe, 500);
        video.addEventListener("ended", prüfe);
        abbruch.signal.addEventListener("abort", prüfe);
      });

      schneide(true);
      await kette;
      if (fehler) throw fehler;
    } finally {
      fertig = true;
      video.removeEventListener("ratechange", setzeTempo);
      knoten.onaudioprocess = null;
      knoten.disconnect();
      stumm.disconnect();
      quelle.disconnect();
      for (const spur of stream.getTracks()) spur.stop();
      void ctx.close();
      video.pause();
      video.playbackRate = vorher.rate;
      video.preservesPitch = vorher.pitch;
      video.muted = vorher.stumm;
      video.currentTime = vorher.zeit;
      if (!vorher.pausiert) void video.play().catch(() => {});
    }

    const cues: Cue[] = segmente
      .filter((s) => (s.text ?? "").trim())
      .map((s) => ({
        start: s.start!,
        dur: typeof s.end === "number" ? Math.max(0, s.end - s.start!) : 0,
        text: s.text!.trim(),
      }));

    if (cues.length) {
      return { cues, lang: sprache, source: `Spracherkennung (${TEMPO}x)`, hasTimestamps: true };
    }

    const text = texte.join(" ").trim();
    if (!text) throw new Error("Die Spracherkennung hat nichts zurückgeliefert.");
    return {
      cues: [{ start: 0, dur: 0, text }],
      lang: sprache,
      source: `Spracherkennung (${TEMPO}x)`,
      hasTimestamps: false,
    };
  })();

  return { promise, cancel: () => abbruch.abort() };
}
