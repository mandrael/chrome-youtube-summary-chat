import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    // Derselbe geteilte Kern wie in der Erweiterung, ohne Build-Schritt dazwischen.
    alias: { "@shared": new URL("../shared/src", import.meta.url).pathname },
  },
  build: {
    // Wie in wxt.config.ts: ohne Minifier bleiben die Bezeichner lesbar, sonst
    // waere der Grep in scripts/verify-app-bundle.sh blind.
    minify: false,
    target: "es2022",
  },
});
