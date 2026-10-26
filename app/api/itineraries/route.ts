import { NextRequest, NextResponse } from "next/server";

export const revalidate = 900;
export const maxDuration = 60;

type TrainRecord = Record<string, unknown>;
type Journey = {
  key: string;
  origin: string;
  destination: string;
  legs: TrainRecord[];
  departure: string;
  arrival: string;
  departureMinutes: number;
  arrivalMinutes: number;
  durationMinutes: number;
  changes: number;
  returns: Journey[];
};

const API_BASE = "https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/records";
const PAGE_SIZE = 100;
const MAX_RECORDS = 3000;
const MAX_ROUTES = 180;
const CITY_PREFIXES = [
  "AIX EN PROVENCE", "CLERMONT FERRAND", "SAINT ETIENNE", "LA ROCHELLE",
  "MONTPELLIER", "STRASBOURG", "PERPIGNAN", "BESANCON", "MULHOUSE",
  "MARSEILLE", "BORDEAUX", "TOULOUSE", "GRENOBLE", "CHAMBERY", "ANNECY",
  "AVIGNON", "VALENCE", "NARBONNE", "BAYONNE", "NIMES", "ORLEANS",
  "POITIERS", "LIMOGES", "ANGERS", "NANTES", "RENNES", "LILLE", "LYON",
  "DIJON", "TOURS", "REIMS", "METZ", "NANCY", "ROUEN", "CAEN", "BREST",
  "AMIENS", "TARBES", "PAU", "NICE", "TOULON", "PARIS"
];
const CITY_TRANSFER_BASE_MINUTES: Record<string, number> = {
  "LILLE EUROPE|LILLE FLANDRES": 10,
  "LYON PART DIEU|LYON PERRACHE": 20,
  "MONTPELLIER SAINT ROCH|MONTPELLIER SUD DE FRANCE": 30,
  "AIX EN PROVENCE CENTRE|AIX EN PROVENCE TGV": 25
};

function field(record: TrainRecord, names: string[]) {
  for (const name of names) {
    const value = record[name];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}
function originOf(record: TrainRecord) { return field(record, ["origine"]); }
function destinationOf(record: TrainRecord) { return field(record, ["destination"]); }
function departureOf(record: TrainRecord) { return field(record, ["heure_depart"]); }
function arrivalOf(record: TrainRecord) { return field(record, ["heure_arrivee"]); }
function available(record: TrainRecord) { return field(record, ["od_happy_card"]).toUpperCase() === "OUI"; }
function normal(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("fr-FR").replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
}
function cityOf(station: string) {
  const value = normal(station);
  return CITY_PREFIXES.find(prefix => value === prefix || value.startsWith(prefix + " ")) ?? value;
}
function minutes(value: string) {
  const match = value.match(/(\d{1,2})[:hH](\d{2})|^(\d{1,2})$/);
  if (!match) return -1;
  return Number(match[1] ?? match[3]) * 60 + Number(match[2] ?? 0);
}
function timeText(value: number) {
  const normalized = ((value % 1440) + 1440) % 1440;
  return String(Math.floor(normalized / 60)).padStart(2, "0") + ":" + String(normalized % 60).padStart(2, "0");
}
function trainKey(record: TrainRecord) {
  return [field(record, ["train_no", "entity"]), originOf(record), destinationOf(record), departureOf(record), arrivalOf(record)].join("|");
}
function transferMinimum(previousStation: string, nextStation: string) {
  if (normal(previousStation) === normal(nextStation)) return 0;
  const previousCity = cityOf(previousStation);
  const nextCity = cityOf(nextStation);
  if (previousCity !== nextCity) return null;
  if (previousCity === "PARIS") return 60;
  const pair = [normal(previousStation), normal(nextStation)].sort().join("|");
  const base = CITY_TRANSFER_BASE_MINUTES[pair];
  return base === undefined ? null : base * 2;
}
function escapeOdsql(value: string) { return value.replace(/'/g, "''"); }

async function getAllAvailableTrains(date: string) {
  const query = "date = date'" + date + "' AND od_happy_card = 'OUI'";
  const firstUrl = new URL(API_BASE);
  firstUrl.searchParams.set("where", query);
  firstUrl.searchParams.set("limit", String(PAGE_SIZE));
  firstUrl.searchParams.set("offset", "0");
  firstUrl.searchParams.set("order_by", "heure_depart");

  const firstResponse = await fetch(firstUrl.toString(), { headers: { Accept: "application/json" }, next: { revalidate: 900 } });
  if (!firstResponse.ok) throw new Error("SNCF HTTP " + firstResponse.status + " lors du chargement des trains MAX.");
  const firstData = await firstResponse.json();
  const total = typeof firstData.total_count === "number" ? firstData.total_count : PAGE_SIZE;
  const pages = Math.min(Math.ceil(total / PAGE_SIZE), Math.ceil(MAX_RECORDS / PAGE_SIZE));
  const results: TrainRecord[] = Array.isArray(firstData.results) ? firstData.results : [];

  for (let batchStart = 1; batchStart < pages; batchStart += 8) {
    const batchPages = Array.from({ length: Math.min(8, pages - batchStart) }, (_, index) => batchStart + index);
    const fetched = await Promise.all(batchPages.map(async page => {
      const pageUrl = new URL(API_BASE);
      pageUrl.searchParams.set("where", query);
      pageUrl.searchParams.set("limit", String(PAGE_SIZE));
      pageUrl.searchParams.set("offset", String(page * PAGE_SIZE));
      pageUrl.searchParams.set("order_by", "heure_depart");
      const response = await fetch(pageUrl.toString(), { headers: { Accept: "application/json" }, next: { revalidate: 900 } });
      if (!response.ok) throw new Error("SNCF HTTP " + response.status + " pendant la pagination.");
      const data = await response.json();
      return Array.isArray(data.results) ? data.results as TrainRecord[] : [];
    }));
    for (const pageRows of fetched) results.push(...pageRows);
  }

  return { records: results.slice(0, MAX_RECORDS), total, truncated: total > MAX_RECORDS, query };
}

function makeJourneys(records: TrainRecord[], origin: string, destination: string | null, options: {
  start: number; end: number; maxLegs: number; minWait: number; maxWait: number; indirectOnly: boolean;
}) {
  const adjacency = new Map<string, TrainRecord[]>();
  for (const record of records) {
    const from = originOf(record);
    const to = destinationOf(record);
    const dep = minutes(departureOf(record));
    const rawArr = minutes(arrivalOf(record));
    if (!from || !to || dep < 0 || rawArr < 0) continue;
    let arr = rawArr;
    if (arr < dep) arr += 1440;
    const fromCity = cityOf(from);
    if (!adjacency.has(fromCity)) adjacency.set(fromCity, []);
    adjacency.get(fromCity)!.push({ ...record, __depMin: dep, __arrMin: arr });
  }
  for (const list of adjacency.values()) {
    list.sort((a, b) => Number(a.__depMin) - Number(b.__depMin));
  }

  const found: Journey[] = [];
  const routeKeys = new Set<string>();
  let visitedStates = 0;
  const maxStates = destination ? 12000 : 30000;
  const routeLimit = destination ? 10 : 3;

  function save(path: TrainRecord[]) {
    if (!path.length) return;
    if (options.indirectOnly && path.length < 2) return;
    const last = path[path.length - 1];
    const first = path[0];
    const finalDestination = destinationOf(last);
    if (destination && normal(finalDestination) !== normal(destination)) return;
    const key = path.map(trainKey).join(" >> ");
    if (routeKeys.has(key)) return;
    const existingForDestination = found.filter(route => normal(route.destination) === normal(finalDestination)).length;
    if (existingForDestination >= routeLimit || found.length >= MAX_ROUTES) return;
    routeKeys.add(key);
    const departureMinutes = Number(first.__depMin);
    let arrivalMinutes = Number(last.__arrMin);
    while (arrivalMinutes < departureMinutes) arrivalMinutes += 1440;
    found.push({
      key,
      origin: originOf(first),
      destination: finalDestination,
      legs: path.map(({ __depMin, __arrMin, ...record }) => record),
      departure: departureOf(first),
      arrival: arrivalOf(last),
      departureMinutes,
      arrivalMinutes,
      durationMinutes: arrivalMinutes - departureMinutes,
      changes: path.length - 1,
      returns: []
    });
  }

  function dfs(current: string, path: TrainRecord[], visitedCities: Set<string>) {
    visitedStates++;
    if (visitedStates > maxStates || found.length >= MAX_ROUTES) return;
    const last = path[path.length - 1];
    if (path.length && (!destination || normal(destinationOf(last)) === normal(destination))) {
      save(path);
      if (destination) return;
    }
    if (path.length >= options.maxLegs) return;
    const candidates = adjacency.get(cityOf(current)) ?? [];
    let scanned = 0;
    for (const next of candidates) {
      if (scanned++ >= 80) break;
      const nextStation = destinationOf(next);
      const nextCity = cityOf(nextStation);
      if (path.length === 0 && normal(originOf(next)) !== normal(origin)) continue;
      if (visitedCities.has(nextCity)) continue;
      let absoluteDep = Number(next.__depMin);
      if (path.length === 0) {
        if (absoluteDep < options.start || absoluteDep > options.end) continue;
      } else {
        const previous = path[path.length - 1];
        const previousArr = Number(previous.__arrMin);
        while (absoluteDep < previousArr) absoluteDep += 1440;
        const gap = absoluteDep - previousArr;
        const minTransfer = transferMinimum(destinationOf(previous), originOf(next));
        if (minTransfer === null) continue;
        if (gap < Math.max(options.minWait, minTransfer) || gap > options.maxWait) continue;
      }
      const dayShift = absoluteDep - Number(next.__depMin);
      const adjustedNext = { ...next, __depMin: absoluteDep, __arrMin: Number(next.__arrMin) + dayShift };
      visitedCities.add(nextCity);
      dfs(nextStation, [...path, adjustedNext], visitedCities);
      visitedCities.delete(nextCity);
      if (visitedStates > maxStates || found.length >= MAX_ROUTES) break;
    }
  }

  dfs(origin, [], new Set([cityOf(origin)]));
  return found.sort((a, b) => a.departureMinutes - b.departureMinutes || a.durationMinutes - b.durationMinutes);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const date = params.get("date")?.trim() ?? "";
  const origin = params.get("origine")?.trim() ?? "";
  const destination = params.get("destination")?.trim() || null;
  const startText = params.get("start") || "08:00";
  const endText = params.get("end") || "23:00";
  const maxChanges = Math.max(0, Math.min(3, Number(params.get("maxChanges") || 1)));
  const minWait = Math.max(10, Math.min(180, Number(params.get("minWait") || 20)));
  const maxWait = Math.max(minWait, Math.min(360, Number(params.get("maxWait") || 90)));
  const indirectOnly = params.get("routeType") === "indirect";
  const returnDate = params.get("returnDate")?.trim() ?? "";
  const returnStartText = params.get("returnStart") || "08:00";
  const returnEndText = params.get("returnEnd") || "23:00";
  const returnRequired = params.get("returnRequired") === "true";
  const start = minutes(startText);
  const end = minutes(endText);
  const returnStart = minutes(returnStartText);
  const returnEnd = minutes(returnEndText);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !origin) {
    return NextResponse.json({ error: "Une date et une gare de départ sont obligatoires." }, { status: 400 });
  }
  if (start < 0 || end < start || returnStart < 0 || returnEnd < returnStart) {
    return NextResponse.json({ error: "La plage horaire doit être valide et se terminer après le début." }, { status: 400 });
  }
  if (returnRequired && (!/^\d{4}-\d{2}-\d{2}$/.test(returnDate) || returnDate < date)) {
    return NextResponse.json({ error: "La date du retour doit être égale ou postérieure à la date de l'aller." }, { status: 400 });
  }

  try {
    const outboundData = await getAllAvailableTrains(date);
    let routes = makeJourneys(outboundData.records, origin, destination, {
      start, end, maxLegs: params.get("routeType") === "direct" ? 1 : maxChanges + 1,
      minWait, maxWait, indirectOnly
    });

    if (returnRequired) {
      const returnData = await getAllAvailableTrains(returnDate);
      const returnStartMinutes = returnStart;
      const returnEndMinutes = returnEnd;
      const returnCache = new Map<string, Journey[]>();
      routes = routes.map(route => {
        const destinationKey = normal(route.destination);
        let matchingReturns = returnCache.get(destinationKey);
        if (!matchingReturns) {
          matchingReturns = makeJourneys(returnData.records, route.destination, origin, {
            start: returnStartMinutes, end: returnEndMinutes, maxLegs: params.get("routeType") === "direct" ? 1 : maxChanges + 1,
            minWait, maxWait, indirectOnly: false
          });
          returnCache.set(destinationKey, matchingReturns);
        }
        return { ...route, returns: matchingReturns };
      }).filter(route => route.returns.length > 0);
    }

    return NextResponse.json({
      routes,
      totalRoutes: routes.length,
      sourceCount: outboundData.total,
      recordsLoaded: outboundData.records.length,
      truncated: outboundData.truncated,
      returnRequired,
      fetched_at: new Date().toISOString(),
      source: "SNCF Open Data"
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Impossible de construire les itinéraires SNCF.",
      source: "SNCF Open Data"
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
