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
 * Aufruf:
 *   pnpm exec playwright install chromium   # einmalig, holt den Browser
 *   node scripts/ladeprobe.mjs ../build-full
 *
 * `playwright install` haengt auf diesem Mac: der Download laeuft durch, das
 * Entpacken bleibt nach 38 Dateien stehen und kommt nie zurueck. Nicht Netz und
 * nicht Platte – dasselbe Archiv von Hand entpackt braucht 1,6 s. Wenn es haengt:
 *   curl -sSL -o /tmp/pw.zip \
 *     https://cdn.playwright.dev/dbazure/download/playwright/builds/chromium/<build>/chromium-mac-arm64.zip
 *   unzip -q /tmp/pw.zip -d /tmp/pw && mv /tmp/pw/chrome-mac \
 *     ~/Library/Caches/ms-playwright/chromium-<build>/chrome-mac
 *   touch ~/Library/Caches/ms-playwright/chromium-<build>/INSTALLATION_COMPLETE \
 *         ~/Library/Caches/ms-playwright/chromium-<build>/DEPENDENCIES_VALIDATED
 * Die Nummer <build> steht in der Fehlermeldung des Starts (fuer 1.56.1: 1194).
 *
 * Playwright steht als devDependency in extension/package.json. Der Weg über
 * `pnpm dlx` war gedacht, um das zu vermeiden, funktioniert aber nicht: ESM löst
 * Importe vom Ort der Datei aus auf und ignoriert NODE_PATH, der Zwischenspeicher
 * von dlx liegt ausserhalb dieses Baums.
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
// Das Host-Element allein beweist nichts: WXT legt es samt Shadow-Root an, bevor React
// rendert. Im Shadow-Root liegen <style> und der Container (<div>); erst Kinder im
// Container zeigen, dass die Sidebar tatsächlich gezeichnet wurde.
const kinder = gemountet
  ? await seite.locator("yt-summary-chat").evaluate(
      // Gemessen 03.10.2026: shadow(style, div) – der div ist der React-Container.
      // `:scope > div` greift an einem ShadowRoot nicht, daher über children.
      (el) => [...(el.shadowRoot?.children ?? [])].find((c) => c.tagName === "DIV")?.childElementCount ?? 0,
    )
  : 0;
if (gemountet && !kinder) {
  // Zur Diagnose den Aufbau zeigen: Tags bis Tiefe 3, ohne Inhalte.
  const aufbau = await seite.locator("yt-summary-chat").evaluate((el) => {
    const baum = (n, t) =>
      t > 3 ? "" : [...n.children].map((c) => `${c.tagName.toLowerCase()}(${baum(c, t + 1)})`).join(" ");
    return el.shadowRoot ? `shadow(${baum(el.shadowRoot, 0)})` : `kein offener Shadow-Root; ${baum(el, 0)}`;
  });
  console.log(`Aufbau: ${aufbau}`);
}
// Gegenprobe: ohne geladenen Service Worker misst der Mount-Test nichts.
const geladen = ctx.serviceWorkers().length > 0;
await ctx.close();
server.close();

// Erwartet ist nur, dass der Stub nicht YouTube ist: jeder Abruf an einen anderen Host
// scheitert an `MAP * ~NOTFOUND`. Das gilt für Konsolenmeldungen. Ein `pageerror` ist
// immer ein Befund und läuft nie durch diese Liste.
// Netzfehler beim Laden fremder Ressourcen (die Testseite ist offline, je nach Umgebung
// mit anderem Code: NAME_NOT_RESOLVED, SSL_PROTOCOL_ERROR …) – kein Fehler der Erweiterung.
const erwartet = /^console\.error: Failed to load resource: net::ERR_[A-Z_]+/;
const echte = fehler.filter((f) => f.startsWith("pageerror:") || !erwartet.test(f));

console.log(`Extension geladen: ${geladen ? "ja" : "NEIN"}`);
console.log(`Sidebar gemountet: ${gemountet === 1 ? "ja" : `NEIN (${gemountet})`}`);
console.log(`Sidebar gezeichnet (Kinder im Shadow-Root): ${kinder > 0 ? `ja (${kinder})` : "NEIN"}`);
console.log(`Meldungen gesamt: ${fehler.length}, davon unerwartet: ${echte.length}`);
for (const f of echte) console.log("  " + f.slice(0, 300));

if (!geladen || gemountet !== 1 || kinder === 0 || echte.length) {
  console.log("ERGEBNIS: FEHLGESCHLAGEN");
  process.exit(1);
}
console.log("ERGEBNIS: bestanden");
