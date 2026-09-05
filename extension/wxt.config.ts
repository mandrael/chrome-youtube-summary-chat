import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// Zwei Builds aus einer Codebase:
//   --mode full   GitHub, unpacked, mit lokalem Audio-Fallback (yt-dlp via Native Messaging)
//   --mode store  Chrome Web Store, nur Untertitel, kein Fallback-Code im Bundle
//
// __FALLBACK__ wird als echtes Boolean-Literal eingesetzt (nicht als String), damit Rollup
// den toten Zweig samt des nur dort importierten Moduls entfernt. Der Beweis dafür ist der
// grep-Test in scripts/verify-store-bundle.sh, nicht diese Zusage.
const isFull = (mode: string) => mode !== "store";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: ".",
  // Die gebauten Ordner liegen sichtbar im Projekt, nicht in einem versteckten
  // .output/ – wer die Erweiterung laden will, soll sie sehen.
  outDir: "..",
  outDirTemplate: "build-{{mode}}",

  hooks: {
    // WXT ersetzt process.env.NODE_ENV im Bundle durch den Modus-Namen ("full"/"store"),
    // und seine Vorgabe gewinnt gegen ein eigenes `define` und gegen die
    // Umgebungsvariable. React hält "full" nicht für Produktion und bündelt seine
    // Entwicklungsfassung samt DevTools-Hinweis (gemessen am 04.09.2026:
    // react-dom-client.development.js im Content-Script, 2,25 statt 1,83 MB). Dieser
    // Hook läuft nach dem Zusammenführen und nur beim Bauen – `wxt dev` bleibt
    // Entwicklung. Beweis: Test 4 in scripts/verify-store-bundle.sh.
    "vite:build:extendConfig": (_entrypoints, config) => {
      (config.define ??= {})["process.env.NODE_ENV"] = JSON.stringify("production");
    },
  },

  vite: (env) => ({
    plugins: [tailwindcss()],
    define: {
      __FALLBACK__: JSON.stringify(isFull(env.mode)),
    },
    build: {
      // Lesbare Bundles: der Tree-Shaking-Test greppt nach Bezeichnern, die ein
      // aggressiver Minifier sonst umbenennt. Kostet ein paar KB, macht die
      // Prüfung aber überhaupt erst möglich.
      minify: false,
    },
  }),

  manifest: (env) => ({
    name: "YouTube Summary Chat",
    // Nur im full-Build: der oeffentliche Schluessel nagelt die Extension-ID auf
    // abblpkhijcggklokijkhfbkgeljmimpm fest. Ohne ihn leitet Chrome die ID aus dem
    // Installationspfad ab, und das Native-Messaging-Manifest waere nach jedem
    // Verschieben des Ordners ungueltig. Im Store-Build muss das Feld fehlen,
    // dort vergibt Google die ID.
    ...(isFull(env.mode)
      ? { key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnumBj9HzeC93IHsJx6clJGQxnCZMOZmhrIt6pbBgvpkDGzeRebTPEzm/wVXCVLf5ysqEfriIkpRaKrVjek2nyQJ+WF/6xtSvDVBER6KznpurSYhir+F2VZZyN8cfP3U+KHG+DVtvjlcrhcggoGjvUYiPU9h5vwKdPaucGGP7FCYW10/eY00CbJYx4E54hudsEIJHQAkfMcFmfMALiebZ926y2/VrimB0qAKMjG0mYZKglkncnr1LxO//SlAy8kHQ9YHIDqwnOoN9AYS7LTev+NFMFnFlMZTPwfzoIdQ0qiCYTzR+5392/IVrsIyHt7U1PqukqZvuL7eK5GlDHDCJmwIDAQAB" }
      : {}),
    description:
      "Chat mit dem Transkript eines YouTube-Videos: zusammenfassen, Kapitel, übersetzen.",
    // Schema major.function.fix (status.md, 03.09.2026). 0.3.0: Vergleich-Preset, adaptive
    // Tabellen, Videodownload, Installer für die Standardroute, React-Produktionsbuild.
    version: "0.3.0",
    // Bewusst ohne `sidePanel`: Vivaldi trägt jede Extension, die diese Permission
    // deklariert, ungefragt in seine Panel-Leiste ein und öffnet dort beim Installieren
    // ein leeres Panel (Vivaldi-Bug VB-123452, Stand 8.1 offen). Verhindern lässt sich
    // das nur, indem die Permission fehlt.
    permissions: isFull(env.mode)
      ? ["storage", "nativeMessaging"]
      : ["storage"],
    host_permissions: ["*://*.youtube.com/*", "https://openrouter.ai/*"],
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
    action: {
      default_title: "Sidebar ein-/ausblenden (sonst: Einstellungen)",
      // Ohne default_icon zeigt Vivaldi kein Symbol in der Werkzeugleiste, obwohl
      // `icons` gesetzt ist – Chrome fällt dort auf `icons` zurück, Vivaldi nicht.
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
        48: "icon/48.png",
        128: "icon/128.png",
      },
    },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
      256: "icon/256.png",
    },
    // Chrome-Übersetzung (Translator API, ab Chrome 138) läuft im Content-Script.
    minimum_chrome_version: "138",
  }),
});
