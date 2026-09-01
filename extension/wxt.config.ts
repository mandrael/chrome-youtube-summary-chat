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
    version: "0.1.0",
    permissions: isFull(env.mode)
      ? ["storage", "sidePanel", "nativeMessaging"]
      : ["storage", "sidePanel"],
    host_permissions: ["*://*.youtube.com/*", "https://openrouter.ai/*"],
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
    // Die Oberfläche liegt in Chromes Seitenleiste, nicht mehr in YouTubes rechter
    // Spalte: dort war sie an deren ~400 px gebunden. Die Seitenleiste zieht der
    // Nutzer selbst breit und sie überlebt die Navigation innerhalb von YouTube.
    side_panel: { default_path: "sidepanel.html" },
    action: {
      default_title: "YouTube Summary Chat",
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
