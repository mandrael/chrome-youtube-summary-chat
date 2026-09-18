import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    // Derselbe geteilte Kern wie in der Erweiterung, ohne Build-Schritt dazwischen.
    // fileURLToPath, nicht .pathname: der Projektpfad enthält Leerzeichen, und
    // .pathname gibt sie als %20 zurück – der Bundler findet die Datei dann nicht.
    alias: { "@shared": fileURLToPath(new URL("../shared/src", import.meta.url)) },
  },
  build: {
    // Wie in wxt.config.ts: ohne Minifier bleiben die Bezeichner lesbar, sonst
    // waere der Grep in scripts/verify-app-bundle.sh blind.
    minify: false,
    target: "es2022",
  },
});
