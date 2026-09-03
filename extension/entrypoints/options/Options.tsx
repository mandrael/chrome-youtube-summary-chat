import * as React from "react";
import { ZIELSPRACHEN } from "@/lib/tracks";
import { availability as localAvailability, baseLang, downloadModel, isSupported } from "@/lib/translate-local";
import { Check, Copy, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ask } from "@/lib/chat-client";
import { EMPFEHLUNG, FALLBACK_MODELS, ONE_M_CONTEXT } from "@/lib/openrouter";
import { clearCache, DEFAULT_SETTINGS, getSettings, setSettings } from "@/lib/storage";
import { parseWoerterbuch } from "@/lib/korrektur";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/prompts";
import type {
  KeyStatus,
  ModelInfo,
  ReasoningEffort,
  Settings,
  SttModelInfo,
  SttRoute,
} from "@/lib/types";

const REASONING_STEPS: ReasoningEffort[] = ["minimal", "low", "medium", "high"];

/** Das eine Feld, das „Alles zurücksetzen" unangetastet lässt. */
const ZUGANGSFELD: keyof Settings = "apiKey";

/** Lite-Modelle bekommen minimal vorbelegt – dort kostet Reasoning mehr, als es bringt. */
function isLiteModel(id: string): boolean {
  return /lite|mini|flash-8b|haiku|small/i.test(id);
}

export function Options() {
  const [s, setS] = React.useState<Settings | null>(null);
  const [models, setModels] = React.useState<ModelInfo[] | null>(null);
  const [modelsError, setModelsError] = React.useState("");
  const [stt, setStt] = React.useState<SttModelInfo[] | null>(null);
  const [keyStatus, setKeyStatus] = React.useState<KeyStatus | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [host, setHost] = React.useState<{ ok: boolean; detail: string } | null>(null);
  const [cacheMeldung, setCacheMeldung] = React.useState<string | null>(null);

  async function leeren() {
    const anzahl = await clearCache();
    setCacheMeldung(anzahl ? `${anzahl} Einträge gelöscht` : "War schon leer");
    setTimeout(() => setCacheMeldung(null), 2500);
  }

  /*
   * Ob Chromes Übersetzung überhaupt zur Verfügung steht, lässt sich nur messen, nicht
   * annehmen: die API kommt aus Chromium, aber das Modell liefert Google aus. Ein
   * Chromium-Browser wie Vivaldi oder Brave kann dieselbe Version haben und die
   * Übersetzung trotzdem nicht anbieten – deshalb wird hier der echte Zustand abgefragt
   * und der Schalter bleibt sonst gesperrt.
   */
  const [lokalZustand, setLokalZustand] = React.useState<
    "unavailable" | "downloadable" | "downloading" | "available" | "unbekannt"
  >("unbekannt");
  const [lokalLaeuft, setLokalLaeuft] = React.useState<string | null>(null);
  const [modellSuche, setModellSuche] = React.useState("");
  const filterRef = React.useRef<HTMLInputElement>(null);

  const zielCode = React.useMemo(
    () => ZIELSPRACHEN.find(([n]) => n === s?.translationTarget)?.[1] ?? "de",
    [s?.translationTarget],
  );

  React.useEffect(() => {
    void (async () => {
      if (!isSupported()) return setLokalZustand("unavailable");
      setLokalZustand(await localAvailability("en", baseLang(zielCode)));
    })();
  }, [zielCode]);

  const gefilterteModelle = React.useMemo(() => {
    const liste = models ?? FALLBACK_MODELS;
    const q = modellSuche.trim().toLowerCase();
    if (!q) return liste;
    return liste.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [models, modellSuche]);

  /*
   * Unter der Empfehlung die vollständige Liste nach Anbietern, in der Reihenfolge
   * ihres jeweils neuesten Modells – so liegt auch dort das Aktuelle vorne. Der
   * Anbieter steht im Namen vor dem Doppelpunkt, dem einzigen Feld, aus dem er sich
   * ohne gepflegte Liste ergibt.
   */
  const gruppen = React.useMemo(() => {
    const nachAnbieter = new Map<string, ModelInfo[]>();
    for (const m of gefilterteModelle) {
      const anbieter = m.name.includes(":") ? m.name.split(":")[0]!.trim() : "Weitere";
      const bisher = nachAnbieter.get(anbieter);
      if (bisher) bisher.push(m);
      else nachAnbieter.set(anbieter, [m]);
    }
    // Anbieter mit ein oder zwei Modellen zerhacken die Liste in 43 Grüppchen. Sie
    // wandern zusammen nach „Weitere" ans Ende, damit oben die grossen Häuser stehen.
    const gross: [string, ModelInfo[]][] = [];
    const klein: ModelInfo[] = [];
    for (const [anbieter, liste] of nachAnbieter) {
      if (anbieter !== "Weitere" && liste.length >= 3) gross.push([anbieter, liste]);
      else klein.push(...liste);
    }
    if (klein.length) gross.push(["Weitere", klein]);
    return gross;
  }, [gefilterteModelle]);

  /*
   * Die Empfehlung steht immer oben und ist bewusst nicht gefiltert: sie ist der
   * Einstieg für alle, die kein bestimmtes Modell suchen. Wer filtert, sucht gezielt
   * und bekommt nur die Anbietergruppen.
   */
  const eintraege = React.useMemo(() => parseWoerterbuch(s?.dictionary ?? ""), [s?.dictionary]);

  const empfohlen = React.useMemo(() => {
    const liste = models ?? FALLBACK_MODELS;
    return EMPFEHLUNG.flatMap(([id, marke]) => {
      const m = liste.find((k) => k.id === id);
      return m ? [[m, marke] as const] : [];
    });
  }, [models]);

  React.useEffect(() => {
    void getSettings().then(setS);

    ask<ModelInfo[]>("listModels")
      .then(setModels)
      .catch((e) => {
        // Ohne Liste bleibt das Dropdown nutzbar – dann eben ohne Preise.
        setModelsError(String(e?.message ?? e));
        setModels(FALLBACK_MODELS);
      });

    if (__FALLBACK__) {
      ask<SttModelInfo[]>("listSttModels")
        .then(setStt)
        .catch(() => setStt([]));
      ask<{ ok: boolean; detail: string }>("hostStatus")
        .then(setHost)
        .catch((e) => setHost({ ok: false, detail: String(e?.message ?? e) }));
    }
  }, []);

  if (!s) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  const patch = (p: Partial<Settings>) => {
    setS({ ...s, ...p });
    void setSettings(p);
  };


  const lokalText =
    lokalZustand === "available"
      ? `Verfügbar für Englisch → ${s.translationTarget}.`
      : lokalZustand === "downloadable"
        ? "Vorhanden, aber das Sprachmodell fehlt noch – rund 160 Sekunden Download."
        : lokalZustand === "downloading"
          ? "Das Sprachmodell wird gerade geladen."
          : lokalZustand === "unbekannt"
            ? "Wird geprüft …"
            : "Dieser Browser bietet die eingebaute Übersetzung nicht an. Sie steckt zwar in Chromium, dem Unterbau von Chrome, Vivaldi, Brave und Edge – das Sprachmodell dazu liefert Google aber nur an Chrome selbst aus. Übersetzt wird dann wie bisher über OpenRouter.";

  async function modellLaden() {
    setLokalLaeuft("Lädt …");
    try {
      // Ohne await davor: `create()` verlangt bei „downloadable" eine Nutzergeste.
      await downloadModel("en", baseLang(zielCode), (anteil) =>
        setLokalLaeuft(`Lädt … ${Math.round(anteil * 100)} %`),
      );
      setLokalZustand(await localAvailability("en", baseLang(zielCode)));
    } catch (e) {
      setLokalLaeuft(String((e as Error)?.message ?? e).slice(0, 80));
      return;
    }
    setLokalLaeuft(null);
  }

  const selected =
    models?.find((m) => m.id === s.model) ??
    FALLBACK_MODELS.find((m) => m.id === s.model);

  /** „Zurücksetzen" erscheint nur, wo tatsächlich vom Standard abgewichen wird. */
  const reset = <K extends keyof Settings>(feld: K) =>
    s[feld] === DEFAULT_SETTINGS[feld]
      ? undefined
      : () => patch({ [feld]: DEFAULT_SETTINGS[feld] } as Partial<Settings>);

  /** Weicht überhaupt etwas ab? Sonst ist „Alles zurücksetzen" ein toter Knopf. */
  const etwasVerstellt = (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).some(
    (k) => k !== ZUGANGSFELD && s[k] !== DEFAULT_SETTINGS[k],
  );

  return (
    <div className="mx-auto min-h-screen max-w-5xl bg-background p-8 text-foreground">
      <h1 className="mb-1 text-xl font-semibold">
        YouTube Summary Chat{" "}
        {/* Die geladene Version sichtbar machen: beim Testen ist sonst nicht zu sehen,
            welcher Build gerade im Browser steckt. */}
        <span className="text-sm font-normal text-muted-foreground">
          {chrome.runtime.getManifest().version}
          {__FALLBACK__ ? " full" : " store"}
        </span>
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Alle Modellaufrufe laufen über OpenRouter. Es gibt keinen zweiten Anbieter und
        kein eigenes Backend.
      </p>

      {/* ---------- Zugang ---------- */}
      <Section title="OpenRouter-Zugang">
        <Field label="API-Key" hint="Wird in chrome.storage.local gespeichert und nur an openrouter.ai geschickt.">
          <div className="flex gap-2">
            <Input
              type="password"
              value={s.apiKey}
              autoComplete="off"
              placeholder="sk-or-v1-…"
              onChange={(e) => patch({ apiKey: e.target.value })}
            />
            <Button
              variant="outline"
              disabled={!s.apiKey || testing}
              onClick={() => {
                setTesting(true);
                ask<KeyStatus>("testKey", { apiKey: s.apiKey })
                  .then(setKeyStatus)
                  .catch((e) => setKeyStatus({ ok: false, error: String(e?.message ?? e) }))
                  .finally(() => setTesting(false));
              }}
            >
              {testing ? <Loader2 className="animate-spin" /> : null}
              Testen
            </Button>
          </div>
          {keyStatus && <KeyResult status={keyStatus} />}
        </Field>
      </Section>

      {/* ---------- Chat-Modell ---------- */}
      <Section title="Chat-Modell">
        {modelsError && (
          <p className="mb-2 text-xs text-muted-foreground">
            Modellliste nicht abrufbar ({modelsError}). Es steht eine Minimalauswahl ohne
            Preisangaben bereit.
          </p>
        )}

        <Field
          label="Modell"
          onReset={reset("model")}
          hint={`Gefiltert auf Kontextfenster ab 128.000 Token und Textausgabe.${
            models ? ` ${models.length} Modelle.` : ""
          }`}
        >
          <Select
            value={s.model}
            // Radix legt den Fokus beim Öffnen auf die Liste – dann tippt man ins Leere
            // statt ins Filterfeld. Einen Öffnen-Hook gibt es beim Select nicht, also
            // nach dem Rendern selbst fokussieren.
            onOpenChange={(offen) => {
              if (offen) setTimeout(() => filterRef.current?.focus(), 40);
              else setModellSuche("");
            }}
            onValueChange={(v) =>
              patch({
                model: v,
                // Lite-Modelle bekommen minimal vorbelegt.
                reasoning: isLiteModel(v) ? "minimal" : s.reasoning,
              })
            }
          >
            {/*
              Der Auslöser zeigt nur die erste Zeile – Name und Kontextgrösse. Slug und
              Preis stehen in der Liste, sonst wäre das geschlossene Feld dreizeilig.
            */}
            <SelectTrigger>
              {selected ? (
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{selected.name}</span>
                  <KontextMarke n={selected.contextLength} />
                </span>
              ) : (
                <SelectValue />
              )}
            </SelectTrigger>
            {/*
              Filterfeld: knapp 300 Modelle lassen sich nicht scrollend finden. Es sitzt
              ausserhalb des scrollenden Bereichs, sonst verdeckt es die erste Zeile,
              sobald Radix beim Öffnen zur gewählten Option springt. Tastatureingaben
              dürfen nicht durchgereicht werden, sonst springt der Typeahead des
              Auswahlfelds beim Tippen zwischen den Einträgen.
            */}
            <SelectContent
              header={
                <div className="border-b border-border bg-card px-2 py-1.5">
                  <Input
                    ref={filterRef}
                    value={modellSuche}
                    placeholder="Filtern – Name oder Slug"
                    onChange={(e) => setModellSuche(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-7 text-xs"
                  />
                </div>
              }
            >
              {gefilterteModelle.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  Kein Modell passt zu „{modellSuche}".
                </p>
              ) : (
                <>
                  {!modellSuche.trim() && empfohlen.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Empfohlen</SelectLabel>
                      {empfohlen.map(([m, marke]) => (
                        <SelectItem
                          key={`tipp-${m.id}`}
                          value={m.id}
                          textValue={`${m.name} ${m.id}`}
                        >
                          <ModelRow m={m} marke={marke} />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {gruppen.map(([anbieter, liste]) => (
                    <SelectGroup key={anbieter}>
                      <SelectLabel>{anbieter}</SelectLabel>
                      {liste.map((m) => (
                        <SelectItem key={m.id} value={m.id} textValue={`${m.name} ${m.id}`}>
                          <ModelRow m={m} />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Reasoning"
          onReset={reset("reasoning")}
          hint={
            selected && !selected.supportsReasoning
              ? `${selected.name} unterstützt kein Reasoning – die Stufen bleiben wirkungslos.`
              : "Bei Lite-Modellen bleibt minimal die sinnvolle Vorgabe. Reasoning-Tokens zählen als Ausgabe und können den Preis je Anfrage übersteigen."
          }
        >
          <div className="flex flex-wrap gap-1">
            {REASONING_STEPS.map((stufe) => {
              const aus = !!selected && !selected.supportsReasoning;
              const an = s.reasoning === stufe;
              return (
                <button
                  key={stufe}
                  type="button"
                  disabled={aus}
                  aria-pressed={an}
                  onClick={() => patch({ reasoning: stufe })}
                  className={
                    "rounded-md border px-3 py-1 text-sm transition-colors disabled:opacity-40 " +
                    (an
                      ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                      : "border-border hover:bg-secondary")
                  }
                >
                  {stufe}
                </button>
              );
            })}
          </div>
        </Field>
      </Section>

      {/* ---------- Sprache ---------- */}
      <Section title="Sprache">
        <Field
          label="Antwortsprache"
          hint="Bei Auto folgt das Modell der Sprache der Anfrage – es wird nichts erzwungen."
        >
          <Radio
            value={s.answerLang}
            onChange={(v) => patch({ answerLang: v as Settings["answerLang"] })}
            options={[
              ["auto", "Auto"],
              ["de", "Deutsch"],
              ["en", "Englisch"],
            ]}
          />
        </Field>

        <Field
          label="Zielsprache der Übersetzung"
          onReset={reset("translationTarget")}
          hint="Gilt für den Übersetzen-Knopf im Chat und im Transkript."
        >
          <select
            value={s.translationTarget}
            onChange={(e) => patch({ translationTarget: e.target.value })}
            className="spur-select h-8 max-w-xs"
          >
            {ZIELSPRACHEN.map(([name]) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Schriftgrösse der Oberfläche"
          onReset={reset("uiScale")}
          hint={`Skaliert die ganze Sidebar – Schrift, Abstände, Knöpfe. 100 % entspricht YouTubes eigener Textgrösse; grössere Bildschirme vertragen mehr. Standard: ${DEFAULT_SETTINGS.uiScale} %.`}
        >
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={90}
              max={220}
              step={5}
              value={s.uiScale}
              onChange={(e) => patch({ uiScale: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
            <span className="w-12 font-mono text-xs text-muted-foreground">{s.uiScale} %</span>
          </div>
        </Field>

        <Field
          label="Breite der Spalte auf YouTube"
          onReset={reset("columnWidth")}
          hint={`Wie breit die rechte Spalte mit der Sidebar sein darf; der Player weicht entsprechend zurück. Bei schmalem Fenster schrumpft die Spalte von selbst wieder, YouTubes Mindestbreite für den Player bleibt gewahrt. YouTubes eigener Wert liegt je nach Fenster bei rund 400 bis 490 px. Standard: ${DEFAULT_SETTINGS.columnWidth} px.`}
        >
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={400}
              max={900}
              step={20}
              value={s.columnWidth}
              onChange={(e) => patch({ columnWidth: Number(e.target.value) })}
              className="w-40 accent-[var(--primary)]"
            />
            <span className="w-12 font-mono text-xs text-muted-foreground">{s.columnWidth} px</span>
          </div>
        </Field>

        <Field
          label="Zwischenspeicher leeren"
          hint="Löscht gespeicherte Unterhaltungen und den eingeklappt-Zustand. Einstellungen und API-Key bleiben."
        >
          <Button variant="outline" size="sm" onClick={() => void leeren()}>
            {cacheMeldung ?? "Leeren"}
          </Button>
        </Field>

        <Field
          label="Übersetzen mit Chrome statt OpenRouter"
          hint="Nutzt Chromes eingebaute Translator API (ab Chrome 138). Läuft auf dem Gerät, kostet nichts und lässt Zeitstempel unangetastet, weil nur der Text jeder Zeile übersetzt wird. Trifft Fachbegriffe schlechter als ein Sprachmodell."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              checked={s.preferLocalTranslate && lokalZustand === "available"}
              disabled={lokalZustand !== "available"}
              onCheckedChange={(v) => patch({ preferLocalTranslate: v })}
            />
            <span className="text-xs text-muted-foreground">{lokalText}</span>
            {lokalZustand === "downloadable" && (
              <Button size="sm" variant="outline" disabled={!!lokalLaeuft} onClick={() => void modellLaden()}>
                {lokalLaeuft ?? "Sprachmodell laden"}
              </Button>
            )}
          </div>
        </Field>

        <Field
          label="Untertitelsprache"
          hint="Auto nimmt die vom Kanal hochgeladene Originalspur. Die tatsächlich vorhandenen Spuren stehen im Transkript-Tab der Sidebar zur Wahl."
        >
          <Radio
            value={["auto", "de", "en"].includes(s.captionLang) ? s.captionLang : "custom"}
            onChange={(v) => patch({ captionLang: v === "custom" ? "" : v })}
            options={[
              ["auto", "Auto"],
              ["de", "Deutsch"],
              ["en", "Englisch"],
              ["custom", "Sprachcode"],
            ]}
          />
          {!["auto", "de", "en"].includes(s.captionLang) && (
            <Input
              value={s.captionLang}
              placeholder="z. B. fr, es, pt-BR"
              onChange={(e) => patch({ captionLang: e.target.value })}
              className="mt-2 max-w-xs"
            />
          )}
        </Field>

        <Field label="Sprache der Oberfläche">
          <Radio
            value={s.uiLang}
            onChange={(v) => patch({ uiLang: v as Settings["uiLang"] })}
            options={[
              ["auto", "Auto"],
              ["de", "Deutsch"],
              ["en", "English"],
            ]}
          />
        </Field>
      </Section>

      {/* ---------- Audio-Fallback: nur im Build "full" ---------- */}
      {__FALLBACK__ && (
        <Section title="Audio-Fallback">
          <p className="mb-3 text-sm text-muted-foreground">
            Greift nur, wenn ein Video keine Untertitel hat, und ausschliesslich nach
            einem Klick in der Sidebar. Der lokale Helfer lädt die Tonspur mit yt-dlp,
            wandelt sie mit ffmpeg und transkribiert sie.
          </p>

          <Field label="Route">
            <Select
              value={s.sttRoute}
              onValueChange={(v) => patch({ sttRoute: v as SttRoute })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parakeet-mlx">
                  <SttRow
                    name="Parakeet MLX (lokal, Apple Silicon)"
                    slug="mlx-community/parakeet-tdt-0.6b-v3"
                    detail="kostenlos · Segment-Zeitstempel · braucht parakeet-mlx und ffmpeg"
                  />
                </SelectItem>
                {(["openai/whisper-large-v3-turbo", "nvidia/parakeet-tdt-0.6b-v3"] as const).map(
                  (id) => {
                    const info = stt?.find((m) => m.id === id);
                    return (
                      <SelectItem
                        key={id}
                        value={
                          id === "openai/whisper-large-v3-turbo"
                            ? "openrouter-whisper-turbo"
                            : "openrouter-parakeet"
                        }
                      >
                        <SttRow
                          name={info?.name ?? id}
                          slug={id}
                          detail={
                            info
                              ? `$${info.usdPerHour.toFixed(4)}/h (aus ${info.rawPrice} pro ${
                                  { second: "Sekunde", minute: "Minute", hour: "Stunde" }[info.unit]
                                }) · ${info.providers.join(", ") || "?"}${
                                  info.supportsResponseFormat ? " · Zeitstempel möglich" : " · ohne Zeitstempel"
                                }`
                              : "Preis wird geladen …"
                          }
                        />
                      </SelectItem>
                    );
                  },
                )}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              OpenRouter weist die Preiseinheit für Transkriptionsmodelle nicht aus. Der
              Stundenpreis ist aus der Grössenordnung des Rohwerts abgeleitet; der Rohwert
              steht deshalb daneben.
            </p>
          </Field>

          <Field label="Status des lokalen Helfers">
            <HostStatus host={host} />
          </Field>

          <Field label="Voraussetzungen installieren">
            <CopyLine label="macOS" cmd="brew install yt-dlp ffmpeg" />
            <CopyLine label="macOS (Parakeet MLX)" cmd="uv tool install parakeet-mlx -U" />
            <CopyLine label="Windows" cmd="winget install yt-dlp.yt-dlp" />
            <CopyLine label="Windows" cmd="winget install ffmpeg" />
            <p className="mt-2 text-xs text-muted-foreground">
              Der Native-Messaging-Host muss einmalig registriert werden – die Schritte
              stehen in der README unter „Native Messaging einrichten“.
            </p>
          </Field>
        </Section>
      )}

      {/* ---------- System-Prompt ---------- */}
      <Section title="System-Prompt">
        <Textarea
          value={s.systemPrompt}
          rows={20}
          onChange={(e) => patch({ systemPrompt: e.target.value })}
          className="font-mono text-xs leading-relaxed"
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => patch({ systemPrompt: DEFAULT_SYSTEM_PROMPT })}
        >
          <RotateCcw />
          Auf Standard zurücksetzen
        </Button>
      </Section>

      {/* ---------- Wörterbuch ---------- */}
      <Section title="Wörterbuch">
        <p className="mb-2 text-sm text-muted-foreground">
          Eigennamen, die die automatische Untertitelung regelmässig verhört. Wird auf
          jedes Transkript angewendet, bevor es angezeigt, exportiert oder an das Modell
          geschickt wird – eine Zeile je Eintrag:
        </p>
        <ul className="mb-2 space-y-0.5 text-sm text-muted-foreground">
          <li>
            <code className="font-mono text-xs">Cloud Code =&gt; Claude Code</code> –
            ersetzt das Linke durch das Rechte.
          </li>
          <li>
            <code className="font-mono text-xs">DiktaGo</code> – setzt nur diese
            Schreibweise durch, auch über Leerzeichen und Bindestriche hinweg („Dikta Go").
          </li>
          <li>
            <code className="font-mono text-xs"># …</code> – Kommentar.
          </li>
        </ul>
        <Textarea
          value={s.dictionary}
          rows={8}
          placeholder={"Cloud Code => Claude Code\nDiktaGo\nOpenRouter"}
          onChange={(e) => patch({ dictionary: e.target.value })}
          className="font-mono text-xs leading-relaxed"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {eintraege.length === 0
            ? "Kein Eintrag – das Transkript bleibt unverändert."
            : `${eintraege.length} ${eintraege.length === 1 ? "Eintrag" : "Einträge"}: ` +
              `${eintraege.filter((e) => e.ersatz).length} Ersetzung(en), ` +
              `${eintraege.filter((e) => !e.ersatz).length} Schreibweise(n).`}
        </p>
      </Section>

      {/* ---------- Anzeige ---------- */}
      <Section title="Anzeige">
        <Field
          label="Kosten pro Antwort anzeigen"
          hint="Liest das usage-Feld der Antwort aus: Token und Betrag in USD."
        >
          <Switch checked={s.showCost} onCheckedChange={(v) => patch({ showCost: v })} />
        </Field>

        <Button
          variant="ghost"
          size="sm"
          disabled={!etwasVerstellt}
          onClick={() => {
            // Der Zugang bleibt stehen: ihn beim Zurücksetzen der Darstellung
            // mitzulöschen wäre eine böse Überraschung.
            const frisch = { ...DEFAULT_SETTINGS, apiKey: s.apiKey };
            setS(frisch);
            void setSettings(frisch);
          }}
        >
          Alle Einstellungen zurücksetzen (Zugang bleibt)
        </Button>
      </Section>
    </div>
  );
}

/* ---------- Bausteine ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-xl border border-border p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  onReset,
  children,
}: {
  label: string;
  hint?: string;
  /** Zeigt „Zurücksetzen" neben der Beschriftung – nur übergeben, wenn abgewichen wird. */
  onReset?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="block text-sm font-medium">{label}</label>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            aria-label={`${label} zurücksetzen`}
            className="shrink-0 cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Zurücksetzen
          </button>
        )}
      </div>
      {hint && <p className="mb-1.5 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function Radio({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, label]) => (
        <Button
          key={v}
          size="sm"
          variant={value === v ? "default" : "outline"}
          onClick={() => onChange(v)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

/** Kontextgrösse kurz: 128K, 200K, 1M, 2M – dieselbe Schreibweise überall. */
export function formatTokens(n: number): string {
  // Auf eine Nachkommastelle runden und die Null wegkürzen: 1.048.576 Token sind „1M",
  // nicht „1.0M". Kontextfenster sind ohnehin Näherungen.
  if (n >= ONE_M_CONTEXT) {
    return `${(Math.round((n / ONE_M_CONTEXT) * 10) / 10).toLocaleString("de-DE")}M`;
  }
  return `${Math.round(n / 1000)}K`;
}

function KontextMarke({ n }: { n: number }) {
  return (
    <span
      className="shrink-0 rounded border border-border px-1 text-xs font-medium text-muted-foreground"
      title={`Kontextfenster: ${n.toLocaleString("de-DE")} Token. Ab 1M passen ganze Transkripte ungekürzt hinein.`}
    >
      {formatTokens(n)}
    </span>
  );
}

/**
 * Was eine Anfrage ungefähr kostet – 30.000 Token Transkript hinein, 2.000 heraus.
 * Das Preispaar je Million verlangt Kopfrechnen, dieser Betrag nicht. Die Eingabe macht
 * über 90 % davon aus; Reasoning-Tokens zählen als Ausgabe und können den Betrag bei
 * hoher Stufe übersteigen.
 */
const ANFRAGE_EIN = 30_000;
const ANFRAGE_AUS = 2_000;

export function preisProAnfrage(m: ModelInfo): number | null {
  if (m.pricePrompt == null) return null;
  return m.pricePrompt * ANFRAGE_EIN + (m.priceCompletion ?? 0) * ANFRAGE_AUS;
}

function formatPreis(usd: number): string {
  if (usd === 0) return "gratis";
  // Unter einem Cent in Cent, sonst stünde bei 0,0012 $ und 0,0084 $ dasselbe „< 0,01 $"
  // – gerade in der Empfehlung liegen fast alle Werte dort. Zwei Nachkommastellen, weil
  // drei sich als Tausender lesen lassen.
  if (usd < 0.01) return `${(usd * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} ¢`;
  return `${usd.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function ModelRow({ m, marke }: { m: ModelInfo; marke?: string }) {
  // Zwei Zeilen: oben, was man sucht (Name, Kontextgrösse, fehlendes Reasoning), unten
  // die Kennung mit dem Preis je Anfrage dahinter. Der Auslöser zeigt nur die obere.
  const preis = preisProAnfrage(m);
  return (
    <span className="block">
      <span className="flex items-center gap-1.5">
        {m.name}
        <KontextMarke n={m.contextLength} />
        {marke && (
          <span className="shrink-0 rounded bg-accent px-1 text-xs text-accent-foreground">
            {marke}
          </span>
        )}
        {!m.supportsReasoning && (
          <span
            className="shrink-0 rounded border border-border px-1 text-xs text-muted-foreground"
            title="Dieses Modell kennt den Reasoning-Parameter nicht; die Stufen darunter bleiben wirkungslos."
          >
            kein Reasoning
          </span>
        )}
      </span>
      <span className="block text-xs text-muted-foreground">
        <span className="font-mono">{m.id}</span>
        {preis != null && (
          <span
            title={`Eingabe $${((m.pricePrompt ?? 0) * 1e6).toFixed(2)} / Ausgabe $${((m.priceCompletion ?? 0) * 1e6).toFixed(2)} je Mio. Token`}
          >
            {" "}
            ({preis > 0 ? "≈ " : ""}
            {formatPreis(preis)} je Anfrage)
          </span>
        )}
      </span>
    </span>
  );
}

function SttRow({ name, slug, detail }: { name: string; slug: string; detail: string }) {
  return (
    <span className="block">
      <span className="block">{name}</span>
      <span className="block font-mono text-xs text-muted-foreground">{slug}</span>
      <span className="block text-xs text-muted-foreground">{detail}</span>
    </span>
  );
}

function KeyResult({ status }: { status: KeyStatus }) {
  if (!status.ok) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
        <X className="mt-0.5 size-3.5 shrink-0" />
        <span className="whitespace-pre-wrap">{status.error}</span>
      </p>
    );
  }
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-green-600 dark:text-green-400">
      <Check className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Key gültig{status.label ? ` (${status.label})` : ""}. Verbraucht: $
        {(status.usage ?? 0).toFixed(4)}
        {status.limit != null
          ? ` von $${status.limit.toFixed(2)} · verbleibend $${(status.limitRemaining ?? 0).toFixed(4)}`
          : " · kein Limit gesetzt"}
        {status.isFreeTier ? " · Free Tier" : ""}
      </span>
    </p>
  );
}

function HostStatus({ host }: { host: { ok: boolean; detail: string } | null }) {
  if (!host) {
    return (
      <p className="text-xs text-muted-foreground">
        <Loader2 className="inline size-3 animate-spin" /> wird geprüft …
      </p>
    );
  }
  return (
    <p
      className={`flex items-start gap-1.5 text-xs ${
        host.ok ? "text-green-600 dark:text-green-400" : "text-destructive"
      }`}
    >
      {host.ok ? <Check className="mt-0.5 size-3.5 shrink-0" /> : <X className="mt-0.5 size-3.5 shrink-0" />}
      <span className="whitespace-pre-wrap">{host.detail}</span>
    </p>
  );
}

function CopyLine({ label, cmd }: { label: string; cmd: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="w-40 shrink-0 text-xs text-muted-foreground">{label}</span>
      <code className="flex-1 rounded-md bg-muted px-2 py-1 font-mono text-xs">{cmd}</code>
      <Button
        size="iconSm"
        variant="ghost"
        title="Kopieren"
        onClick={() => {
          void navigator.clipboard.writeText(cmd);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }}
      >
        {done ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
