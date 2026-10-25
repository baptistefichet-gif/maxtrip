import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const base = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax";
const TARGET_DATE = "2026-10-29";
const REQUIRED_FIELDS = ["date", "origine", "destination", "heure_depart", "heure_arrivee", "od_happy_card"];

async function json(url, label) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await response.text();
  if (!response.ok) throw new Error(label + " HTTP " + response.status + ": " + body.slice(0, 350));
  try { return JSON.parse(body); }
  catch { throw new Error(label + " returned invalid JSON: " + body.slice(0, 250)); }
}

function urlFor(where, limit = 1) {
  const url = new URL(base + "/records");
  url.searchParams.set("limit", String(limit));
  if (where) url.searchParams.set("where", where);
  return url;
}

async function probe(where, label) {
  const data = await json(urlFor(where).toString(), label);
  return {
    label,
    where,
    total_count: typeof data.total_count === "number" ? data.total_count : null,
    returned: Array.isArray(data.results) ? data.results.length : 0,
    sample: Array.isArray(data.results) && data.results[0] ? {
      origine: data.results[0].origine ?? null,
      destination: data.results[0].destination ?? null,
      date: data.results[0].date ?? null,
      heure_depart: data.results[0].heure_depart ?? null,
      heure_arrivee: data.results[0].heure_arrivee ?? null,
      od_happy_card: data.results[0].od_happy_card ?? null
    } : null
  };
}

async function main() {
  const routeSource = readFileSync("app/api/trains/route.ts", "utf8");
  assert(!routeSource.includes('url.searchParams.set("timezone", "Europe/Paris")'),
    "Do not set timezone=Europe/Paris on date-only TGV MAX queries; this made valid date searches return zero rows.");
  const generic = await json(urlFor("", 1).toString(), "Generic records");
  assert(Array.isArray(generic.results) && generic.results.length > 0, "Generic API records query returned no rows.");
  const sample = generic.results[0];
  const missingFields = REQUIRED_FIELDS.filter(field => !(field in sample));
  assert(missingFields.length === 0, "Missing expected field(s): " + missingFields.join(", "));

  const dateLiteral = "date = date'" + TARGET_DATE + "'";
  const parisCandidates = [
    "PARIS (intramuros)",
    "PARIS GARE DE LYON",
    "PARIS MONTPARNASSE",
    "PARIS MONTPARNASSE 1 ET 2",
    "PARIS NORD",
    "PARIS EST",
    "PARIS AUSTERLITZ"
  ];

  const probes = [];
  probes.push(await probe(dateLiteral, "All records for target date"));
  for (const origin of parisCandidates) {
    const escaped = origin.replace(/'/g, "''");
    probes.push(await probe("origine = '" + escaped + "'", "Origin only: " + origin));
    probes.push(await probe("origine = '" + escaped + "' AND " + dateLiteral, "Origin + target date: " + origin));
  }

  const availableWhere = "origine = 'PARIS (intramuros)' AND date = date'" + TARGET_DATE + "' AND od_happy_card = 'OUI'";
  const parisAvailable = await probe(availableWhere, "Paris + target date + MAX OUI");
  const dateAvailable = await probe(dateLiteral + " AND od_happy_card = 'OUI'", "All stations + target date + MAX OUI");

  const origins = [];
  for (let offset = 0; offset < 2000; offset += 100) {
    const originGroupUrl = new URL(base + "/records");
    originGroupUrl.searchParams.set("select", "origine");
    originGroupUrl.searchParams.set("group_by", "origine");
    originGroupUrl.searchParams.set("limit", "100");
    originGroupUrl.searchParams.set("offset", String(offset));
    const group = await json(originGroupUrl.toString(), "Grouped origins offset " + offset);
    const rows = Array.isArray(group.results) ? group.results : [];
    origins.push(...rows.map(row => String(row.origine ?? "")).filter(Boolean));
    if (rows.length < 100) break;
  }
  const parisFromGroup = Array.from(new Set(origins)).filter(value => value.toLocaleUpperCase("fr-FR").startsWith("PARIS")).slice(0, 80);

  const liveApp = { base: "https://maxtrip-qomi.vercel.app" };
  try {
    const stationResponse = await fetch(liveApp.base + "/api/stations", { headers: { Accept: "application/json" } });
    const stationBody = await stationResponse.text();
    let stationData = null;
    try { stationData = JSON.parse(stationBody); } catch {}
    liveApp.stations = {
      status: stationResponse.status,
      originCount: Array.isArray(stationData?.origins) ? stationData.origins.length : null,
      destinationCount: Array.isArray(stationData?.destinations) ? stationData.destinations.length : null,
      hasParisIntramuros: Array.isArray(stationData?.origins) && stationData.origins.includes("PARIS (intramuros)"),
      error: stationData?.error ?? stationBody.slice(0, 200)
    };
  } catch (error) {
    liveApp.stations = { error: error instanceof Error ? error.message : String(error) };
  }

  async function probeLiveApi(label, params) {
    const appUrl = new URL(liveApp.base + "/api/trains");
    for (const [key, value] of Object.entries(params)) appUrl.searchParams.set(key, value);
    appUrl.searchParams.set("_probe", String(Date.now()));
    const response = await fetch(appUrl.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
    const body = await response.text();
    let data = null;
    try { data = JSON.parse(body); } catch {}
    return {
      label,
      request: appUrl.toString(),
      status: response.status,
      total_count: data?.total_count ?? null,
      returned_count: Array.isArray(data?.results) ? data.results.length : null,
      query_info: data?.query_info ?? null,
      error: data?.error ?? (response.ok ? null : body.slice(0, 250))
    };
  }

  try {
    liveApp.routeOriginOnly = await probeLiveApi("origin only", { origine: "PARIS (intramuros)", limit: "2" });
    liveApp.routeDateOnly = await probeLiveApi("date only", { date: TARGET_DATE, limit: "2" });
    liveApp.routeOriginDate = await probeLiveApi("origin + date", { origine: "PARIS (intramuros)", date: TARGET_DATE, limit: "2" });
  } catch (error) {
    liveApp.routeProbeError = error instanceof Error ? error.message : String(error);
  }

  try {
    const appUrl = new URL(liveApp.base + "/api/trains");
    appUrl.searchParams.set("origine", "PARIS (intramuros)");
    appUrl.searchParams.set("date", TARGET_DATE);
    appUrl.searchParams.set("limit", "2");
    appUrl.searchParams.set("_probe", String(Date.now()));
    const response = await fetch(appUrl.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
    const body = await response.text();
    let data = null;
    try { data = JSON.parse(body); } catch {}
    liveApp.parisTargetQuery = {
      request: appUrl.toString(),
      status: response.status,
      total_count: data?.total_count ?? null,
      returned_count: Array.isArray(data?.results) ? data.results.length : null,
      sample: Array.isArray(data?.results) && data.results[0] ? {
        origine: data.results[0].origine ?? null,
        destination: data.results[0].destination ?? null,
        date: data.results[0].date ?? null,
        od_happy_card: data.results[0].od_happy_card ?? null
      } : null,
      error: data?.error ?? body.slice(0, 200)
    };
  } catch (error) {
    liveApp.parisTargetQuery = { error: error instanceof Error ? error.message : String(error) };
  }

  const directWithTimezoneUrl = urlFor("origine = 'PARIS (intramuros)' AND date = date'" + TARGET_DATE + "'", 1);
  directWithTimezoneUrl.searchParams.set("timezone", "Europe/Paris");
  const directWithTimezoneData = await json(directWithTimezoneUrl.toString(), "Direct API with timezone");
  const directNoTimezoneData = await json(urlFor("origine = 'PARIS (intramuros)' AND date = date'" + TARGET_DATE + "'", 1).toString(), "Direct API without timezone");
  liveApp.directWithTimezone = directWithTimezoneData.total_count ?? null;
  liveApp.directWithoutTimezone = directNoTimezoneData.total_count ?? null;

  const diagnostics = {
    generated_at: new Date().toISOString(),
    target_date: TARGET_DATE,
    live_app: liveApp,
    generic_sample: {
      missingFields,
      origine: sample.origine ?? null,
      destination: sample.destination ?? null,
      date: sample.date ?? null,
      heure_depart: sample.heure_depart ?? null,
      heure_arrivee: sample.heure_arrivee ?? null,
      od_happy_card: sample.od_happy_card ?? null
    },
    grouped_origins_returned: origins.length,
    paris_origins_in_group_sample: parisFromGroup,
    paris_available_query: parisAvailable,
    all_available_query: dateAvailable,
    unique_origin_values_collected: Array.from(new Set(origins)).length,
    probes
  };

  mkdirSync("diagnostics", { recursive: true });
  writeFileSync("diagnostics/api-probe.json", JSON.stringify(diagnostics, null, 2));
  console.log(JSON.stringify(diagnostics, null, 2));
  assert(probes[0].total_count !== null, "Target-date probe omitted total_count; inspect diagnostics artifact.");
  console.log("PASS: generic data, field schema, exact-date probes and Paris-origin probes completed.");
}

function assert(condition, message) {
  if (!condition) throw new Error("SMOKE TEST FAILED: " + message);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
