import * as React from "react";
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
import {
  FALLBACK_MODELS,
  isValidSlug,
  ONE_M_CONTEXT,
} from "@/lib/openrouter";
import { DEFAULT_SETTINGS, getSettings, setSettings } from "@/lib/storage";
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

  const selected =
    models?.find((m) => m.id === s.model) ??
    FALLBACK_MODELS.find((m) => m.id === s.model);
  const customValid = !s.customModel.trim() || isValidSlug(s.customModel);

  return (
    <div className="mx-auto max-w-3xl bg-background p-6 text-foreground">
      <h1 className="mb-1 text-xl font-semibold">YouTube Summary Chat</h1>
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
          hint={`Gefiltert auf Kontextfenster ab 128.000 Token und Textausgabe.${
            models ? ` ${models.length} Modelle.` : ""
          }`}
        >
          <Select
            value={s.model}
            onValueChange={(v) =>
              patch({
                model: v,
                // Lite-Modelle bekommen minimal vorbelegt.
                reasoning: isLiteModel(v) ? "minimal" : s.reasoning,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(models ?? FALLBACK_MODELS).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <ModelRow m={m} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Eigener Modell-Slug"
          hint="Überschreibt die Auswahl oben. Läuft ebenfalls über OpenRouter, deshalb ist das Provider-Präfix Pflicht."
        >
          <Input
            value={s.customModel}
            placeholder="z. B. anthropic/claude-sonnet-4.5"
            onChange={(e) => patch({ customModel: e.target.value })}
            className={customValid ? "" : "border-destructive"}
          />
          {!customValid && (
            <p className="mt-1 text-xs text-destructive">
              Ein Slug ohne Provider-Präfix wird von OpenRouter nicht aufgelöst. Format:
              anbieter/modell
            </p>
          )}
        </Field>

        <Field
          label="Reasoning"
          hint={
            selected && !selected.supportsReasoning
              ? "Das gewählte Modell unterstützt den Parameter nicht."
              : "Bei Lite-Modellen bleibt minimal die sinnvolle Vorgabe."
          }
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={REASONING_STEPS.indexOf(s.reasoning)}
              disabled={!!selected && !selected.supportsReasoning}
              onChange={(e) => patch({ reasoning: REASONING_STEPS[Number(e.target.value)] })}
              className="w-56 accent-[var(--primary)] disabled:opacity-40"
            />
            <span className="w-16 text-sm">{s.reasoning}</span>
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

        <Field label="Zielsprache der Übersetzung">
          <Input
            value={s.translationTarget}
            onChange={(e) => patch({ translationTarget: e.target.value })}
            className="max-w-xs"
          />
        </Field>

        <Field
          label="Übersetzen mit Chrome statt OpenRouter"
          hint="Nutzt Chromes eingebaute Translator API (ab Chrome 138). Läuft auf dem Gerät, kostet nichts und lässt Zeitstempel unangetastet, weil nur der Text jeder Zeile übersetzt wird. Trifft Fachbegriffe schlechter als ein Sprachmodell."
        >
          <Switch
            checked={s.preferLocalTranslate}
            onCheckedChange={(v) => patch({ preferLocalTranslate: v })}
          />
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
          onClick={() => {
            setS(DEFAULT_SETTINGS);
            void setSettings(DEFAULT_SETTINGS);
          }}
        >
          Alle Einstellungen zurücksetzen
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
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="mb-1 block text-sm font-medium">{label}</label>
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

function ModelRow({ m }: { m: ModelInfo }) {
  const oneM = m.contextLength >= ONE_M_CONTEXT;
  return (
    <span className="block">
      <span className="flex items-center gap-1.5">
        {m.name}
        {oneM && (
          <span
            className="rounded bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
            title="Ganze Transkripte passen ungekürzt in den Kontext. Das liefert bessere Ergebnisse als Chunking."
          >
            1M
          </span>
        )}
      </span>
      <span className="block font-mono text-[11px] text-muted-foreground">{m.id}</span>
      <span className="block text-[11px] text-muted-foreground">
        {m.contextLength.toLocaleString("de-DE")} Token
        {m.pricePrompt != null &&
          ` · $${(m.pricePrompt * 1e6).toFixed(2)} / $${((m.priceCompletion ?? 0) * 1e6).toFixed(2)} pro Mio.`}
      </span>
    </span>
  );
}

function SttRow({ name, slug, detail }: { name: string; slug: string; detail: string }) {
  return (
    <span className="block">
      <span className="block">{name}</span>
      <span className="block font-mono text-[11px] text-muted-foreground">{slug}</span>
      <span className="block text-[11px] text-muted-foreground">{detail}</span>
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
