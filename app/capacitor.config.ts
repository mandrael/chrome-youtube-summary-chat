import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Der WebView laeuft unter `https://localhost` (androidScheme "https" ist die Vorgabe
 * von Capacitor 8). Das ist der Origin, den YouTube beim eingebetteten Player als
 * Embedder sieht und den die beiden KI-Endpunkte bei CORS pruefen – beides ist am
 * Geraet zu messen, nicht zu vermuten (docs/messungen.md, Abschnitt Android).
 *
 * `plugins.CapacitorHttp` steht bewusst NICHT hier: der globale fetch-Patch liest jede
 * Antwort am Stueck und wuerde den Chat-Stream still zu einer Antwort nach Sekunden
 * machen. Den nativen Weg ruft nur src/http-capacitor.ts, nur fuer YouTube.
 */
const config: CapacitorConfig = {
  appId: "at.gasperl.ytsummary",
  appName: "YT Summary Chat",
  webDir: "dist",
  plugins: {
    // Ab targetSdk 35 ist Edge-to-Edge erzwungen; ohne Behandlung liegt der Kopf der
    // Seite unter der Statusleiste. In Capacitor 8 macht das die SystemBars-Konfiguration
    // (nicht mehr eine android.*-Option): "css" spiegelt die Insets zusaetzlich als
    // --safe-area-inset-* in den WebView, index.html setzt dazu viewport-fit=cover.
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
