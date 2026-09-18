/**
 * Fünfte Prüfung: die gebaute Erweiterung einmal wirklich laden.
 *
 * Am 05.09.2026 bestanden alle anderen Prüfungen, während das Content-Script beim
 * ersten Render warf – ein Bundle-Grep ersetzt keinen Ladeversuch. Diese Datei macht
 * daraus etwas Wiederholbares statt Handarbeit.
 *
 * YouTube selbst wird nicht aufgerufen: ein `--host-resolver-rules` leitet
 * www.youtube.com auf einen lokalen Server um, der eine Seite mit den beiden Dingen
 * ausliefert, die das Content-Script braucht – die Watch-URL und den Anker
 * `#secondary-inner`. Geprüft wird dadurch genau das, was der Grep nicht sieht: ob die
 * Sidebar ohne Ausnahme mountet. Der Transkript-Abruf schlägt dabei erwartungsgemäss
 * fehl (der Stub ist nicht YouTube); das ist eine Meldung in der UI, kein Fehler.
 *
 * Aufruf (Playwright kommt bewusst nicht als Abhängigkeit ins Projekt):
 *   pnpm dlx playwright@1.56.1 --version >/dev/null   # einmalig, holt das Paket
 *   node scripts/ladeprobe.mjs ../build-full
 */
import { createServer } from "node:http";
import { chromium } from "playwright";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const build = process.argv[2] ?? "../build-full";

const STUB = `<!doctype html><html><head><title>Testvideo - YouTube</title></head>
<body><div id="secondary"><div id="secondary-inner"></div></div>
<video id="movie_player" src=""></video></body></html>`;

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(STUB);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const userDataDir = await mkdtemp(join(tmpdir(), "ladeprobe-"));
// `channel: "chromium"` ist Pflicht: die Headless-Shell, die Playwright sonst startet,
// lädt gar keine Extensions – die Probe bestünde dann, ohne etwas zu messen.
const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: true,
  channel: "chromium",
  args: [
    `--disable-extensions-except=${build}`,
    `--load-extension=${build}`,
    // Eine einzige Regel: Chrome nimmt sonst nur das letzte Vorkommen des Schalters.
    // Alles ausser der umgeleiteten Watch-Seite läuft ins Leere – die Probe darf nicht
    // versehentlich ins echte Netz greifen.
    `--host-resolver-rules=MAP www.youtube.com 127.0.0.1:${port},MAP * ~NOTFOUND`,
  ],
});

const fehler = [];
const seite = await ctx.newPage();
seite.on("pageerror", (e) => fehler.push(`pageerror: ${e.message}`));
seite.on("console", (m) => {
  if (m.type() === "error") fehler.push(`console.error: ${m.text()}`);
});

await seite.goto("http://www.youtube.com/watch?v=aqz-KE-bpKQ", { waitUntil: "load" });
// Das Content-Script läuft auf document_idle und wartet bis zu 10 s auf den Anker.
await seite.waitForSelector("yt-summary-chat", { timeout: 15_000 }).catch(() => {});
await seite.waitForTimeout(3_000);

const gemountet = await seite.locator("yt-summary-chat").count();
// Gegenprobe: ohne geladenen Service Worker misst der Mount-Test nichts.
const geladen = ctx.serviceWorkers().length > 0;
await ctx.close();
server.close();

// Erwartete Laufzeitmeldungen des Stubs aussortieren: er ist nicht YouTube, der
// Transkript-Abruf muss scheitern. Alles andere ist ein Befund.
const erwartet = /ERR_NAME_NOT_RESOLVED|Failed to load resource|net::ERR_|Transkript|Untertitel|Watch-Seite|Player-API/i;
const echte = fehler.filter((f) => !erwartet.test(f));

console.log(`Extension geladen: ${geladen ? "ja" : "NEIN"}`);
console.log(`Sidebar gemountet: ${gemountet === 1 ? "ja" : `NEIN (${gemountet})`}`);
console.log(`Meldungen gesamt: ${fehler.length}, davon unerwartet: ${echte.length}`);
for (const f of echte) console.log("  " + f.slice(0, 300));

if (!geladen || gemountet !== 1 || echte.length) {
  console.log("ERGEBNIS: FEHLGESCHLAGEN");
  process.exit(1);
}
console.log("ERGEBNIS: bestanden");
