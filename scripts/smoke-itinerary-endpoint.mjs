import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const port = 3141;
const base = "http://127.0.0.1:" + port;
const server = spawn("npm", ["run", "start", "--", "-p", String(port)], { stdio: "ignore", env: { ...process.env, PORT: String(port) } });
let stopped = false;

function stop() {
  if (stopped) return;
  stopped = true;
  server.kill("SIGTERM");
}
process.on("exit", stop);
process.on("SIGINT", () => { stop(); process.exit(130); });

async function waitForServer() {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Next production server did not become ready in time.");
}

async function main() {
  const diagnostic = { started_at: new Date().toISOString() };
  try {
    await waitForServer();
    const url = new URL(base + "/api/itineraries");
    url.searchParams.set("date", "2026-10-29");
    url.searchParams.set("origine", "PARIS (intramuros)");
    url.searchParams.set("start", "08:00");
    url.searchParams.set("end", "23:00");
    url.searchParams.set("maxChanges", "1");
    url.searchParams.set("minWait", "20");
    url.searchParams.set("maxWait", "90");
    url.searchParams.set("routeType", "all");

    const requestStarted = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(90000), cache: "no-store" });
    const body = await response.text();
    let data;
    try { data = JSON.parse(body); } catch { throw new Error("Itinerary endpoint returned non-JSON: " + body.slice(0, 400)); }
    diagnostic.httpStatus = response.status;
    diagnostic.elapsedMs = Date.now() - requestStarted;
    diagnostic.payload = data;
    if (!response.ok) throw new Error("Itinerary endpoint returned HTTP " + response.status + ": " + body.slice(0, 500));
    if (!Array.isArray(data.routes)) throw new Error("Itinerary endpoint omitted the routes array.");
    if (typeof data.sourceCount !== "number" || typeof data.recordsLoaded !== "number") {
      throw new Error("Itinerary endpoint omitted source count metadata.");
    }
    for (const route of data.routes) {
      if (!Array.isArray(route.legs) || route.legs.length !== route.changes + 1) {
        throw new Error("Invalid route leg count in " + route.key);
      }
      if (route.origin !== "PARIS (intramuros)") {
        throw new Error("Route did not start at the exact selected departure station: " + route.origin);
      }
      if (!route.legs.every(leg => String(leg.od_happy_card).toUpperCase() === "OUI")) {
        throw new Error("Route contains a leg not marked MAX available.");
      }
    }
    const connections = data.routes.filter(route => route.changes > 0).length;
    console.log(JSON.stringify({
      pass: true,
      sourceCount: data.sourceCount,
      recordsLoaded: data.recordsLoaded,
      truncated: data.truncated,
      routeCount: data.routes.length,
      directRoutes: data.routes.filter(route => route.changes === 0).length,
      connectionRoutes: connections,
      sampleRoute: data.routes[0] ? {
        origin: data.routes[0].origin,
        destination: data.routes[0].destination,
        departure: data.routes[0].departure,
        arrival: data.routes[0].arrival,
        changes: data.routes[0].changes,
        legs: data.routes[0].legs.length
      } : null
    }, null, 2));
    if (data.routes.length === 0) throw new Error("No route found for Paris on the test date; investigate the graph/data filters.");
  } catch (error) {
    diagnostic.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    diagnostic.finished_at = new Date().toISOString();
    mkdirSync("diagnostics", { recursive: true });
    writeFileSync("diagnostics/itinerary-probe.json", JSON.stringify(diagnostic, null, 2));
    stop();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
