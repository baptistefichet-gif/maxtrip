import { chromium, webkit } from "playwright";
import { spawn } from "node:child_process";
const port = 3164, base = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { stdio: "ignore" });
let failed = 0;
try {
  let ready = false;
  for (let i = 0; i < 90; i++) { try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 500)); }
  if (!ready) throw Error("Next.js failed to start");
  for (const [name, engine] of [["Chromium", chromium], ["WebKit", webkit]]) {
    const browser = await engine.launch();
    try {
      for (const width of [320, 390, 768, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 800 } });
        page.setDefaultTimeout(10000);
        try {
          await page.route("**/api/stations", route => route.fulfill({ json: { origins: ["PARIS (intramuros)"], destinations: ["LYON PART DIEU"] } }));
          await page.route("**/api/station-coordinates", route => route.fulfill({ json: { coordinates: {} } }));
          await page.goto(base);
          const out = page.getByRole("button", { name: /Date de l'aller/ });
          await out.click();
          const calendar = page.getByRole("dialog", { name: "Choisir date de l'aller" });
          await calendar.waitFor();
          const today = new Date();
          const future = new Date(today.getFullYear(), today.getMonth() + 1, 15, 12);
          await calendar.getByRole("button", { name: "Mois suivant" }).click();
          const futureLabel = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(future);
          await calendar.getByRole("button", { name: futureLabel }).click();
          if (await calendar.count()) throw Error("Calendar not closed after date selection");
          await out.click();
          await page.keyboard.press("Escape");
          if (await calendar.count()) throw Error("Escape did not close calendar");
          await page.getByText("Je veux un retour TGV MAX").click();
          const back = page.getByRole("button", { name: /Date du retour/ });
          await back.click();
          const returnCalendar = page.getByRole("dialog", { name: "Choisir date du retour" });
          await returnCalendar.waitFor();
          const disabledBefore = await returnCalendar.locator("button:disabled").count();
          if (!disabledBefore) throw Error("Past return dates not disabled");
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
          if (overflow) throw Error("Horizontal overflow");
          console.log("PASS", name, width);
        } catch (error) { failed++; console.error("FAIL", name, width, String(error)); }
        finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }
} finally { server.kill("SIGTERM"); }
if (failed) process.exitCode = 1;
