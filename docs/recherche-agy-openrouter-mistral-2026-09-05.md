# Recherche: OpenRouter mit Provider-Pinning gegen Mistral direkt – und EU-Anbieter für Einzelunternehmer

Zwei agy-Recherchen (Gemini, effort high) vom 05.09.2026, ausgelöst durch Michaels Fragen:
Ist Mistral über OpenRouter mit explizitem Provider-Routing datenschutzrechtlich gleichwertig
zu einem direkten Mistral-Konto? Und ist Mistral die einzige Cloud-KI für Einzelunternehmer
mit EU-Verarbeitung? Kein Rechtsrat; Faktenlage mit Quellen, Wortlaut der Recherchen
unverändert (nur Geviertstriche ersetzt). Die Extension setzt seit Version 0.6.0 Mistral
direkt mit `api.eu.mistral.ai` als Voreinstellung um.

---

## Teil 1: Datenfluss OpenRouter gegen Mistral direkt, Mistral-API

### 1. OpenRouter mit Provider-Routing auf Mistral

```json
provider: { "order": ["mistral"], "allow_fallbacks": false }
```

* **Infrastruktur & Datenfluss:**
  * **Routing & Edge:** Anfragen an `openrouter.ai` / `api.openrouter.ai` terminieren über das weltweite Anycast-Netzwerk von **Cloudflare, Inc.** (Hosting, CDN, WAF, API Shield).
  * **Backend & US-Server:** OpenRouter wird von **OpenRouter, Inc.** (Delaware, USA) betrieben. Die Anfragen passieren US-Infrastruktur (Google Cloud Platform, Upstash) zur Ratenbegrenzung, Tokenzählung und Modell-Weiterleitung, bevor der Request an die Mistral-Endpunkte weitergesendet wird.
  * **Subprozessoren:** Laut OpenRouters offizieller Liste der autorisierten Subprozessoren haben fast alle Dienstleister ihren Sitz in den USA:
    * **Cloudflare Inc. (USA):** Website/API Hosting, CDN (*All Customer Data*)
    * **Google Cloud Platform (USA / Global):** IaaS, Dashboards/Analytics (*All Customer Data*)
    * **Upstash Inc. (USA):** Database (*Prompts & Completions*)
    * **Google Cloud Natural Language API (USA):** NLP-Kategorisierung (*API Requests/Responses*)
* **Logging & Prompt-Speicherung:**
  * **Standard:** OpenRouter speichert Eingaben und Ausgaben standardmäßig **nicht** persistent (*No Logging by default*). Es werden nur Metadaten (Tokens, Modell, Zeitstempel) zur Abrechnung erfasst.
  * **Ausnahmen:** Nutzer können *Private Input & Output Logging* in den Einstellungen explizit aktivieren oder am Programm zur Datenweitergabe gegen Rabatt (1 %) teilnehmen.
* **Zero Data Retention (ZDR) & Routing-Flags:**
  * Unterstützt über Request-Parameter (`zdr: true` bzw. `data_collection: "deny"`) oder konto-/guardrail-weit.
  * `provider: { order: ["mistral"], allow_fallbacks: false }` erzwingt zwar die Ausführung bei Mistral, unterbindet jedoch nicht den Durchlauf durch OpenRouters US-Infrastruktur.
* **EU-Datenresidenz / EU-Region:**
  * **Nur für Enterprise-Kunden auf Anfrage:** OpenRouter bietet regionales Routing über `https://eu.openrouter.ai` an.
  * Für Standard- und Free-Konten existiert **keine** garantierte EU-Datenresidenz; der Datenverkehr läuft regulär über US-Server.
* **DPA, SCCs & DSGVO:**
  * **DPA (AV-Vertrag):** Ein Data Processing Agreement ist in die AGB/Enterprise-Bedingungen integriert bzw. im Trust Center verfügbar.
  * **Drittlandtransfer:** OpenRouter stützt sich auf Standardvertragsklauseln (SCCs nach Art. 46 DSGVO) und Angemessenheitsbeschlüsse (Art. 45 DSGVO). Gerichtsstand in den AGB ist New York (USA).

---

### 2. Mistral AI La Plateforme (`api.mistral.ai`)

* **Server-Standort & Regionen:**
  * Mistral AI (**Mistral AI SAS**) ist ein französisches Unternehmen mit Hauptsitz in Paris.
  * Die primäre Serverinfrastruktur steht in Rechenzentren innerhalb der Europäischen Union (u. a. Frankreich, Schweden, Deutschland via CoreWeave EU / Scaleway / Azure EU).
  * **Regionale Endpunkte:**
    * Standard (global): `https://api.mistral.ai`
    * EU-Inferenz: `https://api.eu.mistral.ai` (garantiert Inferenz in der EU; 10 % Aufpreis / 1.1× Listpreis)
    * US-Inferenz: `https://api.us.mistral.ai` (Inferenz in den USA)
    * *Hinweis zur Control-Plane:* Die regionale Zuweisung betrifft die Inferenz-Payloads (Prompts/Completions). Einzelne Kontoverwaltungs- und Billing-Metadaten können global verarbeitet werden.
* **Datenspeicherung & Logging (Standard vs. ZDR):**
  * **Kein Modelltraining:** Daten über die API werden standardmäßig nicht zum Trainieren von Mistral-Modellen verwendet.
  * **Standard-Aufbewahrung (Abuse Monitoring):** API-Prompts und -Outputs werden standardmäßig für **30 Tage** verschlüsselt zur Missbrauchserkennung zwischengespeichert und danach gelöscht.
  * **Zero Data Retention (ZDR):** Für zustandslose API-Aufrufe (Pay-as-you-go & Enterprise) kann ZDR aktiviert werden, wodurch Prompts/Outputs nach Rückgabe der Antwort unmittelbar verworfen werden.
* **DPA & Unternehmensangebot:**
  * DPA direkt nach EU-DSGVO (Art. 28 DSGVO) als EU-Auftragsverarbeiter verfügbar.
  * Enterprise-Angebote mit SLAs, dedizierten VPCs/Clustern, SOC 2 Type II / ISO 27001-Zertifizierungen und Deployment-Möglichkeiten in eigenen Cloud-Tenants (Azure AI, AWS Bedrock, GCP Vertex AI).

---

### 3. Mistral API – Technische Spezifikation

* **Basis-URLs:**
  * Global: `https://api.mistral.ai/v1`
  * Regional EU: `https://api.eu.mistral.ai/v1`
  * Regional US: `https://api.us.mistral.ai/v1`
* **Modellliste (`GET /v1/models`):**
  * Liefert JSON-Objekt mit `object: "list"` und `data: [...]`.
  * **Felder je Modell:** `id` (z. B. `mistral-large-latest`, `codestral-latest`), `object: "model"`, `created` (Unix-Timestamp), `owned_by`, `capabilities` (Booleans für `completion_chat`, `completion_fim`, `function_calling`, `vision` etc.), `max_context_length`, `aliases`, `deprecation`, `default_model_temperature`.
  * **Preise im Endpunkt:** **Nein.** `GET /v1/models` liefert **keine** Token-Preise (im Unterschied zu OpenRouters `/api/v1/models`, wo `pricing: { prompt, completion }` enthalten ist). Preise müssen statisch über die Mistral-Preisliste geführt werden.
* **Chat-Completions (`POST /v1/chat/completions`):**
  * OpenAI-kompatible Schnittstelle (`model`, `messages`, `temperature`, `max_tokens`, `stream`, `tools`, `response_format` etc.).
  * **Streaming:** Server-Sent Events (`Content-Type: text/event-stream`), Datenblöcke `data: {"id": "...", "choices": [{"delta": {"content": "..."}}]}` mit Abschluss durch `data: [DONE]`.
  * **Usage-Felder:** Im JSON-Response bzw. im finalen Stream-Chunk enthalten:
    ```json
    "usage": {
      "prompt_tokens": 12,
      "completion_tokens": 45,
      "total_tokens": 57
    }
    ```
* **Authentifizierung:**
  * Per HTTP-Header: `Authorization: Bearer <MISTRAL_API_KEY>`.
* **CORS-Verhalten für Browser-Extensions:**
  * `api.mistral.ai` liefert **keine** permissiven CORS-Header (`Access-Control-Allow-Origin: *`).
  * **Extension-Kontext (Manifest V3):**
    * *Background Service Worker / Popup / Sidepanel:* Mit deklarierten Host-Permissions (`"host_permissions": ["https://api.mistral.ai/*", "https://api.eu.mistral.ai/*"]`) wird die Browser-SOP umgangen; direkte API-Aufrufe funktionieren einwandfrei.
    * *Content Scripts:* Laufen im Kontext der Host-Webseite und unterliegen der regulären Browser-SOP -> direkte Calls scheitern an fehlendem CORS und müssen per `chrome.runtime.sendMessage()` an den Background Worker delegiert werden.
    * *OpenRouter im Vergleich:* Sendet `Access-Control-Allow-Origin: *` und erlaubt daher auch direkte browserseitige Aufrufe aus Webseiten-Kontexten.

---

### Fazit: Ist OpenRouter mit Provider-Pinning DSGVO-technisch gleichwertig mit „direkt bei Mistral"?

> **Nein.** Aus datenschutzrechtlicher Sicht besteht trotz identischem Modell-Output ein signifikanter Unterschied im Hinblick auf Drittlandtransfer, Vertragskette und Angriffsfläche. *(Keine Rechtsberatung, rein technische/vertragliche Faktenlage)*.

| Kriterium | Direkt bei Mistral AI (`api.eu.mistral.ai`) | Mistral über OpenRouter (`provider: {order:["mistral"]}`) |
| :--- | :--- | :--- |
| **Vertragspartner** | **Mistral AI SAS** (Paris, Frankreich / EU) | **OpenRouter, Inc.** (Delaware / Kalifornien, USA) |
| **Drittlandtransfer (Kapitel V DSGVO)** | **Kein Drittlandtransfer** bei Nutzung des EU-Endpunkts. Reiner EU-interner Datenverkehr. | **Liegt vor (USA):** Datenübermittlung an US-Unternehmen erfordert Transferinstrumente (SCCs / DPF) und TIA. |
| **Auftragsverarbeiter-Kette** | **1-stufig:** Verantwortlicher $\rightarrow$ Mistral AI SAS (Art. 28 DSGVO DPA nach französischem/EU-Recht). | **Mehrstufig:** Verantwortlicher $\rightarrow$ OpenRouter Inc. (USA) $\rightarrow$ US-Subprozessoren (Cloudflare, Upstash, GCP) $\rightarrow$ Mistral AI. |
| **Server-Durchlauf** | Verbleibt vollständig in EU-Rechenzentren. | Passiert US-Edge/Cloudflare und US-Datenbanken (Upstash) von OpenRouter. |
| **EU-Datenresidenz** | Standardmäßig bzw. über `api.eu.mistral.ai` verfügbar. | Nur in speziellen Enterprise-Verträgen über `eu.openrouter.ai` verfügbar. |
| **Anwendbares Recht** | EU-DSGVO / Französisches Recht. | US-Recht (New York) / US-Cloud Act Zugriffsmöglichkeiten auf OpenRouter. |

---

### Belegte Quellen

1. **OpenRouter Privacy Policy:** [openrouter.ai/privacy](https://openrouter.ai/privacy) *(Stand: August 2026)*
2. **OpenRouter Authorized Sub-processors:** [openrouter.ai/authorized-sub-processors](https://openrouter.ai/authorized-sub-processors) *(Stand: Januar 2026)*
3. **OpenRouter Provider Routing & ZDR:** [openrouter.ai/docs/features/provider-routing](https://openrouter.ai/docs/features/provider-routing) *(Stand: 2026)*
4. **OpenRouter Enterprise In-Region Routing:** [openrouter.ai/docs/guides/privacy/provider-logging](https://openrouter.ai/docs/guides/privacy/provider-logging) *(Stand: 2026)*
5. **OpenRouter Trust Center:** [trust.openrouter.ai](https://trust.openrouter.ai) *(Stand: 2026)*
6. **Mistral AI Regional Inference:** [docs.mistral.ai/deployment/regional-inference](https://docs.mistral.ai/deployment/regional-inference/) *(Stand: 2026)*
7. **Mistral AI API Reference (Models & Chat):** [docs.mistral.ai/api](https://docs.mistral.ai/api/) *(Stand: 2026)*
8. **Mistral AI Privacy & Retention Policy:** [mistral.ai/terms/#privacy-policy](https://mistral.ai/terms/) *(Stand: 2026)*

---

## Teil 2: EU-Cloud-KI-Anbieter für Einzelunternehmer

Hier ist die strukturierte Recherche für einen Einzelunternehmer in Österreich/EU (Stand: September 2026).

---

### Rechtliche Einordnung der Kategorien

* **Kategorie A: Echte EU-Unternehmen mit EU-Inferenz** – Vollständige DSGVO-Souveränität, kein US-CLOUD-Act-Zugriffsrisiko.
* **Kategorie B: Schweizer Unternehmen mit CH-Inferenz** – Drittstaat mit offiziellem EU-DSGVO-Angemessenheitsbeschluss (Art. 45 DSGVO).
* **Kategorie C: US-Unternehmen mit EU-Datenresidenz** – Inferenz/Speicher in EU-Rechenzentren, Mutterkonzern unterliegt jedoch dem US CLOUD Act.

---

### 1. Echte EU-Unternehmen mit garantierter EU-Inferenz

#### **Mistral AI**
* **Firmensitz:** Paris, Frankreich (EU)
* **Selbstregistrierung:** **Ja** (sofortige Freischaltung per Kreditkarte / Pay-as-you-go via Mistral Console)
* **Datenregion:** **EU** (Standardmäßig europäische Rechenzentren)
* **DPA / AVV:** **Ja** (Online-DPA in den Geschäftsbedingungen integriert)
* **Datenaufbewahrung (Standard):** 30 Tage Log-Aufbewahrung (Missbrauchserkennung); Zero Data Retention (ZDR) für Bezahl-APIs konfigurierbar; **kein** Training mit Kundendaten
* **Modellauswahl:** Eigene Modelle (*Mistral Large, Mistral Small, Codestral, Pixtral, Ministral, Mistral NeMo*)
* **Preisniveau:** Sehr günstig bis moderat (*Mistral Small* ca. 0,10 $/1M In, 0,30 $/1M Out; *Mistral Large* ca. 2,00 $/1M In, 6,00 $/1M Out)
* **Basis-URL:** `https://api.mistral.ai/v1`

#### **IONOS Cloud AI Model Hub**
* **Firmensitz:** Montabaur/Berlin, Deutschland (EU)
* **Selbstregistrierung:** **Ja** (Cloud-Konto per Kreditkarte/SEPA, Token sofort im Cloud Panel erstellbar)
* **Datenregion:** **Deutschland** (Rechenzentren Berlin / Frankfurt)
* **DPA / AVV:** **Ja** (Standard-AVV nach deutschem Recht direkt im Control Panel abschließbar)
* **Datenaufbewahrung (Standard):** Flüchtige Verarbeitung; **keine** Speicherung von Prompts/Outputs für Training
* **Modellauswahl:** Offene Spitzenmodelle (*Llama 3.1/3.3, Mistral, Qwen 2.5, DeepSeek R1/V3, BGE Embeddings*)
* **Preisniveau:** Sehr günstig (Token-Abrechnung ab ca. 0,11 $/1M Tokens für kleinere Modelle, bis ca. 0,89 $/1M Tokens für große Modelle)
* **Basis-URL:** `https://openai.inference.de-txl.ionos.com/v1`

#### **Scaleway Generative APIs**
* **Firmensitz:** Paris, Frankreich (EU, Iliad-Gruppe)
* **Selbstregistrierung:** **Ja** (Kreditkarte via Scaleway Console, sofort einsatzbereit)
* **Datenregion:** **Frankreich** (Region `fr-par` / Paris)
* **DPA / AVV:** **Ja** (Standard-DPA online verfügbar)
* **Datenaufbewahrung (Standard):** Reine Inferenzverarbeitung; **kein** Training mit Kundendaten
* **Modellauswahl:** Offene Modelle (*Llama 3.1/3.3, Mistral NeMo, Qwen 2.5, DeepSeek R1/V3*)
* **Preisniveau:** Günstig (Serverless Token-Billing ab ca. 0,20 € / 1M Tokens)
* **Basis-URL:** `https://api.scaleway.ai/v1`

#### **Nebius AI Studio / Token Factory**
* **Firmensitz:** Amsterdam, Niederlande (EU, Nebius Group N.V.)
* **Selbstregistrierung:** **Ja** (Kreditkarte, sofortige API-Key-Erstellung via Web-Studio)
* **Datenregion:** **EU** (Eigenes RZ in Mäntsälä, Finnland)
* **DPA / AVV:** **Ja** (Standard-DPA nach Art. 28 DSGVO online hinterlegt)
* **Datenaufbewahrung (Standard):** Zero-Retention-Prinzip für Inferenz; **kein** Modelltraining
* **Modellauswahl:** Sehr breites Portfolio offener Modelle (*Llama 3.1/3.3/405B, DeepSeek R1/V3, Qwen 2.5, Mistral, Gemma 2*)
* **Preisniveau:** Extrem günstig (oft Preisführer bei offenen Modellen, z. B. Llama 70B bei ca. 0,40–0,60 $/1M Tokens)
* **Basis-URL:** `https://api.tokenfactory.nebius.com/v1` *(bzw. `https://api.studio.nebius.ai/v1`)*

#### **STACKIT AI Model Serving (Schwarz-Gruppe)**
* **Firmensitz:** Neckarsulm, Deutschland (EU, IT-Dienstleister von Lidl/Kaufland)
* **Selbstregistrierung:** **Ja** (STACKIT Portal per Kreditkarte/Rechnung)
* **Datenregion:** **Deutschland** (Region `eu01`)
* **DPA / AVV:** **Ja** (Standard-AVV digital im Portal)
* **Datenaufbewahrung (Standard):** 100 % DSGVO-konform, flüchtige Verarbeitung, **kein** Training
* **Modellauswahl:** Offene Modelle (*Llama 3.x, Mistral, Qwen, DeepSeek*)
* **Preisniveau:** Moderat bis günstig (Pay-as-you-go)
* **Basis-URL:** `https://api.openai-compat.model-serving.eu01.onstackit.cloud/v1`

#### **OVHcloud AI Endpoints**
* **Firmensitz:** Roubaix, Frankreich (EU)
* **Selbstregistrierung:** **Ja** (Kreditkarte/PayPal via OVHcloud Manager)
* **Datenregion:** **Frankreich / EU** (Gravelines, Roubaix, Straßburg)
* **DPA / AVV:** **Ja** (Standard-AVV im Kundencenter)
* **Datenaufbewahrung (Standard):** Flüchtige Verarbeitung, **kein** Training mit Kundendaten
* **Modellauswahl:** Offene Modelle (*Mistral, Llama 3.x, Qwen, DeepSeek, Whisper*)
* **Preisniveau:** Günstig (Token-basiert + Free Tier für Tests)
* **Basis-URL:** `https://oai.endpoints.kepler.ai.cloud.ovh.net/v1`

#### **T-Systems / Open Telekom Cloud (AI Foundation Services)**
* **Firmensitz:** Bonn, Deutschland (EU, Deutsche Telekom)
* **Selbstregistrierung:** **Eingeschränkt / Ja** (Über T Cloud Public Marketplace; Verifizierung/Geschäftskunden-Onboarding etwas aufwendiger als bei reinen Dev-Portalen)
* **Datenregion:** **Deutschland** (Telekom-Rechenzentren Biere/Magdeburg / Frankfurt)
* **DPA / AVV:** **Ja** (Vollständiger deutscher AVV)
* **Datenaufbewahrung (Standard):** Streng DSGVO-konform, **keine** Weitergabe, kein Training
* **Modellauswahl:** Offene Modelle (*Llama, Mistral, Qwen*)
* **Preisniveau:** Moderat bis gehoben (Enterprise-SLA)
* **Basis-URL:** `https://llm-server.llmhub.t-systems.net/v2`

#### **Aleph Alpha**
* **Firmensitz:** Heidelberg, Deutschland (EU)
* **Selbstregistrierung:** **Nein** (Fokus rein auf Enterprise/Behörden über Sales-Kontakt für PhariaAI; kein Self-Service-Kreditkarten-Checkout für Einzelunternehmer)
* **Datenregion:** **Deutschland**
* **DPA / AVV:** **Ja** (nur über Individual-/Enterprise-Vertrag)
* **Datenaufbewahrung (Standard):** DSGVO-konform, kein Training
* **Modellauswahl:** Eigene Modelle (*Pharia-1, Luminous*)
* **Preisniveau:** Hoch / Enterprise-Pricing
* **Basis-URL:** `https://api.aleph-alpha.com/v1` *(bzw. kundenspezifische Endpoints)*

---

### 2. Europäischer Drittstaat mit EU-Datenschutz-Angemessenheitsbeschluss

#### **Infomaniak AI Tools**
* **Firmensitz:** Genf, Schweiz (Nicht-EU / EFTA, Art. 45 DSGVO Angemessenheitsbeschluss)
* **Selbstregistrierung:** **Ja** (Kreditkarte, sofortige Freischaltung inkl. Testguthaben)
* **Datenregion:** **Schweiz** (Eigene Rechenzentren in Genf)
* **DPA / AVV:** **Ja** (DPA nach Schweizer DSG & DSGVO-Standard)
* **Datenaufbewahrung (Standard):** 100 % privat, **kein** Training, keine Speicherung
* **Modellauswahl:** Offene Modelle (*Llama 3.x, Mixtral, Qwen, DeepSeek, Whisper*)
* **Preisniveau:** Günstig (Pay-as-you-go per Token)
* **Basis-URL:** `https://api.infomaniak.com/2/ai/{product_id}/openai/v1`

---

### 3. US-Unternehmen mit EU-Datenresidenz / EU-Region (CLOUD Act anwendbar)

#### **Microsoft Azure OpenAI Service (inkl. Azure AI Foundry)**
* **Firmensitz:** Redmond, WA, USA (Vertragspartner EU: Microsoft Ireland Operations Ltd.)
* **Selbstregistrierung:** **Ja** (Azure-Abonnement per Kreditkarte)
* **Datenregion:** **EU wählbar** (*Sweden Central, West Europe, Germany West Central*) mit *EU Data Boundary*
* **DPA / AVV:** **Ja** (Microsoft Products and Services DPA / Standardvertragsklauseln)
* **Datenaufbewahrung (Standard):** 30 Tage Missbrauchsprotokollierung (Zero Retention erfordert Genehmigung); **kein** Training mit Kundendaten
* **Modellauswahl:** OpenAI-Modelle (*GPT-4o, GPT-4o-mini, o1, o3-mini*) sowie Serverless Open-Source (*Llama, Mistral, DeepSeek*)
* **Preisniveau:** Moderat (identisch zu OpenAI-Listenpreisen)
* **Basis-URL:** `https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=...` *(oder Azure AI Foundry OpenAI-Endpoint)*

#### **Google Vertex AI**
* **Firmensitz:** Mountain View, CA, USA (Vertragspartner EU: Google Ireland Ltd.)
* **Selbstregistrierung:** **Ja** (Google Cloud Console per Kreditkarte)
* **Datenregion:** **EU wählbar** (*europe-west1* Belgien, *europe-west3* Frankfurt)
* **DPA / AVV:** **Ja** (Google Cloud Data Processing Addendum - CDPA)
* **Datenaufbewahrung (Standard):** Inferenz bleibt in der Region; **kein** Training mit Kundendaten
* **Modellauswahl:** Eigene *Gemini*-Modelle (*1.5 Pro, 2.0 Flash*) + Model Garden (*Llama 3, Mistral, Claude*)
* **Preisniveau:** Sehr günstig (*Gemini 2.0 Flash*) bis moderat
* **Basis-URL:** `https://europe-west1-aiplatform.googleapis.com/v1beta1/projects/{PROJECT}/locations/europe-west1/endpoints/openapi/chat/completions`

#### **OpenAI (Direkte API)**
* **Firmensitz:** San Francisco, CA, USA
* **Selbstregistrierung:** **Ja** (platform.openai.com per Kreditkarte)
* **Datenregion:** **USA / Global** (Standard; garantierte EU-Datenresidenz nur bei Enterprise-Plänen)
* **DPA / AVV:** **Ja** (Online-DPA im Dashboard)
* **Datenaufbewahrung (Standard):** 30 Tage Aufbewahrung; **kein** Training auf Bezahl-API-Daten
* **Modellauswahl:** Eigene Modelle (*GPT-4o, GPT-4o-mini, o1, o3-mini*)
* **Preisniveau:** Günstig bis moderat
* **Basis-URL:** `https://api.openai.com/v1`

#### **Anthropic (Direkte API)**
* **Firmensitz:** San Francisco, CA, USA
* **Selbstregistrierung:** **Ja** (console.anthropic.com per Kreditkarte)
* **Datenregion:** **USA** (EU-Inferenz nur indirekt über Partner wie AWS Bedrock / GCP Vertex EU-Regionen)
* **DPA / AVV:** **Ja** (Commercial Terms / DPA)
* **Datenaufbewahrung (Standard):** 30 Tage Logging; **kein** Training mit API-Daten
* **Modellauswahl:** Eigene Modelle (*Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus*)
* **Preisniveau:** Moderat bis gehoben
* **Basis-URL:** `https://api.anthropic.com/v1` *(Achtung: Erfordert `/v1/messages`-Format; nicht direkt OpenAI-kompatibel ohne Proxy/SDK-Wrapper)*

---

### Vergleichsübersicht (Self-Service für Einzelunternehmer)

| Anbieter | Sitz | EU-Inferenz | Self-Service (CC) | OpenAI-kompatibel | AVV online | Modellspektrum |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Mistral AI** | FR (EU) | Ja | **Ja** | **Ja** | **Ja** | Eigene Spitzenmodelle |
| **IONOS Model Hub** | DE (EU) | Ja | **Ja** | **Ja** | **Ja** | Llama, Mistral, Qwen, DeepSeek |
| **Scaleway** | FR (EU) | Ja | **Ja** | **Ja** | **Ja** | Llama, Mistral, Qwen, DeepSeek |
| **Nebius Studio** | NL (EU) | Ja | **Ja** | **Ja** | **Ja** | Llama, DeepSeek, Qwen, Mistral |
| **STACKIT** | DE (EU) | Ja | **Ja** | **Ja** | **Ja** | Llama, Mistral, Qwen, DeepSeek |
| **OVHcloud** | FR (EU) | Ja | **Ja** | **Ja** | **Ja** | Llama, Mistral, Qwen, DeepSeek |
| **Infomaniak** | CH (Nicht-EU)| Ja (CH) | **Ja** | **Ja** | **Ja** | Llama, Qwen, DeepSeek |
| **Aleph Alpha** | DE (EU) | Ja | **Nein (B2B/Sales)**| Teilweise | Nur Enterprise | Pharia-1 |
| **T-Systems** | DE (EU) | Ja | **Eingeschränkt** | **Ja** | **Ja** | Llama, Mistral, Qwen |
| **Azure OpenAI** | US | Ja (Region) | **Ja** | **Ja** | **Ja** | GPT-4o, o1/o3 + Open Source |
| **Google Vertex**| US | Ja (Region) | **Ja** | **Ja** | **Ja** | Gemini 2.0/1.5 + Model Garden |
| **OpenAI Direct**| US | Nein (Global) | **Ja** | **Ja** | **Ja** | GPT-4o, o1, o3 |
| **Anthropic Direct**| US | Nein (US) | **Ja** | **Nein (Proxy nötig)**| **Ja** | Claude 3.5 Serie |

---

### Fazit in fünf Sätzen

1. Mistral AI ist keineswegs die einzige Option, sondern lediglich der führende europäische Anbieter mit **eigenen** proprietären Spitzenmodellen.
2. Für den Einsatz offener State-of-the-Art-Modelle (wie *Llama 3.3, DeepSeek R1/V3* und *Qwen 2.5*) sind **IONOS Cloud AI Model Hub** (Deutschland) und **Scaleway Generative APIs** (Frankreich) vollwertige, sofort per Kreditkarte nutzbare EU-Alternativen mit nativer OpenAI-Kompatibilität.
3. Als dritter hochgradig attraktiver EU-Anbieter sticht **Nebius AI Studio** (Niederlande/Finnland) durch extrem günstige Token-Preise, sehr hohe Inferenzgeschwindigkeiten und sofortigen Self-Service heraus.
4. Schweizer Datenschutz mit einfacher Kreditkartenabrechnung bietet zudem **Infomaniak**, während Aleph Alpha und T-Systems für Einzelunternehmer an Vertriebshürden oder reinem Enterprise-Fokus scheitern.
5. Wer zwingend *GPT-4o* oder *Gemini* benötigt, muss auf US-Hyperscaler mit EU-Region (**Azure OpenAI** oder **Google Vertex AI**) zurückgreifen und das verbleibende US-CLOUD-Act-Restrisiko datenschutzrechtlich akzeptieren.

---

### Quellen

1. **Mistral AI:** *Mistral Documentation, Platform Pricing & Data Processing Agreement*, [mistral.ai](https://mistral.ai/) / [legal.mistral.ai](https://legal.mistral.ai/), Stand: 2026.
2. **IONOS Cloud:** *AI Model Hub Documentation, OpenAI API Endpoint & Pricing*, [docs.ionos.com](https://docs.ionos.com/cloud-computing/ai-model-hub) / [cloud.ionos.de](https://cloud.ionos.de/ai/ai-model-hub), Stand: 2026.
3. **Scaleway:** *Generative APIs – OpenAI Compatibility & Serverless Token Pricing*, [scaleway.com/en/docs/ai-data/generative-apis/](https://www.scaleway.com/en/docs/ai-data/generative-apis/), Stand: 2026.
4. **Nebius:** *Token Factory / AI Studio API Overview, GDPR Compliance & DPA*, [docs.nebius.com/token-factory/](https://docs.nebius.com/) / [nebius.com/legal/dpa](https://docs.nebius.com/legal/dpa/), Stand: 2026.
5. **STACKIT:** *STACKIT AI Model Serving Architecture & OpenAI Compatible Endpoints*, [stackit.de/de/services/ai-model-serving](https://www.stackit.de/) / [docs.stackit.cloud](https://docs.stackit.cloud/), Stand: 2026.
6. **OVHcloud:** *AI Endpoints Public Cloud Documentation & Kepler OpenAPI Endpoints*, [ovhcloud.com/en/public-cloud/ai-endpoints/](https://www.ovhcloud.com/en/public-cloud/ai-endpoints/), Stand: 2026.
7. **Infomaniak:** *AI Tools API Reference & OpenAI Compatible Format*, [developer.infomaniak.com/docs/api](https://developer.infomaniak.com/docs/api), Stand: 2026.
8. **T-Systems:** *AI Foundation Services / LLM Hub Documentation*, [docs.llmhub.t-systems.net](https://docs.llmhub.t-systems.net/) / [t-systems.com](https://www.t-systems.com/), Stand: 2026.
9. **Aleph Alpha:** *PhariaAI & Responses API Specification*, [aleph-alpha.com](https://aleph-alpha.com/), Stand: 2026.
10. **Microsoft Azure:** *Azure OpenAI Service EU Data Boundary, Privacy & Endpoints*, [learn.microsoft.com/azure/ai-services/openai/](https://learn.microsoft.com/azure/ai-services/openai/), Stand: 2026.
11. **Google Cloud:** *Vertex AI OpenAI Compatibility & Data Residency in Europe*, [cloud.google.com/vertex-ai/docs](https://cloud.google.com/vertex-ai/docs), Stand: 2026.


---

## Nachtrag 05.09.2026 (Abend): Preise global vs. EU (agy, effort medium)

Auftrag: konkrete Preise pro 1 Mio. Tokens und der Aufpreis des EU-Endpunkts. Ungeprüft gegen die Seite selbst; auffällig ist, dass „Mistral Large 3“ billiger als „Medium 3.5“ steht.

### A) Mistral AI API-Preise für Chat-/Generierungsmodelle

Stand: **05.09.2026** – Quelle: [https://mistral.ai/pricing/api/](https://mistral.ai/pricing/api/) (Standard-Tarif in USD / EUR pro 1 Million Tokens):

| Modell | Modell-ID | Input (pro 1M Tokens) | Output (pro 1M Tokens) | Quelle |
| :--- | :--- | :--- | :--- | :--- |
| **Mistral Medium 3.5** | `mistral-medium-latest` | **$1.50** (1,25 €) | **$7.50** (6,40 €) | [mistral.ai/pricing/api](https://mistral.ai/pricing/api/) |
| **Mistral Small 4** | `mistral-small-latest` | **$0.15** (0,12 €) | **$0.60** (0,50 €) | [mistral.ai/pricing/api](https://mistral.ai/pricing/api/) |
| **Mistral Large 3** | `mistral-large-latest` | **$0.50** (0,44 €) | **$1.50** (1,30 €) | [mistral.ai/pricing/api](https://mistral.ai/pricing/api/) |
| **Codestral** | `codestral-latest` | **$0.30** (0,26 €) | **$0.90** (0,79 €) | [mistral.ai/pricing/api](https://mistral.ai/pricing/api/) |
| **Ministral 3 (3B)** | `ministral-3b-latest` | **$0.10** (0,088 €) | **$0.10** (0,088 €) | [mistral.ai/pricing/api](https://mistral.ai/pricing/api/) |
| **Ministral 3 (8B)** | `ministral-8b-latest` | **$0.15** (0,13 €) | **$0.15** (0,13 €) | [mistral.ai/pricing/api](https://mistral.ai/pricing/api/) |
| **Ministral 3 (14B)** | `ministral-14b-latest` | **$0.20** (0,18 €) | **$0.20** (0,18 €) | [mistral.ai/pricing/api](https://mistral.ai/pricing/api/) |
| **GLM 5.2** | `zai-glm-5-2` | **$1.40** (1,19 €) *(Cached: $0.14)* | **$4.40** (3,74 €) | [mistral.ai/pricing/api](https://mistral.ai/pricing/api/) |

*(Hinweis: Modelle wie „Magistral“ oder „Devstral“ existieren im offiziellen Mistral-Portfolio nicht und werden auf der Preisliste nicht geführt.)*

---

### B) Regional Inference / EU-Endpunkt (`api.eu.mistral.ai`)

#### 1. Aufpreis & Dokumentation
* **Dokumentationsseite:** [https://docs.mistral.ai/inference/regional-inference](https://docs.mistral.ai/inference/regional-inference)
* **Aufpreis:** **10 %** (Multiplikator **1,1×** der Standard-Listenpreise).
* **Exaktes Zitat:**
  > *"Regional inference is billed at **1.1× standard list pricing** (a 10% upcharge) for input tokens, output tokens, cached reads, and cache writes."*  
  *(Quelle: [docs.mistral.ai/inference/regional-inference](https://docs.mistral.ai/inference/regional-inference))*

---

#### 2. Vergleich Global (`api.mistral.ai`) vs. EU (`api.eu.mistral.ai`)

| Modell | Token-Typ | Global (`api.mistral.ai`) | EU-Endpunkt (`api.eu.mistral.ai`, Faktor 1.1) | Quelle |
| :--- | :--- | :--- | :--- | :--- |
| **Mistral Medium 3.5** | **Input** | **$1.50** / 1M (1,25 €) | **$1.65** / 1M (1,375 €) | [docs.mistral.ai](https://docs.mistral.ai/inference/regional-inference) / [mistral.ai](https://mistral.ai/pricing/api/) |
| | **Output** | **$7.50** / 1M (6,40 €) | **$8.25** / 1M (7,040 €) | [docs.mistral.ai](https://docs.mistral.ai/inference/regional-inference) / [mistral.ai](https://mistral.ai/pricing/api/) |
| **Mistral Small 4** | **Input** | **$0.15** / 1M (0,12 €) | **$0.165** / 1M (0,132 €) | [docs.mistral.ai](https://docs.mistral.ai/inference/regional-inference) / [mistral.ai](https://mistral.ai/pricing/api/) |
| | **Output** | **$0.60** / 1M (0,50 €) | **$0.660** / 1M (0,550 €) | [docs.mistral.ai](https://docs.mistral.ai/inference/regional-inference) / [mistral.ai](https://mistral.ai/pricing/api/) |
