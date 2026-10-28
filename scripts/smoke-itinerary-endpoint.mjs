import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

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
  const pageSource = readFileSync("app/page.tsx", "utf8");
  const apiSource = readFileSync("app/api/itineraries/route.ts", "utf8");
  const mapSource = readFileSync("components/StationMap.tsx", "utf8");
  if (pageSource.includes('type="time"')) throw new Error("The app must use hour-only dropdowns, not the browser's hour/minute time picker.");
  if (!pageSource.includes("function HourSelect")) throw new Error("Reusable hour-only selector is missing.");
  if (!pageSource.includes('const [outEnd, setOutEnd] = useState("");') || !pageSource.includes('end: outEnd || "24:00"')) throw new Error("The outbound end time must be optional and treated as end of day.");
  if (!pageSource.includes('const [returnEnd, setReturnEnd] = useState("");') || !pageSource.includes('params.set("returnEnd", returnEnd || "24:00")')) throw new Error("The return end time must be optional and treated as end of day.");
  if (!pageSource.includes("destinationSummaries") || !pageSource.includes("selectedExploreDestination")) throw new Error("Explore mode must show distinct destination counts and filter by selected destination.");
  if (!pageSource.includes("Autoriser les trajets avec correspondance") || !pageSource.includes("Je veux un retour TGV MAX")) throw new Error("The connection toggle and return label must be visible and clear.");
  if (!apiSource.includes("const routeLimit = MAX_ROUTES;")) throw new Error("Explore route counts must not be capped at four routes per destination.");
  if (!mapSource.includes("tile.openstreetmap.org") || !mapSource.includes('journey.changes === 0 ? "#16825d" : "#d97706"')) throw new Error("The map must use public OSM tiles and distinct direct/indirect colors.");
  if (!mapSource.includes("if (!point || !next) return null;")) throw new Error("The map must not draw a false straight line across a station without coordinates.");
  const diagnostic = { started_at: new Date().toISOString(), hourOnlySelectors: true, productBehaviorAssertions: true };
  try {
    await waitForServer();
    const url = new URL(base + "/api/itineraries");
    url.searchParams.set("date", "2026-10-29");
    url.searchParams.set("origine", "PARIS (intramuros)");
    url.searchParams.set("start", "08:00");
    url.searchParams.set("end", "24:00");
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
    const invalidRangeUrl = new URL(base + "/api/itineraries");
    invalidRangeUrl.searchParams.set("date", "2026-10-29");
    invalidRangeUrl.searchParams.set("origine", "PARIS (intramuros)");
    invalidRangeUrl.searchParams.set("start", "08:00");
    invalidRangeUrl.searchParams.set("end", "07:00");
    const invalidRangeResponse = await fetch(invalidRangeUrl, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    if (invalidRangeResponse.status !== 400) throw new Error("An inverted time range must return HTTP 400.");
    diagnostic.timeBoundaryChecks = { endOfDay24Accepted: response.ok, invertedRangeRejected: invalidRangeResponse.status === 400 };
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
    if (connections === 0) throw new Error("Connection search returned no multi-leg itinerary for the Paris test date.");
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

    const classicConnectionUrl = new URL(base + "/api/itineraries");
    classicConnectionUrl.searchParams.set("date", "2026-10-29");
    classicConnectionUrl.searchParams.set("origine", "PARIS (intramuros)");
    classicConnectionUrl.searchParams.set("destination", "LYON (intramuros)");
    classicConnectionUrl.searchParams.set("start", "08:00");
    classicConnectionUrl.searchParams.set("end", "23:00");
    classicConnectionUrl.searchParams.set("maxChanges", "2");
    classicConnectionUrl.searchParams.set("minWait", "20");
    classicConnectionUrl.searchParams.set("maxWait", "90");
    classicConnectionUrl.searchParams.set("routeType", "indirect");
    const classicStarted = Date.now();
    const classicResponse = await fetch(classicConnectionUrl, { signal: AbortSignal.timeout(90000), cache: "no-store" });
    const classicBody = await classicResponse.text();
    let classicData;
    try { classicData = JSON.parse(classicBody); } catch { throw new Error("Classic connection search returned non-JSON: " + classicBody.slice(0, 300)); }
    if (!classicResponse.ok) throw new Error("Classic connection search returned HTTP " + classicResponse.status + ": " + classicBody.slice(0, 400));
    if (!Array.isArray(classicData.routes)) throw new Error("Classic connection search omitted the routes array.");
    if (classicData.routes.some(route => route.changes < 1 || route.destination !== "LYON (intramuros)")) {
      throw new Error("Classic indirect search returned a direct route or a route to the wrong destination.");
    }
    diagnostic.classicIndirectSearch = {
      status: classicResponse.status,
      elapsedMs: Date.now() - classicStarted,
      routeCount: classicData.routes.length,
      multiLegRoutes: classicData.routes.filter(route => route.changes >= 1).length,
      sample: classicData.routes[0] ? {
        destination: classicData.routes[0].destination,
        changes: classicData.routes[0].changes,
        legs: classicData.routes[0].legs.map(leg => ({
          origin: leg.origine, destination: leg.destination, departure: leg.heure_depart, arrival: leg.heure_arrivee
        }))
      } : null
    };

    const returnUrl = new URL(base + "/api/itineraries");
    returnUrl.searchParams.set("date", "2026-10-29");
    returnUrl.searchParams.set("origine", "PARIS (intramuros)");
    returnUrl.searchParams.set("start", "08:00");
    returnUrl.searchParams.set("end", "23:00");
    returnUrl.searchParams.set("maxChanges", "1");
    returnUrl.searchParams.set("minWait", "20");
    returnUrl.searchParams.set("maxWait", "90");
    returnUrl.searchParams.set("routeType", "all");
    returnUrl.searchParams.set("returnRequired", "true");
    returnUrl.searchParams.set("returnDate", "2026-10-30");
    returnUrl.searchParams.set("returnStart", "18:00");
    returnUrl.searchParams.set("returnEnd", "23:00");

    const returnResponse = await fetch(returnUrl, { signal: AbortSignal.timeout(90000), cache: "no-store" });
    const returnBody = await returnResponse.text();
    let returnData;
    try { returnData = JSON.parse(returnBody); } catch { throw new Error("Round-trip endpoint returned non-JSON: " + returnBody.slice(0, 400)); }
    if (!returnResponse.ok) throw new Error("Round-trip endpoint returned HTTP " + returnResponse.status + ": " + returnBody.slice(0, 500));
    if (!Array.isArray(returnData.routes)) throw new Error("Round-trip endpoint omitted routes array.");
    diagnostic.roundTrip = {
      httpStatus: returnResponse.status,
      routeCount: returnData.routes.length,
      compatibleReturnCount: Array.isArray(returnData.routes)
        ? returnData.routes.reduce((count, route) => count + (Array.isArray(route.returns) ? route.returns.length : 0), 0)
        : 0,
      sample: returnData.routes[0] ? {
        outbound: returnData.routes[0].origin + " -> " + returnData.routes[0].destination,
        returnCount: returnData.routes[0].returns?.length ?? 0,
        returnSample: returnData.routes[0].returns?.[0] ? {
          origin: returnData.routes[0].returns[0].origin,
          destination: returnData.routes[0].returns[0].destination,
          departure: returnData.routes[0].returns[0].departure,
          arrival: returnData.routes[0].returns[0].arrival,
          changes: returnData.routes[0].returns[0].changes
        } : null
      } : null
    };
    if (returnData.routes.length === 0) throw new Error("No outbound itinerary had a compatible return for the tested date and evening window.");
    for (const route of returnData.routes) {
      if (!Array.isArray(route.returns) || route.returns.length === 0) {
        throw new Error("The return-required search returned an itinerary without compatible return legs.");
      }
      for (const back of route.returns) {
        if (back.origin !== route.destination || back.destination !== route.origin) {
          throw new Error("A returned itinerary does not reverse the outbound endpoints: " + route.origin + " -> " + route.destination + ", return " + back.origin + " -> " + back.destination);
        }
        if (!Array.isArray(back.legs) || back.legs.length !== back.changes + 1) {
          throw new Error("Return itinerary has inconsistent leg count.");
        }
        if (!back.legs.every(leg => String(leg.od_happy_card).toUpperCase() === "OUI")) {
          throw new Error("Return itinerary contains a leg not marked MAX available.");
        }
      }
    }

    console.log(JSON.stringify({
      returnRequiredSearch: {
        routeCount: returnData.routes.length,
        everyRouteHasCompatibleReturn: returnData.routes.every(route => route.returns.length > 0),
        checkedReturnJourneys: returnData.routes.reduce((total, route) => total + route.returns.length, 0)
      }
    }, null, 2));
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
