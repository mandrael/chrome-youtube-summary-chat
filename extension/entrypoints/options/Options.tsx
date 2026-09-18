import * as React from "react";
import { ZIELSPRACHEN } from "@shared/lib/tracks";
import { availability as localAvailability, baseLang, downloadModel, isSupported } from "@/lib/translate-local";
import { Check, Copy, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ask } from "@/lib/chat-client";
import { ModellWahl } from "./ModellWahl";
import { preis as mistralPreis, PREISSTAND } from "@shared/lib/mistral";
import {
  empfohleneModelle,
  FALLBACK_MODELS,
  formatPreis,
  isLiteModel,
  ONE_M_CONTEXT,
  preisProAnfrage,
} from "@shared/lib/openrouter";
import { clearCache, DEFAULT_SETTINGS, getSettings, setSettings } from "@/lib/storage";
import { parseWoerterbuch } from "@shared/lib/korrektur";
import { DEFAULT_SYSTEM_PROMPT } from "@shared/lib/prompts";
import type {
  KeyStatus,
  ModelInfo,
  ReasoningEffort,
  Settings,
  SttModelInfo,
  SttRoute,
} from "@shared/lib/types";

const REASONING_STEPS: ReasoningEffort[] = ["minimal", "low", "medium", "high"];

/**
 * Was „Alles zurücksetzen" unangetastet lässt: die Schlüssel beider Anbieter, die Wahl
 * des Anbieters und das Mistral-Modell – ohne die drei letzten stünde jemand mit
 * Mistral nach dem Zurücksetzen still bei OpenRouter.
 */
const ZUGANGSFELDER: ReadonlyArray<keyof Settings> = ["apiKey", "mistralApiKey", "provider", "mistralModel"];

export function Options() {
  const [s, setS] = React.useState<Settings | null>(null);
  const [models, setModels] = React.useState<ModelInfo[] | null>(null);
  const [modelsError, setModelsError] = React.useState("");
  const [stt, setStt] = React.useState<SttModelInfo[] | null>(null);
  const [keyStatus, setKeyStatus] = React.useState<KeyStatus | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [ordnerFehler, setOrdnerFehler] = React.useState("");
  const [ordnerDialog, setOrdnerDialog] = React.useState(false);
  const [host, setHost] = React.useState<{ ok: boolean; detail: string } | null>(null);
  const [cacheMeldung, setCacheMeldung] = React.useState<string | null>(null);
  /*
   * Mistral: Liste und Schlüsselprobe brauchen beide den Schlüssel, deshalb wird hier
   * nichts beim Öffnen geladen – erst auf Klick.
   */
  const [mistralModels, setMistralModels] = React.useState<ModelInfo[] | null>(null);
  const [mistralFehler, setMistralFehler] = React.useState("");
  const [mistralLaedt, setMistralLaedt] = React.useState(false);
  const [mistralKeyStatus, setMistralKeyStatus] = React.useState<KeyStatus | null>(null);
  const [mistralTesting, setMistralTesting] = React.useState(false);

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

  /*
   * Die Empfehlung steht immer oben und ist bewusst nicht gefiltert: sie ist der
   * Einstieg für alle, die kein bestimmtes Modell suchen. Wer filtert, sucht gezielt
   * und bekommt nur die Anbietergruppen.
   */
  const eintraege = React.useMemo(() => parseWoerterbuch(s?.dictionary ?? ""), [s?.dictionary]);

  const empfohlen = React.useMemo(() => empfohleneModelle(models ?? FALLBACK_MODELS), [models]);

  React.useEffect(() => {
    void getSettings().then((s0) => {
      setS(s0);
      // OpenRouter nur ansprechen, wenn OpenRouter gewählt ist – bei Mistral keine
      // einzige Anfrage dorthin, auch nicht für die Modellliste.
      if (s0.provider !== "openrouter") return;
      ask<ModelInfo[]>("listModels")
        .then(setModels)
        .catch((e) => {
          // Ohne Liste bleibt das Dropdown nutzbar – dann eben ohne Preise.
          setModelsError(String(e?.message ?? e));
          setModels(FALLBACK_MODELS);
        });
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
    (k) => !ZUGANGSFELDER.includes(k) && s[k] !== DEFAULT_SETTINGS[k],
  );

  function mistralModelleLaden() {
    setMistralLaedt(true);
    setMistralFehler("");
    // `s` ist hinter dem Lade-Guard gesetzt; die Verengung reicht nur nicht in eine
    // verschachtelte Funktion hinein.
    ask<ModelInfo[]>("listMistralModels", { apiKey: s?.mistralApiKey ?? "", region: s?.mistralRegion })
      .then((liste) => {
        setMistralModels(liste);
        // Ein gespeichertes Modell, das die Liste nicht mehr führt, bleibt stehen und
        // wird als solches angezeigt – nichts wird still umgestellt. Ist noch keins
        // gewählt, wird das neueste vorgewählt, sonst steht der Chat nach „Modelle
        // laden" weiter mit „kein Modell gewählt" da.
        const erstes = liste[0]?.id;
        if (erstes) {
          setS((akt) => {
            if (!akt || akt.mistralModel) return akt;
            void setSettings({ mistralModel: erstes });
            return { ...akt, mistralModel: erstes };
          });
        }
      })
      .catch((e) => setMistralFehler(String(e?.message ?? e)))
      .finally(() => setMistralLaedt(false));
  }

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
        Modellaufrufe gehen direkt vom Browser an den gewählten Anbieter. Kein eigenes
        Backend, kein Proxy, keine Telemetrie.
      </p>

      {/* ---------- Anbieter ---------- */}
      <Section title="Anbieter">
        <Field
          label="Wohin die Anfragen gehen"
          hint="OpenRouter bündelt viele Modelle unter einem Schlüssel. Mistral AI ist ein Anbieter mit Sitz in der EU – die Datenschutzoption. Gewechselt wird hier; der jeweils andere Zugang bleibt gespeichert."
        >
          <Radio
            value={s.provider}
            onChange={(v) => patch({ provider: v as Settings["provider"] })}
            options={[
              ["openrouter", "OpenRouter (Standard)"],
              ["mistral", "Mistral AI – EU-Anbieter, Datenschutzoption"],
            ]}
          />
        </Field>
      </Section>

      {/* ---------- Mistral-Zugang: nur wenn gewählt ---------- */}
      {s.provider === "mistral" && (
        <Section title="Mistral-Zugang">
          <p className="mb-3 text-sm text-muted-foreground">
            Anfragen gehen direkt an Mistral (EU-Unternehmen), nicht über OpenRouter. Mit dem
            EU-Endpunkt findet die Verarbeitung garantiert in der EU statt; Mistral bewahrt
            API-Eingaben standardmässig 30 Tage zur Missbrauchserkennung auf, kein Training.
            Mistrals API liefert keine Preise; die Beträge hier stammen aus Mistrals
            Preisliste (Stand {PREISSTAND}), beim EU-Endpunkt mit dem Aufpreis von 10 %.
            Internetsuche und Reasoning-Regler entfallen, beides sind OpenRouter-Funktionen.
          </p>
          <Field
            label="Endpunkt"
            hint="EU: api.eu.mistral.ai, Inferenz garantiert in der EU, laut Mistral rund 10 % Aufpreis. Global: api.mistral.ai."
          >
            <Select
              value={s.mistralRegion}
              onValueChange={(v) => {
                const region = v as Settings["mistralRegion"];
                patch({ mistralRegion: region });
                // Die geladene Liste trägt Preise der alten Region; ohne Umrechnung
                // stünde bis zum nächsten „Modelle laden" der um 10 % falsche Betrag.
                setMistralModels(
                  (liste) =>
                    liste &&
                    liste.map((m) => ({
                      ...m,
                      pricePrompt: mistralPreis(m.id, region)?.ein,
                      priceCompletion: mistralPreis(m.id, region)?.aus,
                    })),
                );
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eu">EU (Standard)</SelectItem>
                <SelectItem value="global">Global</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="API-Key" hint="Wird in chrome.storage.local gespeichert und nur an den gewählten Mistral-Endpunkt geschickt.">
            <div className="flex gap-2">
              <Input
                type="password"
                value={s.mistralApiKey}
                autoComplete="off"
                onChange={(e) => patch({ mistralApiKey: e.target.value })}
              />
              <Button
                variant="outline"
                disabled={!s.mistralApiKey || mistralTesting}
                onClick={() => {
                  setMistralTesting(true);
                  ask<KeyStatus>("testMistralKey", { apiKey: s.mistralApiKey, region: s.mistralRegion })
                    .then(setMistralKeyStatus)
                    .catch((e) => setMistralKeyStatus({ ok: false, error: String(e?.message ?? e) }))
                    .finally(() => setMistralTesting(false));
                }}
              >
                {mistralTesting ? <Loader2 className="animate-spin" /> : null}
                Schlüssel prüfen
              </Button>
            </div>
            {mistralKeyStatus && <KeyResult status={mistralKeyStatus} />}
          </Field>

          <Field
            label="Modell"
            hint="Die Liste kommt von /v1/models und zeigt nur Chat-Modelle, die nicht abgekündigt sind. Ohne Wahl schickt die Sidebar nichts ab."
          >
            <div className="flex items-center gap-2">
              <select
                value={s.mistralModel}
                onChange={(e) => patch({ mistralModel: e.target.value })}
                className="spur-select h-8 max-w-md"
                disabled={!mistralModels && !s.mistralModel}
              >
                <option value="">
                  {mistralModels ? "– bitte wählen –" : "– erst „Modelle laden“ –"}
                </option>
                {s.mistralModel && !mistralModels?.some((m) => m.id === s.mistralModel) && (
                  <option value={s.mistralModel}>{s.mistralModel} (gespeichert)</option>
                )}
                {(mistralModels ?? []).map((m) => {
                  const p = preisProAnfrage(m);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.id}
                      {m.contextLength ? ` · ${formatTokens(m.contextLength)}` : ""}
                      {p != null ? ` · ≈ ${formatPreis(p)} je Anfrage` : " · Preis nicht in der Liste"}
                    </option>
                  );
                })}
              </select>
              <Button
                variant="outline"
                size="sm"
                disabled={!s.mistralApiKey || mistralLaedt}
                onClick={mistralModelleLaden}
              >
                {mistralLaedt ? <Loader2 className="animate-spin" /> : null}
                Modelle laden
              </Button>
            </div>
            {mistralFehler && (
              <p className="mt-1 text-xs text-destructive whitespace-pre-wrap">{mistralFehler}</p>
            )}
            {mistralModels && (
              <p className="mt-1 text-xs text-muted-foreground">{mistralModels.length} Modelle geladen.</p>
            )}
          </Field>
        </Section>
      )}

      {/* ---------- OpenRouter-Zugang: nur wenn gewählt ---------- */}
      {s.provider === "openrouter" && (
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
      )}

      {/* ---------- Chat-Modell (OpenRouter): Modellwahl und Reasoning ---------- */}
      {s.provider === "openrouter" && (
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
          hint={`Gefiltert auf Kontextfenster ab 128000 Token und Textausgabe.${
            models ? ` ${models.length} Modelle.` : ""
          }`}
        >
          <ModellWahl
            value={s.model}
            models={models ?? FALLBACK_MODELS}
            empfehlung={empfohlen}
            onChange={(v) =>
              patch({
                model: v,
                // Lite-Modelle bekommen minimal vorbelegt.
                reasoning: isLiteModel(v) ? "minimal" : s.reasoning,
              })
            }
            // Der Auslöser zeigt nur die erste Zeile – Name und Kontextgrösse. Slug und
            // Preis stehen in der Liste, sonst wäre das geschlossene Feld dreizeilig.
            auslöser={(m) =>
              m ? (
                <>
                  <span className="truncate">{m.name}</span>
                  <KontextMarke n={m.contextLength} />
                </>
              ) : (
                <span className="truncate text-muted-foreground">{s.model}</span>
              )
            }
            zeile={(m, marken) => <ModelRow m={m} marken={marken} />}
          />
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
      )}

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
                <SelectItem value="parakeet-primeline">
                  <SttRow
                    name="Parakeet primeline – deutsch (lokal)"
                    slug="x-ian/sherpa-onnx-parakeet-primeline-de-int8"
                    detail="kostenlos · Wort-Zeitstempel · macOS, Windows, Linux · 670 MB · braucht sherpa-onnx und ffmpeg"
                  />
                </SelectItem>
                <SelectItem value="parakeet-mlx">
                  <SttRow
                    name="Parakeet MLX – mehrsprachig (lokal, Apple Silicon)"
                    slug="mlx-community/parakeet-tdt-0.6b-v3"
                    detail="kostenlos · Segment-Zeitstempel · bei deutschem Ton schwächer · braucht parakeet-mlx und ffmpeg"
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
              Bei deutschem Ton ist das deutsche Modell die erste Wahl. Gemessen an drei
              deutschen TEDx-Vorträgen (5434 Wörter, 03.09.2026): primeline 9,3 % falsche
              Wörter, das mehrsprachige Parakeet v3 auf demselben Weg 57,2 %. Der Grund
              ist nicht die Erkennung, sondern die Sprache: v3 legt sie selbst fest und
              lässt sich nicht darauf festlegen – bei deutschen Vorträgen mit englischen
              Zitaten übersetzt es weiter, statt zu transkribieren. Für englischen und
              anderssprachigen Ton bleibt Parakeet v3 die richtige Wahl; beide Modelle
              dürfen nebeneinander installiert sein.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              OpenRouter weist die Preiseinheit für Transkriptionsmodelle nicht aus. Der
              Stundenpreis ist aus der Grössenordnung des Rohwerts abgeleitet; der Rohwert
              steht deshalb daneben.
            </p>
          </Field>

          <Field label="Status des lokalen Helfers">
            <HostStatus host={host} />
          </Field>

          <Field
            label="Videodownload: vorgewählte Auflösung"
            hint="Der Dialog in der Sidebar zeigt die tatsächlich vorhandenen Auflösungen; fehlt diese, ist die nächstkleinere vorgewählt. Nur für eigene, gemeinfreie oder lizenzfreie Inhalte."
          >
            <Select
              value={String(s.downloadHeight)}
              onValueChange={(v) => patch({ downloadHeight: Number(v) as Settings["downloadHeight"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[360, 480, 720, 1080].map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {h}p
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Videodownload: Zielordner"
            hint="Leer lassen für den Downloads-Ordner des Systems. Gewählt wird über den Ordnerdialog des Systems, nicht getippt."
          >
            <div className="flex items-center gap-2">
              <Input value={s.downloadTarget} placeholder="Downloads-Ordner des Systems" readOnly />
              <Button
                variant="outline"
                size="sm"
                disabled={ordnerDialog}
                onClick={() => {
                  // Gesperrt, solange der Dialog offen ist: ein zweiter Klick öffnete sonst
                  // einen zweiten Dialog, und der zuletzt geschlossene gewönne.
                  setOrdnerDialog(true);
                  setOrdnerFehler("");
                  void ask<string | null>("chooseFolder")
                    .then((p) => p && patch({ downloadTarget: p }))
                    .catch((e) => setOrdnerFehler(String(e?.message ?? e)))
                    .finally(() => setOrdnerDialog(false));
                }}
              >
                Ordner wählen …
              </Button>
              {s.downloadTarget && (
                <Button variant="ghost" size="sm" onClick={() => patch({ downloadTarget: "" })}>
                  Standard
                </Button>
              )}
            </div>
            {ordnerFehler && <p className="mt-1 text-xs text-destructive">{ordnerFehler}</p>}
            <label className="mt-3 flex items-center gap-2 text-sm">
              <Switch checked={s.downloadAsk} onCheckedChange={(v) => patch({ downloadAsk: v })} />
              Vor jedem Download nach dem Zielordner fragen
            </label>
          </Field>

          <Field label="Voraussetzungen installieren">
            <CopyLine label="macOS" cmd="brew install yt-dlp ffmpeg" />
            <CopyLine
              label="Deutsches Modell (alle Systeme)"
              cmd="pip install sherpa-onnx numpy"
            />
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
          hint="Liest das usage-Feld der Antwort aus: Token und Betrag in USD. Bei Mistral AI stehen nur die Token da – die API liefert keinen Betrag, und geraten wird keiner."
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
            const frisch = { ...DEFAULT_SETTINGS };
            for (const k of ZUGANGSFELDER) (frisch as Record<string, unknown>)[k] = s[k];
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

function ModelRow({ m, marken }: { m: ModelInfo; marken?: string[] }) {
  // Zwei Zeilen: oben, was man sucht (Name, Kontextgrösse, fehlendes Reasoning), unten
  // die Kennung mit dem Preis je Anfrage dahinter. Der Auslöser zeigt nur die obere.
  const preis = preisProAnfrage(m);
  return (
    <span className="block">
      <span className="flex items-center gap-1.5">
        {m.name}
        <KontextMarke n={m.contextLength} />
        {marken?.map((marke) => (
          <span key={marke} className="shrink-0 rounded bg-accent px-1 text-xs text-accent-foreground">
            {marke}
          </span>
        ))}
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
  // Mistral hat keinen /key-Endpunkt: geprüft wird nur, ob die Modellliste kommt.
  if (status.usage == null && status.limit == null) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-xs text-green-600 dark:text-green-400">
        <Check className="mt-0.5 size-3.5 shrink-0" />
        <span>Schlüssel gültig – api.mistral.ai hat die Modellliste geliefert.</span>
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
