import { applyConnectionRelevance } from "../lib/route-relevance.mjs";
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
  if (!pageSource.includes("applyConnectionRelevance") ||
      !pageSource.includes("Afficher aussi les autres correspondances") ||
      !mapSource.includes("radius={22}") ||
      !mapSource.includes("interactive={true}") ||
      !mapSource.includes("eventHandlers={{ click: () => onSelect?.(station.name) }}") ) {
    throw new Error("Shared relevance rule, explicit alternative access, and enlarged touch targets must exist.");
  }
  const direct = { key: "direct-aix", origin: "PARIS (intramuros)", destination: "AIX EN PROVENCE TGV", departureMinutes: 638, arrivalMinutes: 821, changes: 0, returns: [{ key: "back-direct" }] };
  const redundantIndirect = { key: "indirect-aix", origin: "PARIS (intramuros)", destination: "AIX EN PROVENCE TGV", departureMinutes: 638, arrivalMinutes: 881, changes: 1, returns: [{ key: "back-indirect" }] };
  const prunedFixture = applyConnectionRelevance([direct, redundantIndirect], { enabled: true });
  if (prunedFixture.visible.length !== 1 || prunedFixture.visible[0].key !== direct.key || prunedFixture.suppressed[0]?.key !== redundantIndirect.key) {
    throw new Error("The real-user example (Paris–Aix: direct 10:38–13:41 vs indirect 10:38–14:41) must hide the slower indirect by default.");
  }
  const fasterIndirect = { ...redundantIndirect, key: "faster-indirect", departureMinutes: 650, arrivalMinutes: 800 };
  if (!applyConnectionRelevance([direct, fasterIndirect], { enabled: true }).visible.some(route => route.key === fasterIndirect.key)) {
    throw new Error("An indirect that arrives earlier than the direct must remain visible.");
  }
  const farIndirect = { ...redundantIndirect, key: "far-indirect", departureMinutes: 700 };
  if (!applyConnectionRelevance([direct, farIndirect], { enabled: true }).visible.some(route => route.key === farIndirect.key)) {
    throw new Error("An indirect outside the +/- 60 minute departure window must remain visible.");
  }
  const directNoReturn = { ...direct, returns: [] };
  const indirectWithReturn = { ...redundantIndirect, returns: [{ key: "back-available" }] };
  const returnAware = applyConnectionRelevance([directNoReturn, indirectWithReturn], { enabled: true, returnRequired: true });
  if (!returnAware.visible.some(route => route.key === indirectWithReturn.key)) {
    throw new Error("An indirect with a compatible return must not be hidden by a direct without a compatible return.");
  }
  if (applyConnectionRelevance([direct, redundantIndirect], { enabled: true, showAllConnections: true }).visible.length !== 2) {
    throw new Error("The explicit show-all option must preserve all alternatives.");
  }
  if (!pageSource.includes('role={mode === "explore" && selectedExploreDestination ? "dialog" : undefined}') ||
      !pageSource.includes("Toutes les destinations") ||
      !pageSource.includes('aria-label="Fermer le détail de la destination"') ||
      !pageSource.includes('className="hidden"')) {
    throw new Error("In Explore mode, selecting a destination must open an accessible detail dialog and hide the inline results behind it.");
  }
  if (!pageSource.includes('event.key === "Escape"') || !pageSource.includes("document.body.style.overflow = \"hidden\"")) {
    throw new Error("The destination detail dialog must be dismissible with Escape and lock background scrolling.");
  }
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
    const liveRuleResult = applyConnectionRelevance(data.routes, { enabled: true, showAllConnections: false, returnRequired: false, toleranceMinutes: 60 });
    const liveSuppressed = liveRuleResult.suppressed;
    const canonical = value => {
      const normalized = String(value ?? "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toUpperCase().replace(/[’']/g, " ").replace(/\\s+/g, " ").trim();
      const cityPrefixes = ["AIX EN PROVENCE", "CLERMONT FERRAND", "SAINT ETIENNE", "LA ROCHELLE", "MONTPELLIER", "STRASBOURG", "PERPIGNAN", "BESANCON", "MULHOUSE", "MARSEILLE", "BORDEAUX", "TOULOUSE", "GRENOBLE", "CHAMBERY", "ANNECY", "AVIGNON", "VALENCE", "NARBONNE", "BAYONNE", "NIMES", "ORLEANS", "POITIERS", "LIMOGES", "ANGERS", "NANTES", "RENNES", "LILLE", "LYON", "DIJON", "TOURS", "REIMS", "METZ", "NANCY", "ROUEN", "CAEN", "BREST", "AMIENS", "TARBES", "PAU", "NICE", "TOULON", "PARIS"];
      return cityPrefixes.find(prefix => normalized === prefix || normalized.startsWith(prefix + " ")) ?? normalized;
    };
    const expectedSuppressed = liveSuppressed.every(candidate => data.routes.some(direct =>
      direct.changes === 0 &&
      canonical(direct.destination) === canonical(candidate.destination) &&
      Math.abs(direct.departureMinutes - candidate.departureMinutes) <= 60 &&
      direct.arrivalMinutes <= candidate.arrivalMinutes
    ));
    if (!expectedSuppressed) throw new Error("A suppressed live route could not be justified by the documented direct-comparison rule.");
    diagnostic.realDataRelevance = {
      evaluationDate: "2026-10-29",
      routesFromLiveSNCFData: data.routes.length,
      directRoutes: data.routes.filter(route => route.changes === 0).length,
      indirectRoutes: data.routes.filter(route => route.changes > 0).length,
      suppressedAsRedundant: liveSuppressed.length,
      visibleAfterRule: liveRuleResult.visible.length,
      sampleSuppressed: liveSuppressed.slice(0, 5).map(route => ({
        origin: route.origin, destination: route.destination, departure: route.departure,
        arrival: route.arrival, changes: route.changes,
        directComparator: data.routes.find(direct => direct.changes === 0 &&
          Math.abs(direct.departureMinutes - route.departureMinutes) <= 60 &&
          direct.arrivalMinutes <= route.arrivalMinutes &&
          String(direct.destination).toLocaleUpperCase("fr-FR") === String(route.destination).toLocaleUpperCase("fr-FR")
        )?.key ?? null
      })),
      completeRuleApplied: true
    };
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
    const liveRoundTripRule = applyConnectionRelevance(returnData.routes, { enabled: true, showAllConnections: false, returnRequired: true, toleranceMinutes: 60 });
    for (const removed of liveRoundTripRule.suppressed) {
      const matchingDirect = returnData.routes.find(route => route.changes === 0 &&
        String(route.destination).toLocaleUpperCase("fr-FR") === String(removed.destination).toLocaleUpperCase("fr-FR") &&
        Math.abs(route.departureMinutes - removed.departureMinutes) <= 60 &&
        route.arrivalMinutes <= removed.arrivalMinutes);
      if (!matchingDirect || !Array.isArray(matchingDirect.returns) || matchingDirect.returns.length === 0) {
        throw new Error("Return-required relevance rule suppressed an indirect without a direct that also has a compatible return.");
      }
    }
    diagnostic.roundTripRelevanceRule = {
      routesWithRequiredReturns: returnData.routes.length,
      routesSuppressedAsRedundant: liveRoundTripRule.suppressed.length,
      routesVisibleByDefault: liveRoundTripRule.visible.length,
      everySuppressedRouteHasDirectWithCompatibleReturn: true
    };
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
